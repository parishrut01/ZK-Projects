onst fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');
const circomlibjs = require('circomlibjs');

/**
 * Generate Proof Script
 * 
 * This script generates a zero-knowledge proof for age verification.
 * It demonstrates how to:
 * 1. Create proper inputs for the circuit
 * 2. Generate a zk-SNARK proof
 * 3. Format the proof for smart contract verification
 * 4. Verify the proof locally before sending to chain
 */

const CIRCUIT_NAME = 'kyc';
const BUILD_DIR = './build';

class KYCProofGenerator {
    constructor() {
        this.buildDir = BUILD_DIR;
        this.circuitWasm = path.join(this.buildDir, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
        this.circuitZkey = path.join(this.buildDir, `${CIRCUIT_NAME}_final.zkey`);
        this.verificationKey = path.join(this.buildDir, 'verification_key.json');
    }
    
    /**
     * Calculate Poseidon hash
     */
    async calculatePoseidonHash(inputs) {
        const poseidon = await circomlibjs.buildPoseidon();
        const hash = poseidon(inputs);
        return poseidon.F.toString(hash);
    }
    
    /**
     * Generate mock issuer credentials
     * In production, this would be done by a trusted KYC provider
     */
    async generateIssuerCredentials() {
        // Mock private key for the issuer (in production, this would be securely stored)
        const issuerPrivateKey = "12345678901234567890123456789012345678901234567890123456789012345";
        
        // Calculate public key as Poseidon(privateKey) - simplified for demo
        const issuerPublicKey = await this.calculatePoseidonHash([issuerPrivateKey]);
        
        return {
            privateKey: issuerPrivateKey,
            publicKey: issuerPublicKey
        };
    }
    
    /**
     * Generate a signed age credential
     * This simulates what a KYC provider would do
     */
    async generateAgeCredential(age, issuerPrivateKey) {
        // Calculate age hash
        const ageHash = await this.calculatePoseidonHash([age]);
        
        // Generate signature as Poseidon(age, issuerPrivateKey)
        // In production, use proper EdDSA signature
        const signature = await this.calculatePoseidonHash([age, issuerPrivateKey]);
        
        return {
            age,
            ageHash,
            signature
        };
    }
    
    /**
     * Generate circuit inputs for proof generation
     */
    async generateCircuitInputs(userAge, minAge = 18) {
        console.log(`\n📝 Generating circuit inputs for age ${userAge}...`);
        
        // Generate issuer credentials
        const issuer = await this.generateIssuerCredentials();
        console.log(`🔑 Issuer public key: ${issuer.publicKey}`);
        
        // Generate age credential
        const credential = await this.generateAgeCredential(userAge, issuer.privateKey);
        console.log(`📋 Age hash: ${credential.ageHash}`);
        console.log(`✍️  Signature: ${credential.signature}`);
        
        // Prepare circuit inputs
        const circuitInputs = {
            // Private inputs (not revealed)
            age: userAge.toString(),
            signature: credential.signature,
            issuerPrivateKey: issuer.privateKey,
            
            // Public inputs (revealed on-chain)
            ageHash: credential.ageHash,
            issuerPublicKey: issuer.publicKey,
            minAge: minAge.toString()
        };
        
        console.log(`✅ Circuit inputs generated`);
        return circuitInputs;
    }
    
    /**
     * Generate zk-SNARK proof
     */
    async generateProof(circuitInputs) {
        console.log('\n🔄 Generating zk-SNARK proof...');
        
        try {
            // Generate witness
            const { witness } = await snarkjs.groth16.fullProve(
                circuitInputs,
                this.circuitWasm,
                this.circuitZkey
            );
            
            console.log('✅ Witness generated');
            
            // Generate proof
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                circuitInputs,
                this.circuitWasm,
                this.circuitZkey
            );
            
            console.log('✅ Proof generated');
            console.log(`📊 Public signals: [${publicSignals.join(', ')}]`);
            
            return { proof, publicSignals };
            
        } catch (error) {
            console.error('❌ Proof generation failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Format proof for smart contract
     */
    formatProofForContract(proof) {
        return [
            proof.pi_a[0], proof.pi_a[1],
            proof.pi_b[0][1], proof.pi_b[0][0],
            proof.pi_b[1][1], proof.pi_b[1][0],
            proof.pi_c[0], proof.pi_c[1]
        ];
    }
    
    /**
     * Verify proof locally
     */
    async verifyProofLocally(proof, publicSignals) {
        console.log('\n🔍 Verifying proof locally...');
        
        try {
            const vKey = JSON.parse(fs.readFileSync(this.verificationKey));
            const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            
            if (res) {
                console.log('✅ Proof verification successful!');
            } else {
                console.log('❌ Proof verification failed!');
            }
            
            return res;
            
        } catch (error) {
            console.error('❌ Local verification failed:', error.message);
            return false;
        }
    }
    
    /**
     * Save proof to file
     */
    saveProof(proof, publicSignals, filename) {
        const proofData = {
            proof,
            publicSignals,
            formattedProof: this.formatProofForContract(proof),
            timestamp: new Date().toISOString()
        };
        
        const filepath = path.join(this.buildDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(proofData, null, 2));
        console.log(`💾 Proof saved to ${filepath}`);
        
        return proofData;
    }
    
    /**
     * Generate multiple test cases
     */
    async generateTestCases() {
        console.log('\n🧪 Generating test cases...');
        
        const testCases = [
            { age: 25, description: 'Valid case: Adult (25 years old)' },
            { age: 18, description: 'Edge case: Exactly 18 years old' },
            { age: 65, description: 'Valid case: Senior (65 years old)' }
        ];
        
        const results = [];
        
        for (const testCase of testCases) {
            console.log(`\n--- ${testCase.description} ---`);
            
            try {
                const inputs = await this.generateCircuitInputs(testCase.age);
                const { proof, publicSignals } = await this.generateProof(inputs);
                const isValid = await this.verifyProofLocally(proof, publicSignals);
                
                const filename = `proof_age_${testCase.age}.json`;
                const proofData = this.saveProof(proof, publicSignals, filename);
                
                results.push({
                    ...testCase,
                    success: true,
                    isValid,
                    proofData,
                    filename
                });
                
            } catch (error) {
                console.error(`❌ Failed to generate proof for age ${testCase.age}:`, error.message);
                results.push({
                    ...testCase,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Generate proof for underage user (should fail circuit constraints)
     */
    async generateUnderageProof() {
        console.log('\n🚫 Testing underage case (should fail)...');
        
        try {
            const inputs = await this.generateCircuitInputs(17); // Underage
            
            // This should fail at the circuit level
            const { proof, publicSignals } = await this.generateProof(inputs);
            
            console.log('⚠️  Unexpected: Proof generated for underage user');
            return { success: true, proof, publicSignals };
            
        } catch (error) {
            console.log('✅ Expected: Circuit correctly rejected underage user');
            console.log(`   Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

async function main() {
    try {
        console.log('🚀 Starting proof generation...\n');
        
        // Check if circuit files exist
        const requiredFiles = [
            path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
            path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`),
            path.join(BUILD_DIR, 'verification_key.json')
        ];
        
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Required file not found: ${file}. Please run 'npm run compile-circuit' first.`);
            }
        }
        
        const generator = new KYCProofGenerator();
        
        // Generate test cases
        const testResults = await generator.generateTestCases();
        
        // Test underage case
        const underageResult = await generator.generateUnderageProof();
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 PROOF GENERATION SUMMARY');
        console.log('='.repeat(60));
        
        console.log('\n✅ Valid test cases:');
        testResults.filter(r => r.success && r.isValid).forEach(result => {
            console.log(`  ✓ ${result.description} - ${result.filename}`);
        });
        
        console.log('\n❌ Failed cases:');
        testResults.filter(r => !r.success).forEach(result => {
            console.log(`  ✗ ${result.description} - ${result.error}`);
        });
        
        if (!underageResult.success) {
            console.log('\n🛡️  Security check passed: Underage users correctly rejected');
        }
        
        console.log('\nNext steps:');
        console.log('1. Deploy contracts: npm run deploy');
        console.log('2. Run tests: npm test');
        console.log('3. Use generated proofs in your application');
        
    } catch (error) {
        console.error('\n❌ Proof generation failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { KYCProofGenerator };
