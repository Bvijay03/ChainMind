// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockBridgeReceiver
/// @notice Simulates a bridge completion on the destination chain.
/// @dev Emits BridgeCompleted event when a bridge transfer is finalized.
contract MockBridgeReceiver {
    
    event BridgeCompleted(
        address indexed sender,
        address indexed receiver,
        uint256 value,
        uint256 indexed sourceChainId,
        uint256 timestamp,
        bytes32 bridgeRequestId
    );

    address public relayer;

    modifier onlyRelayer() {
        require(msg.sender == relayer, "MockBridgeReceiver: unauthorized");
        _;
    }

    constructor() {
        relayer = msg.sender;
    }

    /// @notice Complete a mock bridge transfer on the destination chain.
    /// @param sender The original sender on the source chain.
    /// @param receiver The receiver on this chain.
    /// @param value The bridged value in wei.
    /// @param sourceChainId The source chain ID.
    /// @param bridgeRequestId The bridge request ID from the source chain.
    function completeBridge(
        address sender,
        address receiver,
        uint256 value,
        uint256 sourceChainId,
        bytes32 bridgeRequestId
    ) external onlyRelayer {
        emit BridgeCompleted(
            sender,
            receiver,
            value,
            sourceChainId,
            block.timestamp,
            bridgeRequestId
        );
    }

    /// @notice Allow contract to receive ETH for testing.
    receive() external payable {}
}
