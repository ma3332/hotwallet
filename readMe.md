Note:

- Regtest Bitcoin giong nhu Ganache Local cua ETH. Tuy nhien no kem hon o diem do la moi khi thuc hien mot giao dich tren bitcoinjs va broadcast len local blockchain xong thi phai vao terminal chay bitcoin-cli de mint 1 block va xac nhan giao dich do.
- Diem thu 2 can luu y la neu tao 1 wallet voi bitcoin-cli thi wallet do thuoc ve bicoin-core (tuc la bitcoin core luu tru privateKey cua cac wallet nay). Neu tao 1 wallet voi bitcoinjs-lib thi wallet do khong thuoc ve bitcoin-core.
- Kiem tra balance cua cac wallet thuoc ve bitcoin core: bitcoin-cli -regtest listunspent
- Kiem tra balance cua cac wallet khong thuoc ve bitcoin core: bitcoin-cli -regtest scantxoutset start '["addr(bcrt1qexampleaddress)"]'
- Bitcoin co cac loai address khac nhau:
  P2PKH: legacy, Starts with 1
  P2SH: Script Hash Addresses, Starts with 3, Supports advanced features like multi-signature wallets
  SegWit: Starts with bc1,
  Tam thoi tap trung vao Legacy va Segwit, boi vi chua nghi toi multi-sig

1. Download Bitcoin:
   https://bitcoin.org/en/download
2. Unzip and install:
   https://bitcoin.org/en/full-node#linux-instructions
   Linux cmd for bitcoin ver 27.0: sudo install -m 0755 -o root -g root -t /usr/local/bin bitcoin-27.0/bin/\*
3. Create the Bitcoin configuration directory:
   mkdir -p ~/.bitcoin
4. Create a bitcoin.conf file in the directory:
   nano ~/.bitcoin/bitcoin.conf
5. Add the following configuration for regtest mode
   regtest=1
   server=1
   daemon=1
   rpcuser=yourusername
   rpcpassword=yourpassword
   rpcallowip=127.0.0.1
   fallbackfee=0.0001
   txindex=1
6. Start the Bitcoin daemon in regtest mode, with the -txindex option (for getrawtransaction RPC command)
   bitcoind -regtest -txindex -daemon
7. Create a new wallet
   bitcoin-cli -regtest createwallet <wallet-name>
   ex: bitcoin-cli -regtest createwallet "testwallet"
8. Load wallet (in case of restart bitcoin regtest)
   bitcoin-cli -regtest loadwallet <wallet-name>
   ex: bitcoin-cli loadwallet "testwallet"
9. Generate a new wallet and this wallet will be stored in bitcoin-core, which including its privateKey
   bitcoin-cli -regtest getnewaddress // return for example: bcrt1qz5f6kts27vq6rer3qkwdzfr0zlptwgyetwlm6m
10. Generate 1st 101 Blocks to Fund the Wallet (miner):
    bitcoin-cli -regtest generatetoaddress 101 bcrt1qz5f6kts27vq6rer3qkwdzfr0zlptwgyetwlm6m
11. Check the Wallet Balance
    bitcoin-cli -regtest getbalance
12. Generate a new block to confirm transaction
    bitcoin-cli -regtest generatetoaddress 1 $(bitcoin-cli -regtest getnewaddress) // new random miner
    or
    bitcoin-cli -regtest generatetoaddress 1 bcrt1qz5f6kts27vq6rer3qkwdzfr0zlptwgyetwlm6m // previous created miner
13. Check the transaction details
    bitcoin-cli -regtest gettransaction <txid>
14. Check balance of the receiving address
    bitcoin-cli -regtest listunspent // this is for wallet that is stored in bitcoin-core (step 9)
    bitcoin-cli -regtest scantxoutset start '["addr(bcrt1qexampleaddress)"]' // this is for wallet that is generated outside of bitcoin-core (for example in step 15)
15. Run file KeyBitcoin_encrypt.js // to generate some random bitcoin address :P2WPKH", "P2SH-P2WPKH", "P2PKH"
16. Send Bitcoin from the miner's wallet to the new address generated above (remember that if we restart shut down or bitcoin network, we need to load wallet in order to perform this step. Load wallet is wallet of miner, which is generated in step 7 and 8)
    bitcoin-cli -regtest sendtoaddress <address> <amount>
    Note that for the same privateKey, there are 5 different types of bitcoin address can be generated.
17. Repeat step 16 for several times to generated many UTXOs

How to test:

19. Make sure local bitcoin network is running: bitcoind -regtest
20. In btcAll.js:

- Change line 67, 68, 69 according to result from step 15
- optionForChange: can be "P2WPKH", "P2SH-P2WPKH", "P2PKH". Note that for the same privateKey, there are 5 different types of bitcoin address can be generated.
- Read comment step in file main
- sendAmount in line 30 << amount of bitcoin sent to sender in step 16 to make sure that wallet will perform 1 signature only
  (for multi signature, code in wallet need to be changed)
