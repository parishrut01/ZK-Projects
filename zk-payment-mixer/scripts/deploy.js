const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const Verifier = await ethers.getContractFactory('Verifier');
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log('Verifier:', await verifier.getAddress());

  const Mixer = await ethers.getContractFactory('Mixer');
  const mixer = await Mixer.deploy(await verifier.getAddress());
  await mixer.waitForDeployment();
  console.log('Mixer:', await mixer.getAddress());

  // add initial root 0x0
  const tx = await mixer.addMerkleRoot(ethers.ZeroHash);
  await tx.wait();
  console.log('Initial root added');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
