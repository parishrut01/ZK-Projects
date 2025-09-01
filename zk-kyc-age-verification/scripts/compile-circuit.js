onst fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Compile Circuit Script
 * 
 * This script:
 * 1. Compiles the Circom circuit
 * 2. Generates the witness calculator
 * 3. Performs the trusted setup (powers of tau + circuit-specific setup)
 * 4. Generates the Solidity verifier contract
 * 5. Exports the verification key
 */

const CIRCUIT_NAME = 'kyc';
const CIRCUIT_PATH = './circuits/kyc.circom';
const BUILD_DIR = './build';
const CONTRACTS_DIR = './contracts';

async function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
}

async function runCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    console.log(`Command: ${command}`);
    
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        console.log(`✅ ${description} completed successfully`);
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        throw error;
    }
}

async function downloadPowersOfTau() {
    const tauFile = path.join(BUILD_DIR, 'powersOfTau28_hez_final_10.ptau');
    
    if (fs.existsSync(tauFile)) {
        console.log('✅ Powers of tau file already exists');
        return;
    }
    
    console.log('📥 Downloading powers of tau file (this may take a while)...');
    
    // For circuits with < 2^10 constraints, we can use the smaller ceremony file
    const downloadCommand = `curl -L -o ${tauFile} https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau`;
    
    await runCommand(downloadCommand, 'Download powers of tau');
}

async function compileCircuit() {
    const outputDir = path.join(BUILD_DIR, CIRCUIT_NAME);
    
    await runCommand(
        `circom ${CIRCUIT_PATH} --r1cs --wasm --sym -o ${BUILD_DIR}`,
        'Compile circuit'
    );
    
    // Verify the compilation outputs
    const requiredFiles = [
        path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`),
        path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
        path.join(BUILD_DIR, `${CIRCUIT_NAME}.sym`)
    ];
    
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            throw new Error(`Required file not found: ${file}`);
        }
    }
    
    console.log('✅ Circuit compilation verified');
}

async function generateWitness() {
    // Create a sample input for testing witness generation
    const sampleInput = {
        age: 25,
        signature: "12345678901234567890123456789012345678901234567890123456789012345", // Mock signature
        issuerPrivateKey: "11111111111111111111111111111111111111111111111111111111111111111", // Mock private key
        ageHash: "0", // Will be calculated
        issuerPublicKey: "0", // Will be calculated
        minAge: 18
    };
    
    // Calculate the expected hashes using circomlibjs (mock values for now)
    // In a real implementation, these would be calculated properly
    sampleInput.ageHash = "123456789012345678901234567890123456789012345678901234567890123456";
    sampleInput.issuerPublicKey = "987654321098765432109876543210987654321098765432109876543210987654";
    
    const inputFile = path.join(BUILD_DIR, 'input.json');
    fs.writeFileSync(inputFile, JSON.stringify(sampleInput, null, 2));
    
    console.log('📝 Sample input file created for witness generation');
    
    // Generate witness using snarkjs
    await runCommand(
        `cd ${BUILD_DIR}/${CIRCUIT_NAME}_js && node generate_witness.js ${CIRCUIT_NAME}.wasm ../input.json ../witness.wtns`,
        'Generate witness'
    );
}

async function trustedSetup() {
    const r1csFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
    const tauFile = path.join(BUILD_DIR, 'powersOfTau28_hez_final_10.ptau');
    const zkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}.zkey`);
    
    // Phase 1: Setup with powers of tau
    await runCommand(
        `snarkjs groth16 setup ${r1csFile} ${tauFile} ${zkeyFile}`,
        'Groth16 trusted setup'
    );
    
    // For production, you would do a ceremony here with multiple contributors
    // For development, we'll use a simple contribution
    const finalZkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    
    await runCommand(
        `snarkjs zkey contribute ${zkeyFile} ${finalZkeyFile} --name="First contribution" -v`,
        'Add contribution to trusted setup'
    );
    
    // Export verification key
    const vkeyFile = path.join(BUILD_DIR, 'verification_key.json');
    await runCommand(
        `snarkjs zkey export verificationkey ${finalZkeyFile} ${vkeyFile}`,
        'Export verification key'
    );
}

async function generateSolidityVerifier() {
    const finalZkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    const verifierFile = path.join(CONTRACTS_DIR, 'Verifier.sol');
    
    await runCommand(
        `snarkjs zkey export solidityverifier ${finalZkeyFile} ${verifierFile}`,
        'Generate Solidity verifier'
    );
    
    console.log(`✅ Verifier contract generated at ${verifierFile}`);
}

async function generateProofTest() {
    console.log('\n🧪 Testing proof generation...');
    
    const witnessFile = path.join(BUILD_DIR, 'witness.wtns');
    const finalZkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    const proofFile = path.join(BUILD_DIR, 'proof.json');
    const publicFile = path.join(BUILD_DIR, 'public.json');
    
    await runCommand(
        `snarkjs groth16 prove ${finalZkeyFile} ${witnessFile} ${proofFile} ${publicFile}`,
        'Generate test proof'
    );
    
    // Verify the proof
    const vkeyFile = path.join(BUILD_DIR, 'verification_key.json');
    await runCommand(
        `snarkjs groth16 verify ${vkeyFile} ${publicFile} ${proofFile}`,
        'Verify test proof'
    );
}

async function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 CIRCUIT COMPILATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nGenerated files:');
    console.log(`📁 Build directory: ${BUILD_DIR}/`);
    console.log(`  ├── ${CIRCUIT_NAME}.r1cs (R1CS constraint system)`);
    console.log(`  ├── ${CIRCUIT_NAME}.sym (Symbol file)`);
    console.log(`  ├── ${CIRCUIT_NAME}_js/ (WASM witness generator)`);
    console.log(`  ├── ${CIRCUIT_NAME}_final.zkey (Proving key)`);
    console.log(`  ├── verification_key.json (Verification key)`);
    console.log(`  ├── proof.json (Sample proof)`);
    console.log(`  └── public.json (Sample public inputs)`);
    console.log(`\n📄 Smart contract: ${CONTRACTS_DIR}/Verifier.sol`);
    
    console.log('\nNext steps:');
    console.log('1. Run: npm run deploy (to deploy contracts)');
    console.log('2. Run: npm run generate-proof (to generate proofs)');
    console.log('3. Run: npm test (to run tests)');
}

async function main() {
    try {
        console.log('🚀 Starting circuit compilation process...\n');
        
        // Create necessary directories
        await ensureDirectoryExists(BUILD_DIR);
        await ensureDirectoryExists(CONTRACTS_DIR);
        
        // Download powers of tau ceremony file
        await downloadPowersOfTau();
        
        // Compile the circuit
        await compileCircuit();
        
        // Generate witness (for testing)
        await generateWitness();
        
        // Perform trusted setup
        await trustedSetup();
        
        // Generate Solidity verifier
        await generateSolidityVerifier();
        
        // Test proof generation
        await generateProofTest();
        
        // Print summary
        await printSummary();
        
    } catch (error) {
        console.error('\n❌ Compilation failed:', error.message);
        process.exit(1);
    }
}

// Check if circom and snarkjs are installed
async function checkDependencies() {
    const dependencies = ['circom', 'snarkjs'];
    
    for (const dep of dependencies) {
        try {
            await execAsync(`${dep} --version`);
            console.log(`✅ ${dep} is installed`);
        } catch (error) {
            console.error(`❌ ${dep} is not installed. Please install it first.`);
            console.error(`   npm install -g ${dep}`);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    checkDependencies().then(() => main());
}

module.exports = {
    compileCircuit,
    trustedSetup,
    generateSolidityVerifier
};
