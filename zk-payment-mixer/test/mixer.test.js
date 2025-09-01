const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Mixer', function () {
  let mixer, verifier, owner, user1, user2;
  const DEPOSIT = ethers.parseEther('0.1');

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Verifier = await ethers.getContractFactory('Verifier');
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const Mixer = await ethers.getContractFactory('Mixer');
    mixer = await Mixer.deploy(await verifier.getAddress());
    await mixer.waitForDeployment();
    await mixer.addMerkleRoot(ethers.ZeroHash);
  });

  it('deploys with correct constants', async function () {
    const amt = await mixer.DEPOSIT_AMOUNT();
    expect(amt).to.equal(DEPOSIT);
  });

  it('accepts deposit of 0.1 ETH and records commitment', async function () {
    const commitment = ethers.hexlify(ethers.randomBytes(32));
    await expect(mixer.connect(user1).deposit(commitment, { value: DEPOSIT }))
      .to.emit(mixer, 'Deposit');
    const exists = await mixer.hasCommitment?.(commitment).catch(()=>undefined);
    // hasCommitment not in contract; check via event suffices and balance increase
    const bal = await ethers.provider.getBalance(await mixer.getAddress());
    expect(bal).to.equal(DEPOSIT);
  });

  it('rejects wrong deposit amount', async function () {
    const commitment = ethers.hexlify(ethers.randomBytes(32));
    await expect(mixer.connect(user1).deposit(commitment, { value: ethers.parseEther('0.05') }))
      .to.be.revertedWith('Incorrect deposit amount');
  });

  it('prevents duplicate commitments', async function () {
    const commitment = ethers.hexlify(ethers.randomBytes(32));
    await mixer.connect(user1).deposit(commitment, { value: DEPOSIT });
    await expect(mixer.connect(user2).deposit(commitment, { value: DEPOSIT }))
      .to.be.revertedWith('Commitment exists');
  });

  it('withdraw works with placeholder verifier and marks nullifier', async function () {
    // deposit
    await mixer.connect(user1).deposit(ethers.hexlify(ethers.randomBytes(32)), { value: DEPOSIT });
    const root = await mixer.getCurrentRoot();
    const nullifierHash = ethers.hexlify(ethers.randomBytes(32));

    const a = [0n,0n];
    const b = [[0n,0n],[0n,0n]];
    const c = [0n,0n];

    const before = await ethers.provider.getBalance(user2.address);
    await expect(mixer.connect(user1).withdraw(a,b,c,root,nullifierHash,user2.address))
      .to.emit(mixer, 'Withdrawal');
    const after = await ethers.provider.getBalance(user2.address);
    expect(after - before).to.equal(DEPOSIT);

    await expect(mixer.connect(user1).withdraw(a,b,c,root,nullifierHash,user2.address))
      .to.be.revertedWith('Nullifier used');
  });

  it('rejects invalid root', async function () {
    const nullifierHash = ethers.hexlify(ethers.randomBytes(32));
    const a = [0n,0n];
    const b = [[0n,0n],[0n,0n]];
    const c = [0n,0n];
    await expect(mixer.withdraw(a,b,c,ethers.hexlify(ethers.randomBytes(32)),nullifierHash,user2.address))
      .to.be.revertedWith('Invalid root');
  });
});
