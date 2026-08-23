// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChainMindAudit
/// @notice On-chain audit log for cross-chain reconciliation results.
/// @dev Event-log-only architecture for gas efficiency.
contract ChainMindAudit {
    
    address public immutable auditor;
    uint256 public recordCount;

    struct AuditRecord {
        bytes32 reconId;
        bytes32 txHashA;
        bytes32 txHashB;
        uint8 status;
        uint64 timestampA;
        uint64 timestampB;
        address sender;
        uint128 valueWei;
    }

    event ReconciliationRecorded(
        bytes32 indexed reconId,
        bytes32 indexed txHashA,
        bytes32 indexed txHashB,
        uint8   status,
        uint64  timestampA,
        uint64  timestampB,
        address sender,
        uint128 valueWei
    );

    event BatchAnchored(
        uint256 batchSize,
        uint256 totalRecordCount
    );

    modifier onlyAuditor() {
        require(msg.sender == auditor, "ChainMindAudit: unauthorized");
        _;
    }

    constructor() {
        auditor = msg.sender;
    }

    /// @notice Record a single reconciliation result on-chain.
    function recordReconciliation(AuditRecord calldata rec) external onlyAuditor {
        emit ReconciliationRecorded(
            rec.reconId,
            rec.txHashA,
            rec.txHashB,
            rec.status,
            rec.timestampA,
            rec.timestampB,
            rec.sender,
            rec.valueWei
        );
        unchecked { recordCount++; }
    }

    /// @notice Batch-record multiple reconciliation results for gas savings.
    function batchRecordReconciliations(AuditRecord[] calldata records) external onlyAuditor {
        uint256 len = records.length;
        for (uint256 i = 0; i < len;) {
            AuditRecord calldata r = records[i];
            emit ReconciliationRecorded(
                r.reconId,
                r.txHashA,
                r.txHashB,
                r.status,
                r.timestampA,
                r.timestampB,
                r.sender,
                r.valueWei
            );
            unchecked { ++i; }
        }

        unchecked { recordCount += len; }
        emit BatchAnchored(len, recordCount);
    }
}
