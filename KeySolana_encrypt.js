const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const bip39 = require("bip39");
const { derivePath } = require("ed25519-hd-key");

async function generateKeyPair() {
  const mnemonic = bip39.generateMnemonic(256); // 24 words
  console.log("Mnemonic:", mnemonic);
  // Get the public key (Solana address)
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derivationPath = "m/44'/501'/0'/0'";
  const derivedSeed = derivePath(derivationPath, seed.toString("hex")).key;

  // Generate the keypair
  const keypair = Keypair.fromSeed(derivedSeed);
  const publicKey = keypair.publicKey.toBase58();

  // Get the private key (secret key)
  const privateKey = keypair.secretKey.toString();

  return {
    publicKey: publicKey,
    privateKey: `[${privateKey}]`, // Optional: Display as an array
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
async function saveEncryptedPrivateKey(data, storageFolder, publicKey) {
  try {
    // Ensure the folder exists
    await fs.ensureDir(storageFolder);

    // Define the file path
    const filePath = path.join(storageFolder, `${publicKey}.json`);

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
  const { publicKey, privateKey } = await generateKeyPair();

  console.log("Solana Address:", publicKey);
  console.log("Solana Private Key:", privateKey);

  // Define the password for encryption
  const password = "your-secure-password"; // Replace with a strong password

  // Encrypt the private key
  const { encryptedPrivateKey, iv, salt } = encryptPrivateKey(
    privateKey,
    password
  );

  // Prepare the data to be saved
  const data = {
    publicKey,
    encryptedPrivateKey,
    iv,
    salt,
  };

  // Define the folder where the encrypted private key will be stored
  const storageFolder = path.join(__dirname, "encrypted-keys-solana");

  // Save the encrypted private key to a file
  await saveEncryptedPrivateKey(data, storageFolder, publicKey);
}

main();
