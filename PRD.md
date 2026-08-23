# ChainMind Audit

# ChainMind Audit

Title:
ChainMind Audit

Background:
A decentralized finance (DeFi) platform uses multiple blockchain networks to process trades, but its on-chain transaction logs are inconsistent across chains due to differing block times and confirmation delays. This causes discrepancies in real-time audit reports, leading to compliance risks and delayed reconciliation.

Problem Statement:
When a user initiates a cross-chain swap, the transaction is recorded on multiple blockchains with asynchronous confirmations. A compliance officer needs to verify whether the transaction was properly executed and reconciled within 24 hours. However, current tools cannot correlate events across chains in real time, leading to false positives in fraud detection and audit failures. With only 6 hours to build, your team must create a system that detects and resolves these inconsistencies using blockchain and AI.

Scope:
Develop a system that ingests real-time blockchain events from two or more chains, uses Gen-AI to interpret transaction semantics, and applies reconciliation logic to detect and flag inconsistencies. The system must be able to process incoming events and generate audit-ready summaries.

MVP Scope:
• Ingest real-time blockchain events from two testnet chains (e.g., Goerli and Sepolia) via WebSocket or RPC
• Use a Gen-AI model to analyze transaction semantics and extract intent (e.g., 'swap', 'deposit')
• Reconcile events across chains using timestamp-based logic and identity resolution
• Store reconciled audit records on-chain using a smart contract
• Expose a REST endpoint that returns a JSON summary of reconciliation status and flagged issues

Advanced/Bonus Scope:
• Add a Gen-AI agent that suggests corrective actions (e.g., 'replay transaction X')
• Implement a retry mechanism for failed reconciliations
• Support a third blockchain network (e.g., Polygon Mumbai)

Functional Requirements:
- The system must ingest blockchain events from at least two testnet chains in real time
- A Gen-AI model must interpret transaction data and extract semantic intent
- The backend must reconcile events across chains based on sender, receiver, and value
- Reconciliation results must be stored on-chain using a smart contract
- The system must expose a REST API endpoint that returns reconciliation status
- The reconciliation logic must detect and flag inconsistencies (e.g., missing confirmations)
- The system must handle duplicate or out-of-order events without breaking
- The Gen-AI model must be prompt-engineered to avoid hallucinations

Non-Functional Requirements:
- Reconciliation latency must be under 3 seconds per event
- The system must process at least 10 events per minute without dropping messages
- On-chain storage must be gas-efficient and avoid excessive transaction costs

Constraints:
- The entire MVP must be built and demoed within 6 hours
- Only the Goerli and Sepolia testnets are allowed for blockchain data
- No external APIs or third-party services are permitted
- All Gen-AI logic must be prompt-based or lightweight fine-tuned; no model training
- The backend must be REST-based; no GraphQL or gRPC
- The smart contract must be deployed on-chain and interacted with via RPC

Deliverables:
- A running system that ingests blockchain events and reconciles them
- A smart contract deployed on-chain storing reconciliation results
- A REST API endpoint returning reconciliation status
- A demo video showing the reconciliation of a sample transaction
- A README with setup instructions and architecture overview
