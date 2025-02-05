const { ethers } = require("ethers");
const fs = require("fs-extra");
const path = require("path");

// Function to generate Ethereum keypair
async function generateEthereumKeypair(password, folderPath) {
  try {
    // Create a random wallet
    const wallet = ethers.Wallet.createRandom();

    console.log("Ethereum Address:", wallet.address);
    console.log("Mnemonic Phrase (Keep this safe!):", wallet.mnemonic.phrase);

    // Encrypt the private key with the provided password
    const encryptedJson = await wallet.encrypt(password);

    // Ensure the folder exists
    await fs.ensureDir(folderPath);

    // Define the file path
    const filePath = path.join(folderPath, `${wallet.address}.json`);

    // Save the encrypted private key to the file
    await fs.writeFile(filePath, encryptedJson);

    console.log(`Encrypted private key saved to ${filePath}`);
  } catch (error) {
    console.error("Error generating or saving the keypair:", error);
  }
}

// Main execution
async function main() {
  // Define the password for encryption
  const password = "your-secure-password"; // Replace with a strong password

  // Define the folder where the encrypted private key will be stored
  const storageFolder = path.join(__dirname, "encrypted-keys");

  // Generate and save the Ethereum keypair
  await generateEthereumKeypair(password, storageFolder);
}

main();
