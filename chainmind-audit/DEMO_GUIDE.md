# ChainMind Audit — Complete Demonstration & Execution Guide

This guide provides a step-by-step walkthrough for running and demonstrating **ChainMind Audit** during a live presentation or testing.

---

## ⚠️ Important: Working Directory
Make sure your terminal is inside the **`chainmind-audit`** directory:

```powershell
cd d:\chainmind\2\chainmind-audit
```

---

## 🧪 Step 1: Automated Test Suites

Demonstrate that both the smart contracts and the application pipeline pass 100% of tests:

### A. Run Smart Contract Tests (Hardhat)
```powershell
npm run test:contracts
```
**Output:** 8/8 tests passing.

### B. Run Unit & Integration Tests (Vitest)
```powershell
npm test
```
**Output:** 15/15 tests passing across 5 test suites.

---

## 🚀 Step 2: Start the Backend Server (Terminal 1)

In **Terminal 1**, start the server:

```powershell
cd d:\chainmind\2\chainmind-audit
npm start
```
*(Leave this terminal running in the background).*

---

## 🎬 Step 3: Automated Live Demo Script (Terminal 2)

In **Terminal 2**, run the one-command interactive demo:

```powershell
cd d:\chainmind\2\chainmind-audit
npm run demo
```

---

## 🌐 Step 4: Interactive Testing (PowerShell Native)

In PowerShell, use these native commands:

### 1. Trigger a Cross-Chain Swap Simulation
```powershell
$body = @{
    sender = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
    value_eth = "1.25"
    delay_seconds = 2
} | ConvertTo-Json

$res = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/simulate/cross-chain-swap" -Method Post -ContentType "application/json" -Body $body
$res
```

---

### 2. Check Reconciliation Status for that Transaction
*(Wait 3 seconds for async cross-chain confirmation)*:

```powershell
(Invoke-RestMethod -Uri "http://localhost:3000/api/v1/reconciliation/status?tx_hash=$($res.source_tx_hash)").data | ConvertTo-Json -Depth 5
```

---

### 3. Query Real-Time Compliance Audit Summary Report
```powershell
(Invoke-RestMethod -Uri "http://localhost:3000/api/v1/reconciliation/summary").data.summary | ConvertTo-Json
```

---

### 4. Query Flagged Discrepancies (Anomalies / Timeouts)
```powershell
(Invoke-RestMethod -Uri "http://localhost:3000/api/v1/reconciliation/flagged").data | ConvertTo-Json -Depth 5
```

---

### 5. Check Service Health
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```
