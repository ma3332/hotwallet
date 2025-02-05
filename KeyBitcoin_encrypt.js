const bitcoin = require("bitcoinjs-lib");
const assert = require("assert");
const ECPairFactory = require("ecpair").ECPairFactory;
const tinysecp = require("tiny-secp256k1");
const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const { type } = require("os");
const bip39 = require("bip39");
const { BIP32Factory } = require("bip32");

// Function to generate a Bitcoin keypair from random Mnemonic words
async function generateBitcoinKeypair(option, network = "mainnet") {
  // Define the network
  const bitcoinNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.regtest;
  const mnemonic = bip39.generateMnemonic(256); // 24 words
  console.log("Mnemonic:", mnemonic);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const bip32 = BIP32Factory(tinysecp);
  const root = bip32.fromSeed(seed, bitcoinNetwork);
  const path = "m/44'/1'/0'/0/0"; // '1' is used for testnet/regtest
  const child = root.derivePath(path);

  let { addressInfo } = {};

  if (option == "P2PKH") {
    addressInfo = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
      network: bitcoinNetwork,
    });
  } else if (option == "P2SH-P2WPKH") {
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoinNetwork,
    });

    // Step 2: Wrap the P2WPKH in a P2SH payment
    addressInfo = bitcoin.payments.p2sh({
      redeem: p2wpkh,
      network: bitcoinNetwork,
    });
  } else if ((option = "P2WPKH")) {
    addressInfo = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoinNetwork,
    });
  } else {
    throw new Error("Not Correct Address Type");
  }

  const privateKeyWIF = child.toWIF();

  // bitcoin P2PKH addresses start with a '1'
  // bitcoin p2wpkh addresses start with a '1'
  // if (option == 1) {
  //   assert.strictEqual(address.address.startsWith("1"), true);
  // } else {
  //   assert.strictEqual(address.address.startsWith("bc"), true);
  // }
  console.log(child.publicKey);
  const address = addressInfo.address;
  return {
    address,
    privateKeyWIF,
  };
}

// Function to encrypt the private key
function encryptPrivateKey(privateKey, password) {
  // Create a random initialization vector (IV)
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);

  // Create a cipher using AES-256-CBC
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    crypto.scryptSync(password, salt, 32),
    iv
  );

  // Encrypt the private key
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return the encrypted private key and IV
  return {
    encryptedPrivateKey: encrypted,
    iv: iv.toString("hex"),
    salt,
  };
}

// Function to save the encrypted private key to a file
async function saveEncryptedPrivateKey(data, folderPath, address) {
  try {
    // Ensure the folder exists
    await fs.ensureDir(folderPath);

    // Define the file path
    const filePath = path.join(folderPath, `${address}.json`);

    // Write the encrypted private key and metadata to the file
    await fs.writeJson(filePath, data, { spaces: 2 });

    console.log(`Encrypted private key saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving the encrypted private key:", error);
  }
}

// Main execution
async function main(option, network) {
  // Generate a Bitcoin keypair
  const { address, privateKeyWIF } = await generateBitcoinKeypair(
    option,
    network
  );

  console.log("Bitcoin Address:", address);
  console.log("Private Key (WIF):", privateKeyWIF);

  // Define the password for encryption
  const password = "your-secure-password"; // Replace with a strong password

  // Encrypt the private key
  const { encryptedPrivateKey, iv, salt } = encryptPrivateKey(
    privateKeyWIF,
    password
  );

  // Prepare the data to be saved
  const data = {
    address,
    encryptedPrivateKey,
    iv,
    salt,
  };

  // Define the folder where the encrypted private key will be stored
  const storageFolder = path.join(__dirname, "encrypted-keys-bitcoin");

  // Save the encrypted private key to a file
  await saveEncryptedPrivateKey(data, storageFolder, address);
}

main("P2PKH", "regtest");
