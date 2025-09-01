# ZK Payment Mixer

Privacy-focused ETH mixer using zk-SNARKs (Groth16). Fixed 0.1 ETH deposits, anonymous withdrawals via Merkle inclusion + nullifier

- Circuits: `circuits/withdraw.circom`
- Contracts: `contracts/Mixer.sol`, `contracts/Verifier.sol`
- Scripts: compile circuits, generate proof, deploy contracts
- Tests: `test/mixer.test.js`
- Frontend (optional): React + Ethers

Quick start:

```bash
npm i -g circom snarkjs # tools
npm install
npx hardhat compile
node scripts/compile-circuit.js
npx hardhat node &
npx hardhat run scripts/deploy.js --network localhost
```

Set `REACT_APP_MIXER_ADDRESS` then run frontend:

```bash
cd frontend && npm install && npm start
```

Use at your own risk. Demo verifier placeholder until snarkjs exports Solidity verifier.
