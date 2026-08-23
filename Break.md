ChainMind Audit — Project Showcase

Overview

ChainMind Audit is an AI-assisted cross-chain audit and reconciliation system for DeFi transactions.

What the MVP Demonstrates

Real-time blockchain event ingestion from two testnet chains

Gen-AI interpretation of transaction intent

Cross-chain transaction reconciliation

Detection of inconsistencies such as value mismatches or missing confirmations

On-chain storage of reconciliation results through a smart contract

REST API for reconciliation status

Architecture

Blockchain Events
→ Event Normalization
→ Gen-AI Intent Analysis
→ Cross-Chain Reconciliation
→ Smart Contract Audit Record
→ REST API / Dashboard

Example

Successful Reconciliation

Sepolia transaction:

Sender: Alice

Receiver: Bridge

Value: 100

Intent: Swap

Goerli transaction:

Sender: Alice

Receiver: Bridge

Value: 100

Intent: Swap

Result: RECONCILED

Flagged Reconciliation

Sepolia transaction:

Value: 100

Goerli transaction:

Value: 80

Result: FLAGGED — Value mismatch

Team Structure

Blockchain & Smart Contract

AI & Reconciliation

Backend, REST API & UI

Required Deliverables

Running reconciliation system

Deployed smart contract

REST API endpoint

Demo video

README with setup and architecture detail
