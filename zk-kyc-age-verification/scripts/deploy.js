onst { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deployment Script for KYC Age Verification System
 * 
 * This script:
 * 1. Deploys the Groth16 Verifier contract (generated from circuit)
 * 2. Deploys the KYCVerifier contract
 * 3. Sets up trusted issuers
 * 4. Saves deployment addresses and ABI for frontend integration
 */

const BUILD_DIR = './build';
const DEPLOYMENTS_DIR = './deployments';

async function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
}

async function deployVerifier() {
    console.log('\n🚀 Deploying Groth16 Verifier contract...');
    
    try {
        // Get the Verifier contract factory
        const Verifier = await ethers.getContractFactory('Verifier');
        
        // Deploy the verifier
        const verifier = await Verifier.deploy();
        await verifier.waitForDeployment();
        
        const verifierAddress = await verifier.getAddress();
        console.log(`✅ Verifier deployed to: ${verifierAddress}`);
        
        return { verifier, address: verifierAddress };
        
    } catch (error) {
        console.error('❌ Failed to deploy Verifier:', error.message);
        throw error;
    }
}

async function deployKYCVerifier(verifierAddress) {
    console.log('\n🚀 Deploying KYCVerifier contract...');
    
    try {
        // Get the KYCVerifier contract factory
        const KYCVerifier = await ethers.getContractFactory('KYCVerifier');
        
        // Deploy with verifier address
        const kycVerifier = await KYCVerifier.deploy(verifierAddress);
        await kycVerifier.waitForDeployment();
        
        const kycVerifierAddress = await kycVerifier.getAddress();
        console.log(`✅ KYCVerifier deployed to: ${kycVerifierAddress}`);
        
        return { kycVerifier, address: kycVerifierAddress };
        
    } catch (error) {
        console.error('❌ Failed to deploy KYCVerifier:', error.message);
        throw error;
    }
}

async function setupTrustedIssuers(kycVerifier) {
    console.log('\n🔑 Setting up trusted issuers...');
    
    try {
        // Read the verification key to get the mock issuer public key
        const vkeyPath = path.join(BUILD_DIR, 'verification_key.json');
        
        // For demo purposes, we'll add a mock trusted issuer
        // In production, this would be the actual public key of KYC providers
        const mockIssuerPublicKey = "987654321098765432109876543210987654321098765432109876543210987654";
        
        console.log(`📋 Adding trusted issuer with public key: ${mockIssuerPublicKey}`);
        
        const tx = await kycVerifier.addTrustedIssuer(mockIssuerPublicKey);
        await tx.wait();
        
        console.log('✅ Trusted issuer added successfully');
        
        // Verify the issuer was added
        const isTrusted = await kycVerifier.isTrustedIssuer(mockIssuerPublicKey);
        console.log(`🔍 Issuer trust status verified: ${isTrusted}`);
        
        return mockIssuerPublicKey;
        
    } catch (error) {
        console.error('❌ Failed to setup trusted issuers:', error.message);
        throw error;
    }
}

async function saveDeploymentInfo(deployments, network) {
    console.log('\n💾 Saving deployment information...');
    
    try {
        await ensureDirectoryExists(DEPLOYMENTS_DIR);
        
        const deploymentData = {
            network: network.name,
            chainId: network.chainId,
            timestamp: new Date().toISOString(),
            contracts: {
                Verifier: {
                    address: deployments.verifier.address,
                    transactionHash: deployments.verifier.deploymentTransaction?.hash
                },
                KYCVerifier: {
                    address: deployments.kycVerifier.address,
                    transactionHash: deployments.kycVerifier.deploymentTransaction?.hash
                }
            },
            trustedIssuers: deployments.trustedIssuers || [],
            configuration: {
                minAge: 18
            }
        };
        
        // Save deployment data
        const deploymentFile = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
        console.log(`✅ Deployment data saved to: ${deploymentFile}`);
        
        // Save ABIs for frontend integration
        const artifacts = {
            Verifier: await ethers.getContractFactory('Verifier').then(f => f.interface.format('json')),
            KYCVerifier: await ethers.getContractFactory('KYCVerifier').then(f => f.interface.format('json'))
        };
        
        const abiFile = path.join(DEPLOYMENTS_DIR, `${network.name}-abi.json`);
        fs.writeFileSync(abiFile, JSON.stringify(artifacts, null, 2));
        console.log(`✅ Contract ABIs saved to: ${abiFile}`);
        
        // Create a simple config file for frontend
        const frontendConfig = {
            contracts: {
                KYCVerifier: {
                    address: deployments.kycVerifier.address,
                    abi: JSON.parse(artifacts.KYCVerifier)
                },
                Verifier: {
                    address: deployments.verifier.address,
                    abi: JSON.parse(artifacts.Verifier)
                }
            },
            network: {
                name: network.name,
                chainId: network.chainId
            },
            trustedIssuers: deployments.trustedIssuers || []
        };
        
        const configFile = path.join(DEPLOYMENTS_DIR, 'frontend-config.json');
        fs.writeFileSync(configFile, JSON.stringify(frontendConfig, null, 2));
        console.log(`✅ Frontend config saved to: ${configFile}`);
        
        return deploymentData;
        
    } catch (error) {
        console.error('❌ Failed to save deployment info:', error.message);
        throw error;
    }
}

async function verifyDeployment(deployments) {
    console.log('\n🔍 Verifying deployment...');
    
    try {
        const { kycVerifier } = deployments;
        
        // Check basic contract functionality
        const minAge = await kycVerifier.MIN_AGE();
        console.log(`📊 Minimum age requirement: ${minAge}`);
        
        const owner = await kycVerifier.owner();
        console.log(`👤 Contract owner: ${owner}`);
        
        // Check if our trusted issuer is set up
        if (deployments.trustedIssuers && deployments.trustedIssuers.length > 0) {
            const firstIssuer = deployments.trustedIssuers[0];
            const isTrusted = await kycVerifier.isTrustedIssuer(firstIssuer);
            console.log(`🔑 First trusted issuer status: ${isTrusted}`);
        }
        
        console.log('✅ Deployment verification completed');
        
    } catch (error) {
        console.error('❌ Deployment verification failed:', error.message);
        throw error;
    }
}

async function printDeploymentSummary(deployments, network) {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    console.log(`\n📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log('\n📋 Deployed Contracts:');
    console.log(`  🔐 Verifier:     ${deployments.verifier.address}`);
    console.log(`  🏛️  KYCVerifier:  ${deployments.kycVerifier.address}`);
    
    if (deployments.trustedIssuers && deployments.trustedIssuers.length > 0) {
        console.log('\n🔑 Trusted Issuers:');
        deployments.trustedIssuers.forEach((issuer, index) => {
            console.log(`  ${index + 1}. ${issuer}`);
        });
    }
    
    console.log('\n📁 Files Generated:');
    console.log(`  📄 ${DEPLOYMENTS_DIR}/${network.name}.json (Deployment data)`);
    console.log(`  📄 ${DEPLOYMENTS_DIR}/${network.name}-abi.json (Contract ABIs)`);
    console.log(`  📄 ${DEPLOYMENTS_DIR}/frontend-config.json (Frontend config)`);
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Run: npm run generate-proof (Generate test proofs)');
    console.log('  2. Run: npm test (Run integration tests)');
    console.log('  3. Integrate with your frontend using the generated config files');
    
    console.log('\n💡 Usage Example:');
    console.log(`  const kycVerifier = new ethers.Contract(`);
    console.log(`    "${deployments.kycVerifier.address}",`);
    console.log(`    kycVerifierABI,`);
    console.log(`    signer`);
    console.log(`  );`);
    
    console.log('\n' + '='.repeat(70));
}

async function main() {
    try {
        console.log('🚀 Starting deployment process...\n');
        
        // Get network info
        const network = await ethers.provider.getNetwork();
        const [deployer] = await ethers.getSigners();
        
        console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`👤 Deployer: ${deployer.address}`);
        
        // Check deployer balance
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);
        
        if (balance === 0n) {
            throw new Error('Deployer has no ETH balance. Please fund the account.');
        }
        
        // Check if Verifier contract exists
        const verifierPath = './contracts/Verifier.sol';
        if (!fs.existsSync(verifierPath)) {
            throw new Error(
                'Verifier.sol not found. Please run "npm run compile-circuit" first to generate the verifier contract.'
            );
        }
        
        // Deploy contracts
        const verifierDeployment = await deployVerifier();
        const kycVerifierDeployment = await deployKYCVerifier(verifierDeployment.address);
        
        // Setup trusted issuers
        const trustedIssuer = await setupTrustedIssuers(kycVerifierDeployment.kycVerifier);
        
        // Prepare deployment data
        const deployments = {
            verifier: verifierDeployment,
            kycVerifier: kycVerifierDeployment,
            trustedIssuers: [trustedIssuer]
        };
        
        // Save deployment information
        await saveDeploymentInfo(deployments, network);
        
        // Verify deployment
        await verifyDeployment(deployments);
        
        // Print summary
        await printDeploymentSummary(deployments, network);
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        
        if (error.message.includes('Verifier.sol not found')) {
            console.log('\n💡 Solution: Run the following command first:');
            console.log('   npm run compile-circuit');
        }
        
        process.exit(1);
    }
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    deployVerifier,
    deployKYCVerifier,
    setupTrustedIssuers
};
