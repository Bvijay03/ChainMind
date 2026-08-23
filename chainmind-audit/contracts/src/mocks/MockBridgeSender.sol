// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockBridgeSender
/// @notice Simulates a bridge initiation on the source chain.
/// @dev Emits BridgeInitiated event when ETH is sent to the contract.
contract MockBridgeSender {
    
    event BridgeInitiated(
        address indexed sender,
        address indexed receiver,
        uint256 value,
        uint256 indexed destinationChainId,
        uint256 timestamp,
        bytes32 bridgeRequestId
    );

    uint256 private _nonce;

    /// @notice Initiate a mock bridge transfer.
    /// @param receiver The intended receiver on the destination chain.
    /// @param destinationChainId The target chain ID.
    function initiateBridge(
        address receiver,
        uint256 destinationChainId
    ) external payable {
        require(msg.value > 0, "MockBridgeSender: value must be > 0");
        
        _nonce++;
        bytes32 bridgeRequestId = keccak256(
            abi.encodePacked(msg.sender, receiver, msg.value, block.timestamp, _nonce)
        );

        emit BridgeInitiated(
            msg.sender,
            receiver,
            msg.value,
            destinationChainId,
            block.timestamp,
            bridgeRequestId
        );
    }

    /// @notice Allow contract to receive ETH for testing.
    receive() external payable {}
}
