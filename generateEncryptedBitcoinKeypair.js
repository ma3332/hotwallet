const bitcoin = require("bitcoinjs-lib");
const assert = require("assert");
const ECPairFactory = require("ecpair").ECPairFactory;
const tinysecp = require("tiny-secp256k1");
const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");

// Function to generate a Bitcoin keypair
function generateBitcoinKeypair(option) {
  // Create an ECPair instance
  const ECPair = ECPairFactory(tinysecp);
  // Generate a random keypair
  const keyPair = ECPair.makeRandom();

  // Get the private key in WIF (Wallet Import Format)
  const privateKeyWIF = keyPair.toWIF();

  let { address } = {};

  if (option == "1") {
    address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
  } else {
    address = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
  }

  // bitcoin P2PKH addresses start with a '1'
  // bitcoin p2wpkh addresses start with a '1'
  if (option == 1) {
    assert.strictEqual(address.address.startsWith("1"), true);
  } else {
    assert.strictEqual(address.address.startsWith("bc1"), true);
  }
  return {
    address,
    privateKeyWIF,
  };
}

// Function to encrypt the private key
function encryptPrivateKey(privateKey, password) {
  // Create a random initialization vector (IV)
  const iv = crypto.randomBytes(16);

  // Create a cipher using AES-256-CBC
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    crypto.scryptSync(password, "salt", 32),
    iv
  );

  // Encrypt the private key
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return the encrypted private key and IV
  return {
    encryptedPrivateKey: encrypted,
    iv: iv.toString("hex"),
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
async function main() {
  // Generate a Bitcoin keypair
  const { address, privateKeyWIF } = generateBitcoinKeypair(4);

  console.log("Bitcoin Address:", address.address);
  console.log("Private Key (WIF):", privateKeyWIF);

  // Define the password for encryption
  const password = "your-secure-password"; // Replace with a strong password

  // Encrypt the private key
  const { encryptedPrivateKey, iv } = encryptPrivateKey(
    privateKeyWIF,
    password
  );

  // Prepare the data to be saved
  const data = {
    address,
    encryptedPrivateKey,
    iv,
  };

  // Define the folder where the encrypted private key will be stored
  const storageFolder = path.join(__dirname, "encrypted-keys-bitcoin");

  // Save the encrypted private key to a file
  await saveEncryptedPrivateKey(data, storageFolder, address);
}

main();
