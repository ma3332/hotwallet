const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
var bs58 = require("bs58");

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

const filePath = path.join(
  __dirname,
  "encrypted-keys-solana",
  "JbEdWhdvGB2b9CwXgdgmu1nYLQVA2gSgT5AgQUtc4UG.json"
);

const receiver = "FiXAQ6DJRWK81chRQCARXRYNdjBR2MNV5mSr1PSkCyh3";

// Connect to the Devnet
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  const data = await fs.readJson(filePath);

  // Define the password used for encryption
  const password = "your-secure-password"; // Replace with the password used for encryption

  // Decrypt the private key
  const privateKey = decryptPrivateKey(
    data.encryptedPrivateKey,
    data.iv,
    password,
    Buffer.from(data.salt.data)
  );

  const privateTemp = Array.from(/*  */ privateKey)
    .filter((char) => !"[]{}()".includes(char)) // Remove all brackets
    .join("");
  const privateKeyArray = Uint8Array.from(privateTemp.split(",").map(Number));

  // Load the sender's keypair from a file (replace with your keypair file path)
  const senderKeypair = Keypair.fromSecretKey(privateKeyArray);

  const senderBalance = await connection.getBalance(senderKeypair.publicKey);

  console.log(senderKeypair.publicKey);

  console.log("Sender balance:", senderBalance / LAMPORTS_PER_SOL, "SOL");

  // Create a transaction to send 0.1 SOL
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: receiver,
      lamports: 0.1 * LAMPORTS_PER_SOL, // Amount in lamports (1 SOL = 1e9 lamports)
    })
  );
  // Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    senderKeypair,
  ]);

  const receiverPub = new PublicKey(receiver);
  const recipientBalance = await connection.getBalance(receiverPub);
  console.log("Recipient balance:", recipientBalance / LAMPORTS_PER_SOL, "SOL");
}

main();
