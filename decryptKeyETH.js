const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');

async function decryptPrivateKey(filePath, password) {
  try {
    // Read the encrypted JSON file
    const encryptedJson = await fs.readFile(filePath, 'utf8');

    // Decrypt the wallet
    const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, password);

    console.log('Decrypted Private Key:', wallet.privateKey);
    console.log('Ethereum Address:', wallet.address);
  } catch (error) {
    console.error('Error decrypting the private key:', error);
  }
}

// Example usage
const filePath = path.join(__dirname, 'encrypted-keys', '0xeD1fE782FFB46D0dB94a8015F52d635Cc2275293.json');
const password = 'your-secure-password'; // Replace with the password used for encryption

decryptPrivateKey(filePath, password);