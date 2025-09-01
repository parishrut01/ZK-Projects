ragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/**
 * KYC Age Verification Circuit
 * 
 * This circuit proves that:
 * 1. The user knows their age (private input)
 * 2. Their age is >= 18
 * 3. The age hash matches the expected hash from the credential
 * 4. The credential is signed by a trusted issuer
 * 
 * For simplicity, we use a mock signature verification where the signature
 * is just Poseidon(age, issuerPrivateKey). In production, use EdDSA.
 */
template KYCAgeVerification() {
    // Private inputs (known only to the user)
    signal private input age;           // User's actual age
    signal private input signature;     // Signature from trusted issuer
    signal private input issuerPrivateKey; // Mock private key (in production, use EdDSA)
    
    // Public inputs (visible on-chain)
    signal input ageHash;               // Poseidon(age) - from the credential
    signal input issuerPublicKey;       // Public key of the trusted issuer
    signal input minAge;                // Minimum required age (typically 18)
    
    // Output
    signal output valid;                // 1 if verification passes, 0 otherwise
    
    // Components
    component ageHasher = Poseidon(1);
    component signatureHasher = Poseidon(2);
    component ageComparator = GreaterEqualThan(8); // Support ages up to 255
    
    // Constraint 1: Verify that the provided age hashes to the expected ageHash
    ageHasher.inputs[0] <== age;
    ageHash === ageHasher.out;
    
    // Constraint 2: Verify that age >= minAge (typically 18)
    ageComparator.in[0] <== age;
    ageComparator.in[1] <== minAge;
    
    // Constraint 3: Mock signature verification
    // In production, replace this with EdDSA signature verification
    signatureHasher.inputs[0] <== age;
    signatureHasher.inputs[1] <== issuerPrivateKey;
    signature === signatureHasher.out;
    
    // Constraint 4: Verify issuer public key relationship (mock)
    // In production, this would be handled by EdDSA verification
    component pubKeyHasher = Poseidon(1);
    pubKeyHasher.inputs[0] <== issuerPrivateKey;
    issuerPublicKey === pubKeyHasher.out;
    
    // Output is valid only if age >= minAge
    valid <== ageComparator.out;
}

component main = KYCAgeVerification();
