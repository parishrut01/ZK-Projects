onst path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function generateProof(inputs) {
  const build = path.join(__dirname, '..', 'build');
  const wasm = path.join(build, 'withdraw_js', 'withdraw.wasm');
  const zkey = path.join(build, 'withdraw_final.zkey');
  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) throw new Error('Missing WASM or zkey. Run compile-circuit.');
  const inputPath = path.join(build, 'input.json');
  fs.writeFileSync(inputPath, JSON.stringify(inputs, null, 2));

  console.log('> Generating witness');
  execSync(`node ${path.join(build, 'withdraw_js', 'generate_witness.js')} ${wasm} ${inputPath} ${path.join(build,'witness.wtns')}`, { stdio: 'inherit' });

  console.log('> Proving (groth16)');
  execSync(`snarkjs groth16 prove ${zkey} ${path.join(build,'witness.wtns')} ${path.join(build,'proof.json')} ${path.join(build,'public.json')}`, { stdio: 'inherit' });

  const proof = JSON.parse(fs.readFileSync(path.join(build, 'proof.json')));
  const pub = JSON.parse(fs.readFileSync(path.join(build, 'public.json')));
  return { proof, pub };
}

async function verifyProof(proof, pub) {
  const build = path.join(__dirname, '..', 'build');
  const vk = path.join(build, 'verification_key.json');
  fs.writeFileSync(path.join(build,'tmp_proof.json'), JSON.stringify(proof));
  fs.writeFileSync(path.join(build,'tmp_pub.json'), JSON.stringify(pub));
  console.log('> Verifying');
  execSync(`snarkjs groth16 verify ${vk} ${path.join(build,'tmp_pub.json')} ${path.join(build,'tmp_proof.json')}`, { stdio: 'inherit' });
  return true;
}

async function main() {
  const example = {
    secret: "1",
    nullifier: "2",
    root: "0",
    recipient: "12345",
    path_elements: Array(20).fill("0"),
    path_indices: Array(20).fill(0)
  };
  const { proof, pub } = await generateProof(example);
  await verifyProof(proof, pub);
  console.log('Proof and public inputs written to build/.');
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { generateProof, verifyProof };
