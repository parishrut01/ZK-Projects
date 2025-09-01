onst path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function ensurePot12(build) {
  const potFinal = path.join(build, 'pot12_final.ptau');
  if (fs.existsSync(potFinal)) return;
  console.log('> Preparing powers of tau (bn128, 12)');
  execSync(`snarkjs powersoftau new bn128 12 ${path.join(build,'pot12_0000.ptau')} -v`, { stdio: 'inherit' });
  execSync(`snarkjs powersoftau contribute ${path.join(build,'pot12_0000.ptau')} ${path.join(build,'pot12_0001.ptau')} --name="contrib1" -v`, { stdio: 'inherit' });
  execSync(`snarkjs powersoftau prepare phase2 ${path.join(build,'pot12_0001.ptau')} ${potFinal} -v`, { stdio: 'inherit' });
  execSync(`snarkjs powersoftau verify ${potFinal}`, { stdio: 'inherit' });
}

async function main() {
  const build = path.join(__dirname, '..', 'build');
  const circuitsDir = path.join(__dirname, '..', 'circuits');
  if (!fs.existsSync(build)) fs.mkdirSync(build, { recursive: true });

  await ensurePot12(build);

  console.log('> Compiling circuit');
  execSync(`circom ${path.join(circuitsDir,'withdraw.circom')} --r1cs --wasm --sym --output ${build}`, { stdio: 'inherit' });

  console.log('> Groth16 setup');
  execSync(`snarkjs groth16 setup ${path.join(build,'withdraw.r1cs')} ${path.join(build,'pot12_final.ptau')} ${path.join(build,'withdraw_0000.zkey')}`, { stdio: 'inherit' });
  execSync(`snarkjs zkey contribute ${path.join(build,'withdraw_0000.zkey')} ${path.join(build,'withdraw_final.zkey')} --name="zk-payment-mixer" -v`, { stdio: 'inherit' });
  execSync(`snarkjs zkey export verificationkey ${path.join(build,'withdraw_final.zkey')} ${path.join(build,'verification_key.json')}`, { stdio: 'inherit' });
  execSync(`snarkjs zkey export solidityverifier ${path.join(build,'withdraw_final.zkey')} ${path.join(build,'Verifier.sol')}`, { stdio: 'inherit' });

  // copy Verifier
  fs.copyFileSync(path.join(build,'Verifier.sol'), path.join(__dirname, '..', 'contracts', 'Verifier.sol'));
  console.log('> Verifier.sol copied to contracts/Verifier.sol');

  console.log('Done. Build artifacts in', build);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { main };
