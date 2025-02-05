const bitcoin = require("bitcoinjs-lib"); // Install with `npm install bitcoinjs-lib`
const wif = require("wif"); // Install with `npm install wif`
const ECPairFactory = require("ecpair").ECPairFactory;
const tinysecp = require("tiny-secp256k1");
const { bech32 } = require("bech32");
const bs58check = require("bs58check");
const axios = require("axios");
const crypto = require("crypto");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const { Buffer } = require("buffer");
const { script: bitcoinScript } = bitcoin;
const bip66 = require("bip66");
const secp256k1 = require("secp256k1");
const BN = require("bn.js");
const asn1 = require("asn1.js");
const sb = require("satoshi-bitcoin");

const ECDSASignature = asn1.define("ECDSASignature", function () {
  this.seq().obj(
    this.key("r").int(), // r is an integer
    this.key("s").int() // s is an integer
  );
});

function validatePositiveHex(hex) {
  const bn = new BN(hex, 16);
  if (bn.isNeg()) {
    throw new Error("r or s must be positive!");
  }
  return bn;
}

function computePublicKeyHash(publicKeyBufferHex) {
  const sha256Hash = crypto
    .createHash("sha256")
    .update(publicKeyBufferHex)
    .digest();
  const ripemd160Hash = crypto
    .createHash("ripemd160")
    .update(sha256Hash)
    .digest();
  return ripemd160Hash.toString("hex");
}

function convertToDERSignature(rHex, sHex) {
  // Convert r and s from hex to BN (BigNumber)
  const r = validatePositiveHex(rHex);
  const s = validatePositiveHex(sHex);

  // Encode r and s into DER format
  const derSignature = ECDSASignature.encode({ r, s }, "der");

  // Return the DER signature as a hex string
  return derSignature.toString("hex");
}

function ensureLowS(s) {
  // Convert s from hex to a BigNumber
  const sBN = new BN(s, 16);

  // Ensure s is in the lower half of the curve's order
  const n = ec.curve.n; // Curve order
  const halfN = n.shrn(1); // n / 2
  let adjustedS = sBN;

  if (sBN.cmp(halfN) > 0) {
    adjustedS = n.sub(sBN); // Replace s with n - s
  }

  // Convert adjusted s back to a hex string, ensuring it is 32 bytes (64 hex characters)
  const adjustedSHex = adjustedS.toString(16).padStart(64, "0");

  // Return the adjusted signature as a concatenated hex string (r + adjusted s)
  return adjustedSHex;
}

function privateKeyWIFToHex(privateKeyWIF, network = "mainnet") {
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;
  const ECPair = ECPairFactory(tinysecp);
  // Decode the WIF to get the private key
  const keyPair = ECPair.fromWIF(privateKeyWIF, bitcoinNetwork);

  // Extract the private key in hexadecimal format
  const privateKeyHex = keyPair.privateKey;

  return privateKeyHex;
}

function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0")) // Convert each byte to hex and pad with 0 if needed
    .join(""); // Join all hex values into a single string
}

function privateKeyWIFToAllAddresses(wifKey, network = "mainnet", option) {
  // Define the network
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;

  const ECPair = ECPairFactory(tinysecp);
  // Decode the WIF to get the private key
  const privateKey = wif.decode(wifKey).privateKey;

  // Generate the key pair
  const keyPair = ECPair.fromPrivateKey(privateKey, {
    network: bitcoinNetwork,
  });
  const publicKey = keyPair.publicKey;
  let legacyAddress, p2shSegWitAddress, nativeSegWitAddress;
  if (option == "p2pkh") {
    legacyAddress = bitcoin.payments.p2pkh({
      pubkey: publicKey,
      network: bitcoinNetwork,
    }).address;
    return legacyAddress;
  } else if (option == "p2sh-segwit") {
    p2shSegWitAddress = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: publicKey,
        network: bitcoinNetwork,
      }),
      network: bitcoinNetwork,
    }).address;
    return p2shSegWitAddress;
  } else if (option == "p2wpkh") {
    nativeSegWitAddress = bitcoin.payments.p2wpkh({
      pubkey: publicKey,
      network: bitcoinNetwork,
    }).address;
    return nativeSegWitAddress;
  } else if (option == "all") {
    return {
      legacyAddress,
      p2shSegWitAddress,
      nativeSegWitAddress,
    };
  } else {
    throw new Error("Require Option");
  }
}

function getRequiredUTXOs(utxos, amountToSend, feeRate) {
  let totalInputValue = 0;
  let selectedUTXOs = [];
  let estimatedFee = 0;

  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];
    selectedUTXOs.push(utxo);
    totalInputValue += utxo.amount;

    // Estimate transaction size: (inputs × 148) + (outputs × 34) + 10
    const transactionSize = selectedUTXOs.length * 148 + 2 * 34 + 10; // 2 outputs: recipient + change
    estimatedFee = transactionSize * feeRate;

    // Check if total input value covers the amount and fee
    if (totalInputValue >= amountToSend + estimatedFee) {
      return {
        selectedUTXOs,
        totalInputValue,
        estimatedFee,
      };
    }
  }

  // If we exit the loop, there aren't enough UTXOs to cover the amount
  throw new Error("Insufficient UTXOs to cover the amount and fee.");
}

// Function to broadcast the transaction
async function broadcastTransaction(
  params = [],
  rpcHost,
  rpcPort,
  rpcUser,
  rpcPassword
) {
  try {
    const response = await axios.post(
      `http://${rpcHost}:${rpcPort}`,
      {
        jsonrpc: "1.0",
        id: "curltest",
        method: "sendrawtransaction",
        params: params,
      },
      {
        auth: {
          username: rpcUser,
          password: rpcPassword,
        },
      }
    );

    console.log("Transaction broadcasted successfully!");
    console.log("Transaction ID:", response.data.result);
  } catch (error) {
    console.error(
      "Error broadcasting transaction:",
      error.response.data.error.message
    );
  }
}

async function fetchNonWitnessUtxo(
  txid,
  rpcHost,
  rpcPort,
  rpcUser,
  rpcPassword
) {
  try {
    // Prepare the RPC request payload
    const payload = {
      jsonrpc: "1.0",
      id: "fetchrawtransaction",
      method: "getrawtransaction",
      params: [txid, false], // `false` returns the raw transaction hex
    };

    // Send the POST request to Bitcoin Core
    const response = await axios.post(`http://${rpcHost}:${rpcPort}`, payload, {
      auth: {
        username: rpcUser,
        password: rpcPassword,
      },
    });

    // Handle the response
    return response.data.result;
  } catch (error) {
    console.error(
      "Error querying scantxoutset:",
      error.response ? error.response.data.error : error.message
    );
  }
}

async function queryScantxoutset(
  address,
  rpcHost,
  rpcPort,
  rpcUser,
  rpcPassword
) {
  try {
    // Prepare the RPC request payload
    const payload = {
      jsonrpc: "1.0",
      id: "scantxoutset",
      method: "scantxoutset",
      params: [
        "start", // Action to perform
        [`addr(${address})`], // Address to scan
      ],
    };

    // Send the POST request to Bitcoin Core
    const response = await axios.post(`http://${rpcHost}:${rpcPort}`, payload, {
      auth: {
        username: rpcUser,
        password: rpcPassword,
      },
    });

    // Handle the response
    return response.data.result;
  } catch (error) {
    console.error(
      "Error querying scantxoutset:",
      error.response ? error.response.data.error : error.message
    );
  }
}

function decryptPrivateKey(encryptedPrivateKey, iv, password, salt) {
  // Create a decipher using AES-256-CBC
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    crypto.scryptSync(password, salt, 32),
    Buffer.from(iv, "hex")
  );

  // Decrypt the private key
  let decrypted = decipher.update(encryptedPrivateKey, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function getAddressType(scriptPubKey) {
  // Convert the scriptPubKey to a buffer for easier analysis
  const script = Buffer.from(scriptPubKey, "hex");

  // Check for P2PKH (Pay-to-PubKey-Hash)
  // Format: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
  if (
    script.length === 25 &&
    script[0] === 0x76 && // OP_DUP
    script[1] === 0xa9 && // OP_HASH160
    script[2] === 0x14 && // Push 20 bytes
    script[23] === 0x88 && // OP_EQUALVERIFY
    script[24] === 0xac // OP_CHECKSIG
  ) {
    return "P2PKH";
  }

  // Check for P2SH (Pay-to-Script-Hash)
  // Format: OP_HASH160 <20-byte-hash> OP_EQUAL
  if (
    script.length === 23 &&
    script[0] === 0xa9 && // OP_HASH160
    script[1] === 0x14 && // Push 20 bytes
    script[22] === 0x87 // OP_EQUAL
  ) {
    return "P2SH";
  }

  // Check for P2WPKH (Pay-to-Witness-PubKey-Hash)
  // Format: OP_0 <20-byte-hash>
  if (
    script.length === 22 &&
    script[0] === 0x00 && // OP_0
    script[1] === 0x14 // Push 20 bytes
  ) {
    return "P2WPKH";
  }

  // Check for P2WSH (Pay-to-Witness-Script-Hash)
  // Format: OP_0 <32-byte-hash>
  if (
    script.length === 34 &&
    script[0] === 0x00 && // OP_0
    script[1] === 0x20 // Push 32 bytes
  ) {
    return "P2WSH";
  }

  // If none of the above patterns match, return "Unknown"
  return "Unknown";
}

/* 
<scriptSig of P2SH-P2WPKH> = "17" + "16" + "00" + "14" + hash160(compressedPubKey) (or can be called "20-byte-pubkey-hash")
<scriptSig of P2WPKH> = "00"
<scriptSig of P2PKH> = <Der Signature> <Compressed PublicKey>
<scriptPubKey of P2PKH> = OP_DUP + OP_HASH160 + <pubKeyHash> + OP_EQUALVERIFY + OP_CHECKSIG
<scriptPubKey of P2SH-P2WPKH> = OP_HASH160 + <redeemScripHash> + OP_EQUAL
<scriptPubKey of P2WPKH> = 00 + <pubKeyHash>
*/

function createP2PKHPreimageHash(
  utxos,
  outputs,
  inputIndex,
  sighashType = bitcoin.Transaction.SIGHASH_ALL
) {
  // Create a new transaction
  const tx = new bitcoin.Transaction();

  // Add inputs (UTXOs)
  utxos.forEach((utxo) => {
    tx.addInput(Buffer.from(utxo.txid, "hex").reverse(), utxo.vout);
  });

  outputs.forEach((output) => {
    tx.addOutput(output.scriptPubKey, BigInt(output.amount));
  });

  // Get the UTXO being signed
  const scriptPubKey = utxos[inputIndex].scriptPubKey;
  // Create the preimage hash
  const preimageHash = tx.hashForSignature(
    inputIndex,
    Uint8Array.from(Buffer.from(scriptPubKey, "hex")),
    sighashType
  );

  return preimageHash;
}

function createP2WPKHreimageHash(
  utxos,
  outputs,
  inputIndex,
  compressedPubKey,
  sighashType = bitcoin.Transaction.SIGHASH_ALL
) {
  // Create a new transaction
  const tx = new bitcoin.Transaction();

  // Add inputs (UTXOs)
  utxos.forEach((utxo) => {
    tx.addInput(Buffer.from(utxo.txid, "hex").reverse(), utxo.vout);
  });

  outputs.forEach((output) => {
    tx.addOutput(output.scriptPubKey, BigInt(output.amount));
  });

  // Get the UTXO being signed

  const pkhash160 = bitcoin.crypto.hash160(compressedPubKey);

  // Create the preimage hash
  const preimageHash = tx.hashForWitnessV0(
    inputIndex,
    bitcoin.script.compile([
      bitcoin.opcodes.OP_DUP,
      bitcoin.opcodes.OP_HASH160,
      pkhash160,
      bitcoin.opcodes.OP_EQUALVERIFY,
      bitcoin.opcodes.OP_CHECKSIG,
    ]),
    BigInt(sb.toSatoshi(utxos[inputIndex].amount)), // satoshi and bigInt
    sighashType
  );

  return preimageHash;
}

// Function to create a signed transaction
function createSignedAllTransaction(
  utxos,
  outputs,
  rsValues,
  compressedPubKey
) {
  const tx = new bitcoin.Transaction();

  // Add inputs (UTXOs)
  utxos.forEach((utxo) => {
    tx.addInput(Buffer.from(utxo.txid, "hex").reverse(), utxo.vout);
  });

  outputs.forEach((output) => {
    tx.addOutput(output.scriptPubKey, BigInt(output.amount));
  });

  // Add outputs

  for (let i = 0; i < utxos.length; i++) {
    let { r, s } = rsValues[i];

    let derSignature = convertToDERSignature(r, s);

    // Define the SIGHASH type (e.g., SIGHASH_ALL)
    const sighashType = bitcoin.Transaction.SIGHASH_ALL;

    let finalSignature = Buffer.concat([
      Buffer.from(derSignature, "hex"),
      Buffer.from([sighashType]),
    ]);

    if (getAddressType(utxos[i].scriptPubKey) == "P2PKH") {
      const scriptSig = bitcoin.script.compile([
        Uint8Array.from(finalSignature),
        compressedPubKey,
      ]);
      tx.setInputScript(i, scriptSig);
    } else if (getAddressType(utxos[i].scriptPubKey) == "P2WPKH") {
      tx.setWitness(i, [finalSignature, compressedPubKey]);
    } else if (getAddressType(utxos[i].scriptPubKey) == "P2SH") {
      const pkhash160 = bitcoin.crypto.hash160(compressedPubKey);
      const redeemScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_0,
        pkhash160,
      ]);
      tx.setInputScript(i, bitcoin.script.compile([redeemScript]));
      tx.setWitness(i, [finalSignature, compressedPubKey]);
    } else {
      throw new Error("No Address Type");
    }
  }
  // Build and return the transaction
  return tx.toHex();
}

module.exports = {
  uint8ArrayToHex,
  privateKeyWIFToAllAddresses,
  getRequiredUTXOs,
  queryScantxoutset,
  decryptPrivateKey,
  privateKeyWIFToHex,
  createP2PKHPreimageHash,
  createP2WPKHreimageHash,
  fetchNonWitnessUtxo,
  broadcastTransaction,
  ensureLowS,
  getAddressType,
  createSignedAllTransaction,
};
