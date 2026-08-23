# ChainMind Audit — 3-Member Presentation & Complete Codebase Guide

> **Target Audience:** Hackathon Judges & Evaluators  
> **Level:** Beginner to Intermediate (Crystal clear, zero jargon without explanation)  
> **Structure:** 3 Distinct Team Member Roles, Complete File Breakdown, Exact Presentation Scripts & Judge Q&A Prep.

---

## 📖 The Big Picture: What is ChainMind Audit?

Imagine you send money from your **Chase Bank** account to your friend's **Bank of America** account via an international wire transfer. 
- Chase deducts $100 from you immediately.
- But Bank of America takes 2 hours to deposit it.
- During those 2 hours, if an auditor checks both banks, the money seems to have disappeared into thin air!

In Decentralized Finance (DeFi), this happens across different blockchains (like Ethereum Sepolia and Layer-2 networks). Users move billions of dollars across "cross-chain bridges". Because different blockchains produce blocks at different speeds and don't talk directly to each other, compliance officers cannot easily verify if a transaction succeeded, failed, was delayed, or was stolen.

**ChainMind Audit solves this.** It acts as an automated, real-time AI Auditor that:
1. Listens to transactions happening on multiple blockchains at the same time.
2. Uses Artificial Intelligence to understand what the user was trying to do (e.g., "Bridge transfer", "Token swap", "Deposit").
3. Matches the two sides of the transaction across chains using smart correlation logic.
4. Writes an immutable audit proof back onto the blockchain using a ultra-cheap, gas-efficient smart contract.
5. Exposes a clean REST API for compliance dashboards.

---

## 👥 The 3-Member Team Roles at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MEMBER 1: Web3 & Blockchain Lead                      │
│   • Listens to live blockchain events (Sepolia & Chain B)                   │
│   • Smart Contracts: ChainMindAudit.sol, MockBridgeSender/Receiver          │
│   • Writes reconciled audit records back on-chain (Gas Optimization)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Raw Events
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMBER 2: AI & Data Normalization Lead                   │
│   • Deduplication (stops duplicate/replayed events from breaking system)    │
│   • Normalizes raw blockchain hex data into standard readable format        │
│   • AI Intent Extraction: Local LLM + High-Speed Fallback (<1ms)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Normalized Events + AI Intent
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MEMBER 3: Reconciliation Engine & REST API Lead             │
│   • Multi-Factor Matching Algorithm (Correlates async cross-chain legs)     │
│   • Timeout & Anomaly Detector (Flags delayed/suspicious transactions)      │
│   • Persistence (SQLite WAL) & REST API (/status, /summary, /flagged)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 👤 MEMBER 1: Web3, Blockchain Ingestion & Smart Contracts Lead

### 🎯 Your Focus
You own the **Blockchain Layer**: capturing transactions from the networks and writing audit logs back to the smart contract.

---

### 🎙️ Member 1 Presentation Script (What to say to Judges)

> *"Hi Judges! I'm the Web3 & Smart Contracts Lead for ChainMind Audit.*
> 
> *Our biggest challenge on the blockchain layer was twofold:*
> *First, we need to ingest events from multiple asynchronous blockchains in real time without missing blocks or dropping connections.*
> *Second, we had to store our audit trail on-chain so that it cannot be tampered with by anyone — but writing data to Ethereum is notoriously expensive.*
> 
> *Here is how I solved both:*
> 1. *I built resilient blockchain listeners (`sepolia-listener.ts` and `simulator-listener.ts`) that query JSON-RPC nodes and filter for bridge events.*
> 2. *I designed and deployed `ChainMindAudit.sol`. Instead of using expensive storage slots (`SSTORE`) which cost 20,000 gas each, I engineered an **Event-Log-Only architecture** that emits indexed Solidity events. This reduced on-chain gas costs by **92% (13x cheaper)** down to ~1,500 gas per record.*
> 3. *I also built batching support (`batchRecordReconciliations`) so we can anchor multiple audit records in a single transaction, further amortizing the base 21,000 gas transaction overhead.*
> 
> *Let me walk you through my files and how they connect to the rest of the project."*

---

### 📂 Member 1's Files & Exact Code Breakdown

#### 1. `contracts/src/ChainMindAudit.sol`
- **What it does:** The main smart contract deployed on the blockchain. It acts as the immutable, tamper-proof notary.
- **Key Functions:**
  - `recordReconciliation(AuditRecord calldata rec)`: Emits a single `ReconciliationRecorded` event on-chain.
  - `batchRecordReconciliations(AuditRecord[] calldata records)`: Emits multiple records in a single transaction to save massive gas.
- **Why it's designed this way:** It uses `struct AuditRecord` to avoid EVM "stack-too-deep" errors and uses event logs (`emit`) instead of state mappings so gas is nearly zero.

#### 2. `contracts/src/mocks/MockBridgeSender.sol` & `MockBridgeReceiver.sol`
- **What they do:** These simulate real-world DeFi cross-chain bridge protocols (like LayerZero or Across).
  - `MockBridgeSender`: Emits `BridgeInitiated` when a user locks ETH on Chain A (Sepolia).
  - `MockBridgeReceiver`: Emits `BridgeCompleted` when the bridge relayer delivers funds on Chain B.
- **Why we built them:** Allows the team and judges to trigger live testnet transactions on demand.

#### 3. `src/listeners/sepolia-listener.ts` & `src/listeners/base-listener.ts`
- **What they do:** Connects to Ethereum Sepolia via JSON-RPC, monitors new blocks, and captures `BridgeInitiated` events.
- **Connection:** When a transaction happens, it passes the raw event directly to **Member 2's Normalizer**.

#### 4. `src/blockchain/contract-writer.ts`
- **What it does:** Uses `ethers.js` with the auditor's private key to call `batchRecordReconciliations` on `ChainMindAudit.sol`.
- **Connection:** Receives completed audit records from **Member 3's Reconciliation Engine** and writes them to the blockchain.

---

### 🛡️ Member 1: Judge Q&A Defense

**Judge Question: "Why didn't you store the reconciliation data in contract mappings (`mapping(bytes32 => Record)`)?"**
> *Answer: "Because audit consumers (compliance officers, regulators, and our REST API) read data off-chain. State mappings cost 20,000 gas per slot (`SSTORE`), whereas event logs cost only ~1,500 gas and are indexed by 3 topics (`reconId`, `txHashA`, `txHashB`). This makes the system 13x cheaper while guaranteeing 100% blockchain immutability."*

**Judge Question: "How do you handle RPC rate limits and disconnections?"**
> *Answer: "Our `SepoliaListener` implements polling block cursors with automatic block catch-up. If the socket or RPC drops, it resumes from `lastQueriedBlock + 1` so no events are lost."*

---

# 👤 MEMBER 2: AI Intent Extraction, Data Normalization & Anti-Hallucination Lead

### 🎯 Your Focus
You own the **Intelligence & Data Pipeline**: turning raw, cryptic blockchain hex bytes into clean, structured data and using AI to extract the user's semantic intent with zero hallucination.

---

### 🎙️ Member 2 Presentation Script (What to say to Judges)

> *"Hi Judges! I'm the AI & Data Pipeline Lead for ChainMind Audit.*
> 
> *When blockchain events arrive from Member 1's listeners, they are raw, messy, and asynchronous. A bridge transaction on Ethereum is just a jumble of hex calldata like `0x8b95dd71...`.*
> 
> *My job is to process this raw stream in under 100 milliseconds and accurately classify the user's intent without hallucinating:*
> 1. *First, I built **Layer-1 In-Memory Deduplication (`dedup.ts`)** with automatic TTL eviction. If an event is replayed by the network, we drop it instantly before it touches the database.*
> 2. *Second, I built the **Normalizer (`normalizer.ts`)**, which standardizes addresses into EIP-55 checksums, handles big numbers in Wei as strings to prevent precision loss, and outputs a canonical schema.*
> 3. *Third, for AI Intent Extraction, we integrated a **local LLM via Ollama (`ollama-client.ts`)** running Llama 3.1 8B with `temperature = 0` and strict JSON Schema output enforcement.*
> 4. *To guarantee our non-functional requirement of <3s latency and 100% uptime, I also engineered a **Deterministic Fallback Classifier (`fallback-classifier.ts`)** that maps EVM 4-byte function selectors in `<1ms`. If the LLM is busy or times out (>2s), the fallback engages instantly with zero hallucination.*
> 
> *Now, let's look at how my pipeline feeds Member 3's engine."*

---

### 📂 Member 2's Files & Exact Code Breakdown

#### 1. `src/normalizer/dedup.ts`
- **What it does:** Maintains an in-memory hash set of seen `${chainId}:${txHash}` keys.
- **Why it matters:** In blockchain, network reorgs or WebSocket reconnects frequently resend the same transaction. This layer drops duplicates in O(1) time without doing expensive disk I/O.
- **Key Feature:** Automatically evicts keys older than 30 minutes to prevent RAM memory leaks.

#### 2. `src/normalizer/normalizer.ts`
- **What it does:** Converts raw blockchain events into `NormalizedEvent`:
  - Formats addresses with EIP-55 checksums (`0x742d...` vs `0x742D...`).
  - Extracts the 4-byte function selector (e.g. `0x8b95dd71` = `initiateBridge`).
  - Converts ETH values into Wei strings (preventing JavaScript floating-point rounding bugs).

#### 3. `src/ai/prompts.ts`
- **What it does:** Contains the strict anti-hallucination prompt.
- **The Golden Rules in the Prompt:**
  - "Respond ONLY in JSON."
  - "Must use one of: `BRIDGE_INITIATE`, `BRIDGE_COMPLETE`, `SWAP`, `DEPOSIT`, `WITHDRAW`, `TRANSFER`, `UNKNOWN`."
  - "If uncertain, return UNKNOWN. Never guess."

#### 4. `src/ai/ollama-client.ts`
- **What it does:** Communicates with local Ollama using OpenAI-compatible endpoints with native JSON schema formatting.
- **Constraint Compliance:** Since the hackathon forbids external cloud SaaS APIs, this runs 100% locally on the machine.

#### 5. `src/ai/fallback-classifier.ts` & `src/ai/intent-extractor.ts`
- **What they do:** The orchestrator. It tries the local LLM first; if Ollama takes >2 seconds or returns low confidence (<0.5), it instantly executes the 4-byte selector lookup (`0x8b95dd71` ➔ `BRIDGE_INITIATE`).
- **Connection:** Updates the event in SQLite with `extracted_intent` and `confidence_score`, signaling to **Member 3** that the event is ready for matching.

---

### 🛡️ Member 2: Judge Q&A Defense

**Judge Question: "How do you prevent the AI from hallucinating a wrong transaction intent?"**
> *Answer: "Three strict guardrails: First, we set LLM temperature to 0.0 with native structured JSON schema enforcement. Second, we enforce a confidence floor (0.5) — any score below is downgraded to UNKNOWN. Third, we have a deterministic 4-byte EVM selector fallback table that provides 100% mathematically verifiable classifications for known DeFi signatures."*

**Judge Question: "Why store `value_wei` as a string instead of a JavaScript Number?"**
> *Answer: "JavaScript Numbers lose precision above $2^{53} - 1$ (approx 9,007 ETH in wei). Using strings and `BigInt` prevents catastrophic precision loss in financial reconciliation."*

---

# 👤 MEMBER 3: Reconciliation Engine, REST API & Compliance Lead

### 🎯 Your Focus
You own the **Core Logic & User Experience**: correlating the two legs of the cross-chain transaction, flagging fraud or timeouts, storing records, and serving the REST API.

---

### 🎙️ Member 3 Presentation Script (What to say to Judges)

> *"Hi Judges! I'm the Reconciliation Engine & REST API Lead for ChainMind Audit.*
> 
> *The fundamental problem in cross-chain DeFi is that a cross-chain swap has **no shared transaction hash or on-chain foreign key**. Leg 1 happens on Sepolia with TxHash A, and Leg 2 happens on Chain B with TxHash B seconds or minutes later.*
> 
> *My job was to build the brain that proves whether TxHash A and TxHash B are the exact same trade:*
> 1. *I developed our **Multi-Factor Weighted Matching Heuristic (`matcher.ts`)**. We calculate a composite similarity score (0.0 to 1.0) based on: Sender Address (1.5 weight), Receiver/Relayer routing (1.0 weight), Value Delta with 1% slippage tolerance (1.0 weight), and Temporal Proximity within a 15-minute window (0.5 weight).*
> 2. *I built the **Reconciliation Engine (`engine.ts`)** which continuously scans pending events, verifies that Member 2's AI intents are complementary (`BRIDGE_INITIATE` matches `BRIDGE_COMPLETE`), and links them together.*
> 3. *I implemented the **Timeout Watcher (`timeout-watcher.ts`)**: if a transaction initiates on Chain A but never appears on Chain B within 15 minutes, it is automatically flagged as `FLAGGED_TIMEOUT`.*
> 4. *Finally, I built our Express **REST API (`server.ts` & `reconciliation.ts`)** with 3 production endpoints (`/status`, `/summary`, `/flagged`), input validation, and rate limiting.*
> 
> *Let me demonstrate how this works in real time!"*

---

### 📂 Member 3's Files & Exact Code Breakdown

#### 1. `src/reconciliation/matcher.ts`
- **What it does:** Calculates the composite match score between any two pending events:
  - Factor 1: `senderA === senderB` (Weight 1.5 - Mandatory)
  - Factor 2: `receiverA === receiverB` or bridge self-receive (Weight 1.0)
  - Factor 3: `valueA === valueB` (Weight 1.0; if within 1% slippage, Weight 0.5)
  - Factor 4: `|timeA - timeB| <= 900s` (Weight 0.5)
- **Threshold:** Score must be $\ge 0.625$ (2.5 / 4.0) to declare a match.
- **Intent Check:** Verifies `validateIntentConsistency()` so incompatible intents (e.g. Bridge vs Swap) are flagged as `FLAGGED_INTENT_CONFLICT`.

#### 2. `src/reconciliation/timeout-watcher.ts`
- **What it does:** Scans SQLite for events older than 15 minutes that never found a counterpart.
- **Compliance Output:** Marks them as `FLAGGED_TIMEOUT` with notes: *"Confirmation timeout: No counterpart transaction detected within tolerance window."*

#### 3. `src/storage/database.ts`, `event-repository.ts`, `recon-repository.ts`
- **What they do:** High-speed embedded SQLite database with Write-Ahead Logging (`WAL`).
- **Why SQLite:** Zero external dependencies (no PostgreSQL or Redis to install), embedded directly in the process, sub-millisecond query latency.

#### 4. `src/api/server.ts` & `src/api/routes/reconciliation.ts`
- **What they do:** Implements the REST API contract required by the PRD:
  - `GET /api/v1/reconciliation/status?tx_hash=0x...`: Returns complete audit record for a single transaction.
  - `GET /api/v1/reconciliation/summary`: Returns aggregate statistics (total ingested, matched, pending, average latency, and on-chain anchor count).
  - `GET /api/v1/reconciliation/flagged`: Returns all flagged timeouts, slippage discrepancies, or anomalies.
  - `POST /api/v1/simulate/cross-chain-swap`: Developer sandbox endpoint to demonstrate a live swap.

---

### 🛡️ Member 3: Judge Q&A Defense

**Judge Question: "What happens if a user submits two identical transactions with the exact same amount 5 seconds apart?"**
> *Answer: "Our matcher matches the first counterpart in FIFO order based on timestamp proximity. The second counterpart will either match the second transaction or, if unfulfilled, be flagged as `FLAGGED_TIMEOUT` by our Timeout Watcher. In production, we also check on-chain nonces."*

**Judge Question: "How do you handle out-of-order events where the destination chain confirms before the source chain?"**
> *Answer: "Our algorithm is timestamp-independent. We query all pending events in the time window regardless of arrival order, comparing `block_timestamp` from the chain rather than local ingestion time. If the destination arrived first, it still matches and is annotated with an out-of-order note."*

---

# 🔄 Master Flow: How a Transaction Travels Through All 3 Members' Code

Here is the exact step-by-step lifecycle of a transaction in ChainMind Audit:

```
[ Step 1: Blockchain Event Ingestion ]
    │  • User initiates bridge transfer on Sepolia
    │  • Member 1's `sepolia-listener.ts` detects the event
    ▼
[ Step 2: Deduplication & Normalization ]
    │  • Member 2's `dedup.ts` checks in-memory set (drops if duplicate)
    │  • Member 2's `normalizer.ts` formats addresses & extracts selector `0x8b95dd71`
    │  • Stored in Member 3's SQLite table `event_log` as 'PENDING'
    ▼
[ Step 3: AI Semantic Intent Extraction ]
    │  • Member 2's `intent-extractor.ts` calls Ollama / Fallback Classifier
    │  • Classifies event as 'BRIDGE_INITIATE' with 0.99 confidence
    │  • Updates event in SQLite
    ▼
[ Step 4: Destination Chain Event Ingestion ]
    │  • Counterpart event arrives on Chain B (simulated or Hoodi)
    │  • Steps 1–3 repeat for Chain B ➔ classified as 'BRIDGE_COMPLETE'
    ▼
[ Step 5: Reconciliation Matching ]
    │  • Member 3's `reconciliation/engine.ts` runs matching tick
    │  • `matcher.ts` correlates sender, receiver, values, and timestamps
    │  • Score = 0.938 ➔ Status becomes 'MATCHED'
    │  • Creates record in `recon_records` table
    ▼
[ Step 6: On-Chain Audit Anchoring ]
    │  • Member 1's `contract-writer.ts` picks up the unanchored record
    │  • Calls `batchRecordReconciliations` on `ChainMindAudit.sol`
    │  • Emits permanent event on Sepolia and saves `anchor_tx_hash`
    ▼
[ Step 7: REST API Query ]
    │  • Compliance officer calls `GET /api/v1/reconciliation/summary`
    │  • Member 3's Express server returns complete JSON audit summary
```

---

# 📁 Complete File-by-File Reference Map

| File Path | Owner | Description | Connects To |
|---|---|---|---|
| `contracts/src/ChainMindAudit.sol` | **Member 1** | On-chain audit smart contract with event logging | `contract-writer.ts` |
| `contracts/src/mocks/MockBridgeSender.sol` | **Member 1** | Emits `BridgeInitiated` events on Sepolia | `sepolia-listener.ts` |
| `contracts/src/mocks/MockBridgeReceiver.sol` | **Member 1** | Emits `BridgeCompleted` events on Chain B | `simulator-listener.ts` |
| `src/listeners/sepolia-listener.ts` | **Member 1** | Listens to Ethereum Sepolia testnet RPC | `normalizer.ts` |
| `src/listeners/simulator-listener.ts` | **Member 1** | Simulates Chain B counterpart transactions | `normalizer.ts` |
| `src/blockchain/contract-writer.ts` | **Member 1** | Writes audit records on-chain via ethers.js | `ChainMindAudit.sol` |
| `src/normalizer/dedup.ts` | **Member 2** | In-memory TTL deduplication filter | `normalizer.ts` |
| `src/normalizer/normalizer.ts` | **Member 2** | Formats raw events into canonical schema | `event-repository.ts` |
| `src/ai/prompts.ts` | **Member 2** | Anti-hallucination prompt and JSON schema | `ollama-client.ts` |
| `src/ai/ollama-client.ts` | **Member 2** | Local LLM inference client via Ollama | `intent-extractor.ts` |
| `src/ai/fallback-classifier.ts` | **Member 2** | Deterministic EVM function selector classifier | `intent-extractor.ts` |
| `src/ai/intent-extractor.ts` | **Member 2** | AI intent orchestrator | `event-repository.ts` |
| `src/reconciliation/matcher.ts` | **Member 3** | 4-factor composite identity resolution | `engine.ts` |
| `src/reconciliation/timeout-watcher.ts` | **Member 3** | Flags delayed/stale events (>15 min) | `recon-repository.ts` |
| `src/reconciliation/engine.ts` | **Member 3** | Master reconciliation matching loop | `contract-writer.ts` |
| `src/storage/database.ts` | **Member 3** | SQLite database initialization & WAL mode | Repositories |
| `src/storage/event-repository.ts` | **Member 3** | Event CRUD and pending queries | `engine.ts` |
| `src/storage/recon-repository.ts` | **Member 3** | Audit record persistence & summaries | `reconciliation.ts` |
| `src/api/server.ts` | **Member 3** | Express app, rate limiting & middleware | `reconciliation.ts` |
| `src/api/routes/reconciliation.ts` | **Member 3** | REST API endpoints (`/status`, `/summary`, `/flagged`) | Frontend / Evaluators |
| `src/index.ts` | **All** | Master bootstrap orchestrating all layers | System Entry Point |
