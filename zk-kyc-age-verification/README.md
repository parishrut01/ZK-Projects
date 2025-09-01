# 🔐 Zero-Knowledge KYC Age Verification

A complete zero-knowledge proof system for verifying age without revealing personal information. Users can prove they are over 18 years old without disclosing their actual age, using zk-SNARKs and trusted KYC credentials.

## 🌟 Features

- **Privacy-Preserving**: Prove age ≥ 18 without revealing actual age
- **Trusted Credentials**: Uses signed age credentials from KYC providers
- **Smart Contract Integration**: On-chain verification with Solidity contracts
- **Batch Verification**: Efficient verification of multiple users
- **Comprehensive Testing**: Full test suite with edge cases and security tests
- **Production Ready**: Modular, well-documented, and extensible codebase

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   KYC Provider  │    │      User        │    │   Smart Contract│
│                 │    │                  │    │                 │
│ Issues signed   │───▶│ Generates zk     │───▶│ Verifies proof  │
│ age credential  │    │ proof of age≥18  │    │ on-chain        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Components

1. **Circom Circuit** (`circuits/kyc.circom`): Defines the zero-knowledge proof logic
2. **Smart Contracts** (`contracts/`): On-chain verification and user management
3. **Scripts** (`scripts/`): Circuit compilation, proof generation, and deployment
4. **Tests** (`test/`): Comprehensive test suite covering all scenarios

## 🚀 Quick Start

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Install global dependencies
npm install -g circom snarkjs
```

### 1. Compile the Circuit

```bash
npm run compile-circuit
```

This will:
- Compile the Circom circuit
- Download powers of tau ceremony file
- Generate proving and verification keys
- Create the Solidity verifier contract
- Test proof generation

### 2. Deploy Contracts

```bash
# Deploy to local Hardhat network
npx hardhat node  # In another terminal
npm run deploy

# Deploy to testnet (configure .env first)
npm run deploy --network sepolia
```

### 3. Generate Proofs

```bash
npm run generate-proof
```

### 4. Run Tests

```bash
npm test
```

## 📋 Detailed Setup

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

```env
# Private key for deployment (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs
SEPOLIA_URL=https://sepolia.infura.io/v3/your_infura_key

# Optional: Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Step-by-Step Guide

#### 1. Circuit Compilation

The circuit compilation process involves several steps:

```bash
npm run compile-circuit
```

**What happens:**
1. **Circuit Compilation**: Converts `kyc.circom` to R1CS constraint system
2. **Trusted Setup**: Generates proving and verification keys using powers of tau
3. **Verifier Generation**: Creates `Verifier.sol` smart contract
4. **Testing**: Generates and verifies a sample proof

**Generated Files:**
```
build/
├── kyc.r1cs                 # Constraint system
├── kyc_js/                  # WASM witness generator
│   └── kyc.wasm
├── kyc_final.zkey           # Proving key
├── verification_key.json    # Verification key
├── proof.json              # Sample proof
└── public.json             # Sample public inputs

contracts/
└── Verifier.sol            # Generated verifier contract
```

#### 2. Contract Deployment

```bash
npm run deploy
```

**Deployment Process:**
1. **Deploy Verifier**: The zk-SNARK verifier contract
2. **Deploy KYCVerifier**: Main contract that uses the verifier
3. **Setup Trusted Issuers**: Add KYC provider public keys
4. **Save Configuration**: Generate config files for frontend integration

**Generated Files:**
```
deployments/
├── hardhat.json            # Deployment addresses
├── hardhat-abi.json        # Contract ABIs
└── frontend-config.json    # Frontend integration config
```

#### 3. Proof Generation

```bash
npm run generate-proof
```

**Test Cases Generated:**
- ✅ Valid adult (25 years old)
- ✅ Edge case (exactly 18 years old) 
- ✅ Senior citizen (65 years old)
- ❌ Underage user (17 years old) - should fail

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

### Test Coverage

- **Contract Deployment**: Verifier and KYCVerifier deployment
- **Trusted Issuer Management**: Adding/removing trusted KYC providers
- **Valid Age Verification**: Testing successful proof verification
- **Invalid Cases**: Wrong signatures, untrusted issuers, malformed proofs
- **Security Tests**: Replay attacks, edge cases
- **Batch Verification**: Multiple user verification
- **Circuit Edge Cases**: Underage users, wrong signatures

### Sample Test Output

```
  KYC Age Verification System
    Contract Deployment
      ✅ Should deploy Verifier contract
      ✅ Should deploy KYCVerifier contract
    
    Trusted Issuer Management
      ✅ Should add trusted issuer
      ✅ Should not allow non-owner to add trusted issuer
      ✅ Should remove trusted issuer
    
    Age Verification - Valid Cases
      ✅ Should verify proof for adult user (age 25)
      ✅ Should verify proof for user exactly at minimum age (18)
      ✅ Should verify proof for senior user (age 65)
    
    Age Verification - Invalid Cases
      ✅ Should reject proof from untrusted issuer
      ✅ Should reject proof with invalid minimum age
      ✅ Should reject malformed proof
    
    Security Tests
      ✅ Should not allow proof replay attacks
      ✅ Should handle edge case with zero age hash
    
    Batch Verification
      ✅ Should handle batch verification of multiple users
      ✅ Should handle mixed valid/invalid batch verification
```

## 🔧 Circuit Details

### Input/Output Specification

```circom
template KYCAgeVerification() {
    // Private inputs (hidden from verifier)
    signal private input age;              // User's actual age
    signal private input signature;        // KYC provider's signature
    signal private input issuerPrivateKey; // Mock private key (for demo)
    
    // Public inputs (visible on-chain)
    signal input ageHash;                  // Poseidon(age)
    signal input issuerPublicKey;          // KYC provider's public key
    signal input minAge;                   // Required minimum age (18)
    
    // Output
    signal output valid;                   // 1 if age >= minAge, 0 otherwise
}
```

### Constraints

1. **Age Hash Verification**: `Poseidon(age) == ageHash`
2. **Age Requirement**: `age >= minAge` (typically 18)
3. **Signature Verification**: `Poseidon(age, issuerPrivateKey) == signature`
4. **Issuer Verification**: `Poseidon(issuerPrivateKey) == issuerPublicKey`

### Security Model

- **Soundness**: Impossible to prove age ≥ 18 if actual age < 18
- **Zero-Knowledge**: Actual age remains private
- **Completeness**: Valid proofs always verify successfully
- **Trusted Setup**: Uses powers of tau ceremony for security

## 📄 Smart Contract API

### KYCVerifier Contract

#### Core Functions

```solidity
// Verify age proof
function verifyAgeProof(
    uint[8] calldata proof,
    uint256 ageHash,
    uint256 issuerPublicKey,
    uint256 minAge
) external returns (bool)

// Batch verify multiple users
function batchVerifyAgeProofs(
    uint[8][] calldata proofs,
    uint256[] calldata ageHashes,
    uint256[] calldata issuerPublicKeys,
    uint256[] calldata minAges,
    address[] calldata users
) external returns (bool[] memory)
```

#### Management Functions

```solidity
// Add trusted KYC issuer (owner only)
function addTrustedIssuer(uint256 publicKey) external onlyOwner

// Remove trusted issuer (owner only)  
function removeTrustedIssuer(uint256 publicKey) external onlyOwner
```

#### View Functions

```solidity
// Check if user is verified
function isUserVerified(address user) external view returns (bool)

// Get user's age hash
function getUserAgeHash(address user) external view returns (uint256)

// Check if issuer is trusted
function isTrustedIssuer(uint256 publicKey) external view returns (bool)
```

### Events

```solidity
event AgeVerified(address indexed user, uint256 indexed ageHash, bool verified);
event IssuerAdded(uint256 indexed publicKey);
event IssuerRemoved(uint256 indexed publicKey);
```

## 🔄 User Flow

### For Users

1. **Obtain KYC Credential**: Get age credential from trusted KYC provider
2. **Generate Proof**: Create zk-SNARK proof of age ≥ 18
3. **Submit Verification**: Send proof to smart contract
4. **Get Verified**: Receive on-chain verification status

### For KYC Providers

1. **Register**: Get added as trusted issuer by contract owner
2. **Issue Credentials**: Sign user age data with private key
3. **Provide Tools**: Offer proof generation tools to users

### For DApps

1. **Check Status**: Query user verification status
2. **Integrate**: Use verification status for access control
3. **Batch Process**: Verify multiple users efficiently

## 🎯 Use Cases

### Age-Restricted Services
- Online gambling platforms
- Alcohol/tobacco e-commerce
- Adult content platforms
- Financial services (18+ requirement)

### Privacy-Preserving KYC
- DeFi protocols requiring age verification
- NFT marketplaces with age restrictions
- Gaming platforms with age gates
- Social media with age-appropriate content

### Regulatory Compliance
- COPPA compliance (Children's Online Privacy Protection Act)
- GDPR age of consent verification
- Regional age verification requirements
- AML/KYC compliance with privacy

## 🛡️ Security Considerations

### Circuit Security
- **Trusted Setup**: Uses secure powers of tau ceremony
- **Constraint Completeness**: All security properties enforced by constraints
- **Input Validation**: Proper range checks and hash verification

### Smart Contract Security
- **Access Control**: Owner-only functions for issuer management
- **Input Validation**: Comprehensive input checking
- **Reentrancy Protection**: Safe external calls
- **Gas Optimization**: Efficient batch operations

### Cryptographic Security
- **Poseidon Hash**: Secure hash function designed for zk-circuits
- **Groth16**: Proven zk-SNARK construction with strong security guarantees
- **Mock Signatures**: Demo uses simplified signatures (use EdDSA in production)

## 🚧 Production Considerations

### Upgrading for Production

1. **Real Signature Scheme**: Replace mock signatures with EdDSA
```circom
include "circomlib/circuits/eddsa.circom";

component eddsaVerifier = EdDSAVerifier();
eddsaVerifier.enabled <== 1;
eddsaVerifier.Ax <== issuerPublicKey[0];
eddsaVerifier.Ay <== issuerPublicKey[1];
eddsaVerifier.S <== signature[0];
eddsaVerifier.R8x <== signature[1];
eddsaVerifier.R8y <== signature[2];
eddsaVerifier.M <== ageHash;
```

2. **Secure Key Management**: Use hardware security modules (HSMs) for issuer keys

3. **Ceremony Participation**: Participate in or verify trusted setup ceremony

4. **Gas Optimization**: Optimize contract for lower gas costs

5. **Upgradability**: Consider proxy patterns for contract upgrades

### Scaling Solutions

- **Layer 2 Integration**: Deploy on Polygon, Arbitrum, or Optimism
- **Batch Processing**: Use merkle trees for efficient batch verification
- **Caching**: Cache verification results off-chain
- **IPFS Integration**: Store proofs on IPFS for decentralization

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd zk-kyc-age-verification

# Install dependencies
npm install

# Install global tools
npm install -g circom snarkjs

# Run development setup
npm run compile-circuit
npm run deploy
npm test
```

### Code Structure

```
zk-kyc-age-verification/
├── circuits/           # Circom circuits
├── contracts/         # Solidity smart contracts
├── scripts/           # Automation scripts
├── test/             # Test suite
├── build/            # Generated circuit artifacts
├── deployments/      # Deployment configurations
└── docs/             # Additional documentation
```

### Testing Guidelines

- Write tests for all new features
- Include both positive and negative test cases
- Test edge cases and security scenarios
- Maintain >90% code coverage
- Use descriptive test names and comments

## 📚 Additional Resources

### ZK-SNARK Resources
- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Documentation](https://github.com/iden3/snarkjs)
- [Zero-Knowledge Proofs: An Illustrated Primer](https://blog.cryptographyengineering.com/2014/11/27/zero-knowledge-proofs-illustrated-primer/)

### Ethereum Development
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [Solidity Documentation](https://docs.soliditylang.org/)

### Privacy & Cryptography
- [Applied Cryptography](https://www.schneier.com/books/applied-cryptography/)
- [A Graduate Course in Applied Cryptography](https://crypto.stanford.edu/~dabo/cryptobook/)
- [Privacy-Preserving Techniques](https://privacytools.io/)

## 📞 Support

For questions, issues, or contributions:

- Email: asp.eth.2025@gmail.com
- X (Twitter): https://x.com/cyberflux0

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Circom](https://github.com/iden3/circom) team for the circuit language
- [SnarkJS](https://github.com/iden3/snarkjs) team for the proving system
- [Hardhat](https://hardhat.org/) team for the development environment
- Zero-knowledge cryptography research community
- Open source contributors and reviewers

---

