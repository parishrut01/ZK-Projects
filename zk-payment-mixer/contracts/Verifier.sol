// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Verifier {
    function verifyProof(
        uint256[2] memory /*a*/,
        uint256[2][2] memory /*b*/,
        uint256[2] memory /*c*/,
        uint256[3] memory /*input*/
    ) external pure returns (bool) {
        // Placeholder: replace with snarkjs-generated verifier.
        return true;
    }
}
