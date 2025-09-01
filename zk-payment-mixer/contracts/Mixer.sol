// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Verifier.sol";

contract Mixer is ReentrancyGuard, Pausable, Ownable {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;

    mapping(bytes32 => bool) public nullifiers; // nullifierHash => used
    mapping(bytes32 => bool) public commitments; // commitment => exists

    bytes32[] public merkleRoots; // recent roots

    event Deposit(bytes32 indexed commitment, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed recipient, uint256 amount, bytes32 nullifierHash);
    event MerkleRootUpdated(bytes32 indexed root);

    Verifier public verifier;

    constructor(address _verifier) {
        verifier = Verifier(_verifier);
        merkleRoots.push(bytes32(0)); // genesis root
    }

    function deposit(bytes32 commitment) external payable whenNotPaused nonReentrant {
        require(msg.value == DEPOSIT_AMOUNT, "Incorrect deposit amount");
        require(!commitments[commitment], "Commitment exists");
        commitments[commitment] = true;
        emit Deposit(commitment, msg.value, block.timestamp);
    }

    function withdraw(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes32 root,
        bytes32 nullifierHash,
        address payable recipient
    ) external whenNotPaused nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(!nullifiers[nullifierHash], "Nullifier used");
        require(isValidRoot(root), "Invalid root");

        uint256[3] memory inputs = [uint256(root), uint256(nullifierHash), uint256(uint160(recipient))];
        bool ok = verifier.verifyProof(a, b, c, inputs);
        require(ok, "Invalid proof");

        nullifiers[nullifierHash] = true;

        (bool sent, ) = recipient.call{value: DEPOSIT_AMOUNT}("");
        require(sent, "Transfer failed");
        emit Withdrawal(recipient, DEPOSIT_AMOUNT, nullifierHash);
    }

    function addMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoots.push(newRoot);
        emit MerkleRootUpdated(newRoot);
    }

    function isValidRoot(bytes32 root) public view returns (bool) {
        for (uint256 i = 0; i < merkleRoots.length; i++) {
            if (merkleRoots[i] == root) return true;
        }
        return false;
    }

    function getAllRoots() external view returns (bytes32[] memory) {
        return merkleRoots;
    }

    function getCurrentRoot() external view returns (bytes32) {
        return merkleRoots[merkleRoots.length - 1];
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(address payable to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Emergency withdraw failed");
    }
}
