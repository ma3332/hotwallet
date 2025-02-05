/\* ref:

- Wallet Dev for Segwit: https://bitcoincore.org/en/segwit_wallet_dev/
- BIP-143 BTC Unsigned and Signed Transaction Serialization: https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki
  \*/

Example 4: sending Any BTC address to Any BTC address
Remember that different type of BTC address can be derived from the same private key
Sending amount of 0.0015 BTC
Address "sendFrom": tb1qytl5fqzk20suz4shmj7a4cmxe6hqdjy8adrvjz || mkHS9ne12qx9pS9VojpwU5xtRd4T7X7ZUt || 2N3oefVeg6stiTb5Kh3ozCSkaqmx91FDbsm
Address "sendTo": msWdzwZEfBwU65oAjhBPRJPSWVvUBJXc9Y || 2N3xQmZDNGBe7V6UKuYoP4KC33LUJoevNEP || tb1qanmm88fff5xj2dn3u2z4h49nvl6rj4urgd3yfg
scriptPubKey of "sendTo": Depend of Type of Address, however address can be mixed
scriptPubKey of "change" (which is also "sendFrom")

/\* How to construct message to be signed ? (example of 2 inputs P2PKH, 1 input P2SH-P2WPKH, 1 input P2WPKH and 2 arbitrary outputs)
This below rules are only applied to "P2WPKH" and "P2SH-P2WPKH" and "sigHash" = 0x01 (signature applies to all the inputs and the outputs)

Case 1: there is no UTXO from "P2WPKH" or "P2SH-P2WPKH" address
-> Build message (Hash Preimage) according to P2PKH method

Case 2: there is at least one UTXO from "P2WPKH" or "P2SH-P2WPKH" address

2.1 Sign P2PKH UTXOs (if any)
Note: only Current UTXO going to signed is set with scriptPubKey, all others with "00"

- Message for signed of UTXO_1 = nVersion + numberInput + Prevouts of UXTO_1 + scriptPubKey of UXTO_1 + sequence of UXTO_1 + Prevouts of UXTO_2 + 00 + "" + sequence of UXTO_2 + Prevouts of UXTO_3 + 00 + "" + sequence of UXTO_3 + Prevouts of UXTO_4 + 00 + "" + sequence of UXTO_4 + Little Endian of amount output_1 + scriptPubKey of output_1 + Little Endian of amount output_2 + scriptPubKey of output_2 + nLockTime + nHashType
- Message for signed of UTXO_2 = nVersion + numberInput + Prevouts of UXTO_1 + 00 + "" + sequence of UXTO_1 + Prevouts of UXTO_2 + scriptPubKey of UXTO_2 + sequence of UXTO_2 + Prevouts of UXTO_3 + 00 + "" + sequence of UXTO_3 + Prevouts of UXTO_4 + 00 + "" + sequence of UXTO_4 + Little Endian of amount output_1 + scriptPubKey of output_1 + Little Endian of amount output_2 + scriptPubKey of output_2 + nLockTime + nHashType

nVersion (4-byte little endian)
numberInput (1 to 9 bytes )
Prevouts of UTXO_1 = PreviousID UTXO_1 (32 bytes) + PreviousVout UTXO_1 (4 bytes LE)
scriptPubKey of UTXO_1: {19} + {76} + {a9} + {14} + {20-byte-pubkey-hash} + {88} + {ac}
sequence of UTXO_1: "ffffffff"
nLockTime: "00000000"
nHashType: "01000000"

2.2 Sign "P2WPKH" or "P2SH-P2WPKH" UTXOs (if any)

- Message for signed of UXTO_3 = nVersion + hashPrevouts + hashSequence + outpoint UTXO_3 + scriptCode UTXO_3 + amount taken from UTXO_3 + sequence of UXTO_3 + hashOutputs + nLockTime + nHashType
- Message for signed of UXTO_4 = nVersion + hashPrevouts + hashSequence + outpoint UTXO_4 + scriptCode UTXO_4 + amount taken from UTXO_4 + sequence of UXTO_4 + hashOutputs + nLockTime + nHashType

nVersion (4-byte little endian)
hashPrevouts (32-byte hash): dSHA256(PreviousID UTXO_1 + PreviousVout UTXO_1 + PreviousID UTXO_2 + PreviousVout UTXO_2 + PreviousID UTXO_3 + PreviousVout UTXO_3 + PreviousID UTXO_4 + PreviousVout UTXO_4)
hashSequence (32-byte hash): dSHA256(sequence of UXTO_1 + sequence of UXTO_2 + sequence of UXTO_3 + sequence of UXTO_4)
outpoint (32-byte hash + 4-byte little endian)
scriptCode of input corresponding to that UTXO: {19} + {76} + {a9} + {14} + {20-byte-pubkey-hash} + {88} + {ac}
amount taken from that UTXO (8-byte little endian)
nSequence from that UTXO (4-byte little endian)
hashOutputs: dSHA256(Little Endian of amount output_1 + scriptPubKey of output_1 + Little Endian of amount output_2 + scriptPubKey of output_2)
nLocktime of transaction (4-byte little endian)
sighash type of the signature (4-byte little endian): 01000000

The result is DER Signatures, which are constructed from r and s
\*/

/\* How to construct signed message and broadcast to Bitcoin Network ?

Note:
<scriptSig of P2SH-P2WPKH> = "17" + "16" + "00" + "14" + hash160(compressedPubKey) (or can be called "20-byte-pubkey-hash")
<scriptSig of P2WPKH> = "00"
<scriptSig of P2PKH> = <Der Signature> <Compressed PublicKey>
<scriptPubKey of P2PKH> = OP_DUP + OP_HASH160 + <pubKeyHash> + OP_EQUALVERIFY + OP_CHECKSIG
<scriptPubKey of P2SH-P2WPKH> = OP_HASH160 + <redeemScripHash> + OP_EQUAL
<scriptPubKey of P2WPKH> = 00 + <pubKeyHash>
<pubKeyHash> = RIPEMD-160(SHA-256(publicKey))
<redeemScripHash> = RIPEMD-160(SHA-256(redeemScript))
<redeemScript> = OP_0 <pubKeyHash>

Case 1: there is no UTXO from "P2WPKH" or "P2SH-P2WPKH" address

    nVersion:  4 bytes (01000000 || 02000000)
    txin:      02 <Previous UTXO_1 ID> <Previous UTXO_1 ID Corresponding vout> <scriptSig P2PKH for UTXO_1> <Sequence UTX0_1>
                  <Previous UTXO_2 ID> <Previous UTXO_2 ID Corresponding vout> <scriptSig P2PKH for UTXO_2> <Sequence UTX0_2>
    txout:     02 <8 bytes LE of amount output_1> <scriptPubKey of output_1: according to type of address destination>
                  <8 bytes LE of amount output_2> <scriptPubKey of output_2: according to type of address destination>
    nLockTime: 00000000

Case 2: there is at least one UTXO from "P2WPKH" or "P2SH-P2WPKH" address
Example below: 1st Two UTXOs from "P2WPKH" and "P2SH-P2WPKH" address; last Two UTXOs from P2PKH address

    nVersion:  4 bytes (01000000 || 02000000)
    marker:    1 byte (00)
    flag:      1 byte (01)
    txin:      04 <Previous UTXO_1 ID> <Previous UTXO_1 ID Corresponding vout> <scriptSig P2WPKH for UTXO_1> <Sequence UTX0_1>
                  <Previous UTXO_2 ID> <Previous UTXO_2 ID Corresponding vout> <scriptSig P2SH-P2WPKH for UTXO_2> <Sequence UTX0_2>
                  <Previous UTXO_3 ID> <Previous UTXO_3 ID Corresponding vout> <scriptSig P2PKH for UTXO_3> <Sequence UTX0_3>
                  <Previous UTXO_4 ID> <Previous UTXO_4 ID Corresponding vout> <scriptSig P2PKH for UTXO_4> <Sequence UTX0_4>
    txout:     02 <8 bytes LE of amount output_1> <scriptPubKey of output_1: according to type of address destination>
                  <8 bytes LE of amount output_2> <scriptPubKey of output_2: according to type of address destination>
    witness    02 <Der Signature Part of Signer for UTXO_1> <Compressed PubKey Part of Signer for UXTO_1>
               02 <Der Signature Part of Signer for UTXO_2> <Compressed PubKey Part of Signer for UXTO_2>
               00
               00
    nLockTime: 00000000
