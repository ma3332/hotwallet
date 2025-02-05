const fs = require("fs-extra");
const path = require("path");
const ECPairFactory = require("ecpair").ECPairFactory;
const secp256k1 = require("tiny-secp256k1");
const {
  queryScantxoutset,
  getRequiredUTXOs,
  decryptPrivateKey,
  privateKeyWIFToHex,
  createP2PKHPreimageHash,
  createP2WPKHreimageHash,
  broadcastTransaction,
  getAddressType,
  ensureLowS,
  createSignedAllTransaction,
} = require("./bitcoinlib");
const bitcoin = require("bitcoinjs-lib");
const { console } = require("inspector");
console.log = require("console").log;
const sb = require("satoshi-bitcoin");

// Replace with your Bitcoin Core RPC credentials
const rpcUser = "tuananh"; // in bitcoin.conf
const rpcPassword = "tuananh"; // bitcoin.conf
const rpcHost = "127.0.0.1"; // Bitcoin Core RPC host
const rpcPort = 18443;

const receiver = "n4gzddU24JYpq5n8THBjSgt8XnBBqn6JFE";

const sendAmount = 0.01; // Amount to send in BTC
const tx_fee_slow = 2 * 10 ** -8; // according to choice from frontend - 2 satoshi/bytes
const tx_fee_medium = 5 * 10 ** -8; // according to choice from frontend - 5 satoshi/bytes
const tx_fee_fast = 10 * 10 ** -8; // according to choice from frontend - 10 satoshi/bytes, only happened in 2018

async function getPrivateKeyFromFolder(password, folder, file) {
  const filePath = path.join(__dirname, `${folder}`, `${file}.json`);
  // Read the encrypted JSON file
  const data = await fs.readJson(filePath);

  // Decrypt the private key
  const privateKeyWIF = decryptPrivateKey(
    data.encryptedPrivateKey,
    data.iv,
    password,
    Buffer.from(data.salt.data)
  );
  return privateKeyWIF;
}

async function getUTXOs(senderAddress) {
  const queryRes = await queryScantxoutset(
    senderAddress,
    rpcHost,
    rpcPort,
    rpcUser,
    rpcPassword
  );
  let utxos = queryRes.unspents;
  utxos.sort((a, b) => b.amount - a.amount);
  return utxos;
}

async function getCompressedPubKey(network) {
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;
  const privateKeyWIF = await getPrivateKeyFromFolder(
    "your-secure-password",
    "encrypted-keys-bitcoin",
    "n2C9Tj3BNDLEMQKWxeW35GKfnPGJatGvi7"
  );
  const privateKeyHex = privateKeyWIFToHex(privateKeyWIF, bitcoinNetwork);
  const senderCompressedKey = secp256k1.pointFromScalar(privateKeyHex, true);
  return { senderCompressedKey, privateKeyHex };
}

function getSenderAddress(senderCompressedKey, network = "mainnet") {
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;
  const p2pkh = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(senderCompressedKey, "hex"),
    network: bitcoinNetwork,
  });

  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(senderCompressedKey, "hex"),
    network: bitcoinNetwork,
  });

  // Step 2: Wrap the P2WPKH in a P2SH payment
  const p2shP2wpkh = bitcoin.payments.p2sh({
    redeem: p2wpkh,
    network: bitcoinNetwork,
  });

  return {
    p2pkh: p2pkh.address,
    p2wpkh: p2wpkh.address,
    p2shP2wpkh: p2shP2wpkh.address,
  };
}

async function preimageHash(
  selectedUTXOs,
  totalInputValue,
  estimatedFee,
  senderAddress,
  compressedPubKey,
  network = "mainnet"
) {
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;
  // Outputs
  let outputs = new Array();
  if (totalInputValue - sendAmount - estimatedFee == 0) {
    outputs = [
      {
        amount: sb.toSatoshi(sendAmount.toFixed(8)), // Amount in satoshis
        scriptPubKey: bitcoin.address.toOutputScript(receiver, bitcoinNetwork), // Recipient's P2PKH scriptPubKey
      },
    ];
  } else {
    outputs = [
      {
        amount: sb.toSatoshi(sendAmount.toFixed(8)), // Amount in satoshis
        scriptPubKey: bitcoin.address.toOutputScript(receiver, bitcoinNetwork), // Recipient's P2PKH scriptPubKey
        address: receiver,
      },
      {
        amount: sb.toSatoshi(
          (totalInputValue - sendAmount - estimatedFee).toFixed(8)
        ), // Change amount in satoshis
        scriptPubKey: bitcoin.address.toOutputScript(
          senderAddress,
          bitcoinNetwork
        ), // Change address scriptPubKey
        address: senderAddress,
      },
    ];
  }
  let allTxHash = new Array();
  for (let i = 0; i < selectedUTXOs.length; i++) {
    if (
      getAddressType(selectedUTXOs[i].scriptPubKey) == "P2WPKH" ||
      getAddressType(selectedUTXOs[i].scriptPubKey) == "P2SH"
    ) {
      allTxHash[i] = createP2WPKHreimageHash(
        selectedUTXOs,
        outputs,
        i,
        compressedPubKey,
        bitcoin.Transaction.SIGHASH_ALL
      );
    } else if (getAddressType(selectedUTXOs[i].scriptPubKey) == "P2PKH") {
      allTxHash[i] = createP2PKHPreimageHash(
        selectedUTXOs,
        outputs,
        i,
        bitcoin.Transaction.SIGHASH_ALL
      );
    } else {
      throw new Error("Invalid bitcoin sender address");
    }
  }
  return { allTxHash, outputs };
}

async function main(network, feeRate, optionForChange) {
  // 1. This can be considered as information in wallet
  const { senderCompressedKey, privateKeyHex } = await getCompressedPubKey(
    network
  );
  // 2. This part is run in app
  let allUtxo = [];
  const allTypeAddress = getSenderAddress(senderCompressedKey, network);

  let queryResP2WPKH = await getUTXOs(allTypeAddress.p2wpkh);
  allUtxo.push(queryResP2WPKH);

  let queryResP2SHP2WPKH = await getUTXOs(allTypeAddress.p2shP2wpkh);
  allUtxo.push(queryResP2SHP2WPKH);

  let queryResP2PKH = await await getUTXOs(allTypeAddress.p2pkh);
  allUtxo.push(queryResP2PKH);

  allUtxo = allUtxo.flat(Infinity);
  const { selectedUTXOs, totalInputValue, estimatedFee } = getRequiredUTXOs(
    allUtxo,
    sendAmount,
    feeRate
  );

  let allTxHash = new Array();
  let outputs;
  let changeAddress;
  if (optionForChange == "P2WPKH") {
    changeAddress = allTypeAddress.p2wpkh;
  } else if (optionForChange == "P2SH-P2WPKH") {
    changeAddress = allTypeAddress.p2shP2wpkh;
  } else if (optionForChange == "P2PKH") {
    changeAddress = allTypeAddress.p2pkh;
  }

  ({ allTxHash, outputs } = await preimageHash(
    selectedUTXOs,
    totalInputValue,
    estimatedFee,
    changeAddress,
    senderCompressedKey,
    network
  ));

  // 3, In this part, preimage hash is sent into wallet to perform siganture. Preimage Hash is an array (or buffer), not 1 single preimage hash like in ETH
  // Each UTXO is corresponding to a different preimage hash
  let rsValues = [];
  for (let i = 0; i < allTxHash.length; i++) {
    let signature = secp256k1.sign(
      Buffer.from(allTxHash[i]),
      Buffer.from(privateKeyHex)
    );
    let r = Buffer.from(signature.slice(0, 32)).toString("hex");
    let s = Buffer.from(signature.slice(32)).toString("hex");
    s = ensureLowS(s);
    rsValues.push({ r, s });
  }

  // 4. In this Part, signature r and s are sent to app to perform some changes and then broadcast to network
  for (let i = 0; i < allTxHash.length; i++) {
    rsValues[i].s = ensureLowS(rsValues[i].s);
  }
  const txbuilt = createSignedAllTransaction(
    selectedUTXOs,
    outputs,
    rsValues,
    senderCompressedKey
  );

  broadcastTransaction([txbuilt], rpcHost, rpcPort, rpcUser, rpcPassword);
}

main("regtest", tx_fee_medium, "P2WPKH");
