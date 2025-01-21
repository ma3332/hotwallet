const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

function decryptPrivateKey(encryptedPrivateKey, iv, password) {
  // Create a decipher using AES-256-CBC
  const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(password, 'salt', 32), Buffer.from(iv, 'hex'));

  // Decrypt the private key
  let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function main() {
  // Define the file path
  const filePath = path.join(__dirname, 'encrypted-keys-bitcoin', '1JyuY6wLhbMG7wp3AuHuAscU92JKEaS1PY.json');

  // Read the encrypted JSON file
  const data = await fs.readJson(filePath);

  // Define the password used for encryption
  const password = 'your-secure-password'; // Replace with the password used for encryption

  // Decrypt the private key
  const privateKey = decryptPrivateKey(data.encryptedPrivateKey, data.iv, password);

  console.log('Decrypted Private Key (WIF):', privateKey);
}

main();