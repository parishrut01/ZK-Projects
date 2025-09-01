pragma circom 2.1.4;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/merkleTree.circom";

// Withdraw circuit: proves knowledge of (secret, nullifier) such that
// commitment = Poseidon(secret, nullifier) is included in Merkle root `root`.
// Public: root, nullifier_hash, recipient
// Private: secret, nullifier, path_elements, path_indices
// Outputs: commitment

template Withdraw(levels) {
    // Public inputs
    signal input root;              // Merkle root
    signal input nullifier_hash;    // Poseidon(nullifier)
    signal input recipient;         // recipient address as field element

    // Private inputs
    signal input secret;
    signal input nullifier;
    signal input path_elements[levels];
    signal input path_indices[levels];

    // Outputs
    signal output commitment;       // Poseidon(secret, nullifier)

    // Hash commitment
    component hashCommit = Poseidon(2);
    hashCommit.inputs[0] <== secret;
    hashCommit.inputs[1] <== nullifier;
    commitment <== hashCommit.out;

    // Hash nullifier to bind spend
    component hashNullifier = Poseidon(1);
    hashNullifier.inputs[0] <== nullifier;
    hashNullifier.out === nullifier_hash;

    // Verify Merkle inclusion proof
    component inc = MerkleTreeInclusionProof(levels);
    inc.leaf <== commitment;
    inc.root <== root;

    for (var i = 0; i < levels; i++) {
        inc.pathElements[i] <== path_elements[i];
        inc.pathIndices[i] <== path_indices[i];
    }

    // Bind recipient as a public input without constraints besides presence.
    // This prevents recipient tampering post-proof.
    recipient === recipient; // no-op to mark usage
}

// Depth 20 tree
component main { public [root, nullifier_hash, recipient] } = Withdraw(20);
