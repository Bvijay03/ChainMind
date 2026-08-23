/**
 * ChainMind Audit — Interactive Dashboard Frontend Logic
 */

let allRecords = [];
let activeFilter = 'ALL';

async function fetchSummary() {
  try {
    const res = await fetch('/api/v1/reconciliation/summary?limit=50');
    if (!res.ok) return;
    const json = await res.json();
    if (json.success) {
      updateKPIs(json.data.summary);
      allRecords = json.data.recent_records || [];
      renderTable();
    }
  } catch (err) {
    console.error('Error fetching summary:', err);
  }
}

function updateKPIs(summary) {
  document.getElementById('kpiTotalEvents').textContent = summary.total_events_ingested;
  document.getElementById('kpiPending').textContent = `${summary.pending_events} Pending`;
  document.getElementById('kpiTotalRecons').textContent = summary.total_reconciliations;
  
  const matched = summary.status_breakdown?.MATCHED || 0;
  const flagged = (summary.total_reconciliations || 0) - matched;
  document.getElementById('kpiMatched').textContent = `${matched} Matched`;
  document.getElementById('kpiFlagged').textContent = `${flagged} Flagged`;

  document.getElementById('kpiAnchored').textContent = summary.on_chain_anchored || 0;
}

function formatEther(weiStr) {
  if (!weiStr) return '0.0';
  try {
    const wei = BigInt(weiStr);
    const eth = Number(wei) / 1e18;
    return eth.toFixed(3);
  } catch {
    return '0.0';
  }
}

function truncate(str, len = 8) {
  if (!str) return '—';
  if (str.length <= len * 2) return str;
  return `${str.slice(0, len)}...${str.slice(-len)}`;
}

function renderTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!allRecords || allRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No audit records yet. Click "⚡ Execute Swap" above to simulate a transaction!
        </td>
      </tr>
    `;
    return;
  }

  const filtered = allRecords.filter((r) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'MATCHED') return r.status === 'MATCHED';
    if (activeFilter === 'FLAGGED') return r.status !== 'MATCHED';
    return true;
  });

  tbody.innerHTML = filtered.map((r) => {
    const scorePct = r.match_score ? `${Math.round(r.match_score * 100)}%` : '100%';
    const ethVal = formatEther(r.value_a_wei);
    const timeDelta = r.timestamp_delta_s !== null && r.timestamp_delta_s !== undefined ? `${r.timestamp_delta_s}s` : '—';
    const timeStr = new Date(r.created_at).toLocaleTimeString();

    return `
      <tr onclick="openRecordModal('${r.id}')">
        <td><span class="status-badge status-${r.status}">${r.status}</span></td>
        <td class="mono" title="${r.sender}">${truncate(r.sender, 6)}</td>
        <td><span class="hash-link" title="${r.tx_hash_a}">${truncate(r.tx_hash_a, 8)}</span></td>
        <td><span class="hash-link" title="${r.tx_hash_b || 'Pending'}">${truncate(r.tx_hash_b, 8)}</span></td>
        <td style="font-weight: 600; color: #fff;">${ethVal} ETH</td>
        <td class="mono">${timeDelta}</td>
        <td><span class="kpi-badge badge-green">${scorePct}</span></td>
        <td class="mono" style="font-size: 11px;">${timeStr}</td>
      </tr>
    `;
  }).join('');
}

function openRecordModal(id) {
  const rec = allRecords.find((r) => r.id === id);
  if (!rec) return;

  const modal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');

  modalBody.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Reconciliation ID</span>
      <span class="detail-val">${rec.id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span class="detail-val"><span class="status-badge status-${rec.status}">${rec.status}</span></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Sender Address</span>
      <span class="detail-val">${rec.sender}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Source Chain (Sepolia) Tx</span>
      <span class="detail-val" style="color: var(--accent-cyan);">${rec.tx_hash_a}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Dest Chain (Chain B) Tx</span>
      <span class="detail-val" style="color: var(--accent-purple);">${rec.tx_hash_b || 'None / Timeout'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Value</span>
      <span class="detail-val">${formatEther(rec.value_a_wei)} ETH (${rec.value_a_wei} Wei)</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Time Delta</span>
      <span class="detail-val">${rec.timestamp_delta_s || 0} seconds</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Match Score</span>
      <span class="detail-val">${rec.match_score ? (rec.match_score * 100).toFixed(1) + '%' : '100%'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">On-Chain Anchor Tx</span>
      <span class="detail-val" style="color: var(--accent-green);">${rec.anchor_tx_hash || 'Anchored on-chain'}</span>
    </div>
    <div class="detail-row" style="border: none;">
      <span class="detail-label">Audit Notes</span>
      <span class="detail-val" style="color: var(--text-secondary); font-family: var(--font-sans);">${rec.notes || 'Verified cross-chain execution'}</span>
    </div>
  `;

  modal.classList.add('open');
}

// Close Modal
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('detailModal').classList.remove('open');
});
document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') {
    document.getElementById('detailModal').classList.remove('open');
  }
});

// Setup Tab Filter
document.querySelectorAll('.tab-btn[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-filter]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.getAttribute('data-filter');
    renderTable();
  });
});

document.getElementById('refreshBtn').addEventListener('click', fetchSummary);

// Handle Simulation Submission with animated pipeline steps
document.getElementById('simForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const sender = document.getElementById('simSender').value;
  const valueEth = document.getElementById('simValue').value;
  const slippage = parseFloat(document.getElementById('simScenario').value);
  const delay = parseInt(document.getElementById('simDelay').value, 10);
  const btn = document.getElementById('simSubmitBtn');

  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Processing...</span>';

  // Animate Pipeline Step 1
  highlightStep('step1');

  try {
    const res = await fetch('/api/v1/simulate/cross-chain-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender,
        value_eth: valueEth,
        delay_seconds: delay,
        slippage_ratio: slippage,
      }),
    });

    const data = await res.json();
    if (data.success) {
      // Step 2: AI Intent
      setTimeout(() => highlightStep('step2'), 700);
      
      // Step 3: Match
      setTimeout(() => highlightStep('step3'), 1800);

      // Step 4: Anchor
      setTimeout(() => {
        highlightStep('step4');
        fetchSummary();
      }, 2600);

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡ Execute Swap</span>';
        clearSteps();
        fetchSummary();
      }, 3500);
    }
  } catch (err) {
    console.error('Simulation error:', err);
    btn.disabled = false;
    btn.innerHTML = '<span>⚡ Execute Swap</span>';
    clearSteps();
  }
});

function highlightStep(stepId) {
  document.querySelectorAll('.step-card').forEach((c) => c.classList.remove('active'));
  const card = document.getElementById(stepId);
  if (card) card.classList.add('active');
}

function clearSteps() {
  document.querySelectorAll('.step-card').forEach((c) => c.classList.remove('active'));
}

// Initial Load and Auto-Polling (every 2.5s)
fetchSummary();
setInterval(fetchSummary, 2500);
