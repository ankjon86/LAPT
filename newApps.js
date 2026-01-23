// newApps.js (updated) — lightweight loading indicator for "Add New Application" button
console.log('newApps.js (cleaned) loaded');

// ---- State ----
let additionalDocumentCount = 2;

// ---- Small helpers ----
function safeValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}
function safeText(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.textContent : fallback;
}
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ---- Utility: Reset All Fields ----
function resetNewApplicationModal() {
  const inputs = document.querySelectorAll('#newApplicationModal input, #newApplicationModal textarea');
  inputs.forEach(input => {
    try {
      if (input.type === 'file') input.value = '';
      else if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
      else input.value = '';
    } catch (e) {
      // ignore read-only elements
    }
  });

  // reset file-name displays (IDs used in the modal)
  ['bank-statement-name','pay-slip-name','undertaking-name','loan-statement-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'No file chosen';
      el.style.color = '';
    }
  });

  // clear dynamic tables
  const lhTable = document.getElementById('loanHistoryTable');
  if (lhTable && lhTable.querySelector('tbody')) lhTable.querySelector('tbody').innerHTML = '';

  const pbTable = document.getElementById('personalBudgetTable');
  if (pbTable && pbTable.querySelector('tbody')) pbTable.querySelector('tbody').innerHTML = '';

  // reset counters / derived values
  additionalDocumentCount = 2;
  calculateTotals();
  calculateBudget();
}

// ---- Modal readiness helper ----
function isModalReady() {
  const modal = document.getElementById('newApplicationModal');
  if (!modal) return false;
  const modalContent = modal.querySelector('.modal-content');
  return modalContent && modalContent.hasChildNodes();
}

// ---- Add button lightweight loader helper ----
function setAddAppButtonLoading(loading, text = 'Loading application...') {
  const btn = document.querySelector('.add-app-btn');
  if (!btn) return;
  if (loading) {
    btn.dataset.prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    btn.classList.add('loading-inline');
  } else {
    btn.disabled = false;
    if (btn.dataset.prevHtml) {
      btn.innerHTML = btn.dataset.prevHtml;
      delete btn.dataset.prevHtml;
    }
    btn.classList.remove('loading-inline');
  }
}

// ---- Show / Hide new application modal ----
async function showNewApplicationModal(existingAppNumber = null) {
  console.log('showNewApplicationModal called with:', existingAppNumber);

  const modal = document.getElementById('newApplicationModal');
  if (!modal) {
    console.error('Modal element not found!');
    alert('Error: Application form not loaded properly. Please refresh the page.');
    return;
  }

  // Ensure modal content is loaded (loads newApps.html into #newApplicationModalContent)
  const modalContent = document.getElementById('newApplicationModalContent');
  if (!modalContent) {
    console.error('#newApplicationModalContent not found');
    alert('Internal error: modal content container missing');
    return;
  }

  // Load content if not already loaded
  if (!isModalReady()) {
    try {
      // Use lightweight inline spinner on the Add button to avoid global overlay
      setAddAppButtonLoading(true, 'Loading form...');
      const loaded = await loadModalContent('new'); // uses loader in Main.js
      setAddAppButtonLoading(false);
      if (!loaded) {
        alert('Failed to load application form.');
        return;
      }
    } catch (err) {
      setAddAppButtonLoading(false);
      alert('Error loading form: ' + (err && err.message ? err.message : err));
      return;
    }
  }

  // Reset form to a clean state
  resetNewApplicationModal();

  // Show the modal
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';

  // If editing an existing app, load it; otherwise get new context
  if (existingAppNumber) {
    loadExistingApplication(existingAppNumber);
  } else {
    try {
      // Use lightweight Add button indicator while requesting context rather than full-screen overlay
      setAddAppButtonLoading(true, 'Preparing application...');
      const response = await window.apiService.getNewApplicationContext({ showLoading: false });
      setAddAppButtonLoading(false);

      if (response && response.success && response.data) {
        window.currentAppNumber = response.data.appNumber;
        window.currentAppFolderId = response.data.folderId;
        const appNumberEl = document.getElementById('app-number');
        if (appNumberEl) appNumberEl.textContent = window.currentAppNumber || '';
        openTab('tab1');
      } else {
        throw new Error(response?.message || 'Failed to get application context');
      }
    } catch (error) {
      setAddAppButtonLoading(false);
      console.error('Error in showNewApplicationModal:', error);
      alert('Error starting new application: ' + (error?.message || error));
    }
  }
}

// ---- Close modal ----
function closeNewApplicationModal() {
  console.log('closeNewApplicationModal called');
  const modal = document.getElementById('newApplicationModal');
  if (modal) {
    modal.style.display = 'none';
    modal.style.opacity = '';
    modal.style.visibility = '';
    document.body.style.overflow = 'auto';
    resetNewApplicationModal();
    window.currentAppNumber = '';
    const appNumberEl = document.getElementById('app-number');
    if (appNumberEl) appNumberEl.textContent = '';
  }
}
window.closeNewApplicationModal = closeNewApplicationModal;
window.showNewApplicationModal = showNewApplicationModal;

// ---- init scripts ----
function initNewApplicationScripts() {
  console.log('Initializing new application scripts...');
  calculateTotals();
  calculateBudget();

  // Attach file input preview handlers
  ['bank-statement','pay-slip','undertaking','loan-statement'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.removeEventListener('change', function(){}); // harmless
      input.addEventListener('change', function() { updateFilePreview(this); });
    }
  });

  // Modal click outside to close
  const modal = document.getElementById('newApplicationModal');
  if (modal) {
    modal.removeEventListener('click', handleModalClick);
    modal.addEventListener('click', handleModalClick);
  }
}
document.addEventListener('DOMContentLoaded', initNewApplicationScripts);

// ---- modal click handler ----
function handleModalClick(event) {
  const modal = document.getElementById('newApplicationModal');
  if (event.target === modal) {
    closeNewApplicationModal();
  }
}

// ---- Tabs ----
function openTab(tabName) {
  // Work only when modal content exists
  const modal = document.getElementById('newApplicationModal');
  if (!modal) return;

  const tabs = modal.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  const btns = modal.querySelectorAll('.tab-button');
  btns.forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabName);
  if (targetTab) targetTab.classList.add('active');

  const btn = Array.from(document.querySelectorAll('#newApplicationModal .tab-button')).find(b => {
    const onclick = b.getAttribute('onclick') || '';
    return onclick.includes(tabName);
  });
  if (btn) btn.classList.add('active');

  if (tabName === 'tab5') {
    setTimeout(populateReview, 50);
  }
}

// ---- Loan History dynamic table ----
function addLoanHistoryRow() {
  const tbody = document.getElementById('loanHistoryTable')?.querySelector('tbody');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="date" required></td>
    <td><input type="text" placeholder="e.g., 12 months"></td>
    <td><input type="number" step="0.01" required></td>
    <td><input type="date" required></td>
    <td><input type="text" placeholder="Comments"></td>
    <td><button type="button" class="delete-button" onclick="deleteRow(this)">Delete</button></td>
  `;
  tbody.appendChild(row);
}

function deleteRow(btn) {
  const row = btn.closest('tr');
  if (!row) return;
  const parentTable = row.closest('table');
  const isBudget = parentTable && parentTable.id === 'personalBudgetTable';
  row.remove();
  if (isBudget) calculateBudget();
}

// ---- Personal Budget ----
function addBudgetRow(type) {
  const tbody = document.getElementById('personalBudgetTable')?.querySelector('tbody');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${type}</td>
    <td><input type="text" placeholder="Description" required></td>
    <td><input type="number" step="0.01" required oninput="calculateBudget()"></td>
    <td><button type="button" class="delete-button" onclick="deleteRow(this)">Delete</button></td>
  `;
  tbody.appendChild(row);
  calculateBudget(); // immediate recalc
}
function addIncomeRow() { addBudgetRow('Income'); }
function addExpenseRow() { addBudgetRow('Expense'); }
function addRepaymentRow() { addBudgetRow('Repayment'); }

function computeTotalRepayments() {
  let totalRepayments = 0;
  const rows = document.querySelectorAll('#personalBudgetTable tbody tr');
  rows.forEach(row => {
    const type = (row.cells[0]?.textContent || '').trim();
    if (type === 'Repayment') {
      const input = row.cells[2]?.querySelector('input');
      const amount = input ? (parseFloat(input.value) || 0) : 0;
      totalRepayments += amount;
    }
  });
  return totalRepayments;
}

function calculateBudget() {
  let totalIncome = 0, totalExpense = 0, totalRepayments = 0;
  const rows = document.querySelectorAll('#personalBudgetTable tbody tr');
  rows.forEach(row => {
    const type = row.cells[0]?.textContent?.trim();
    const input = row.cells[2]?.querySelector('input');
    const amount = input ? (parseFloat(input.value) || 0) : 0;
    if (type === 'Income') totalIncome += amount;
    else if (type === 'Expense') totalExpense += amount;
    else if (type === 'Repayment') totalRepayments += amount;
  });

  const netIncome = totalIncome - totalExpense;
  const netIncomeElem = document.getElementById('netIncome');
  if (netIncomeElem) netIncomeElem.value = netIncome.toFixed(2);

  const repaymentUsed = totalRepayments;
  let dsrDisplay = '0.00%';
  if (netIncome > 0 && repaymentUsed > 0) {
    dsrDisplay = ((repaymentUsed / netIncome) * 100).toFixed(2) + '%';
  } else if (repaymentUsed > 0 && netIncome <= 0) {
    dsrDisplay = 'N/A';
  }
  const dsrElem = document.getElementById('debtServiceRatio');
  if (dsrElem) dsrElem.value = dsrDisplay;
}

// ---- Monthly Turnover: Totals/Averages Calculation ----
function calculateTotals() {
  let totalCrTO = 0, totalDrTO = 0, totalMaxBal = 0, totalMinBal = 0;
  for (let i = 1; i <= 3; i++) {
    const cr = parseFloat(document.getElementById(`crTO${i}`)?.value) || 0;
    const dr = parseFloat(document.getElementById(`drTO${i}`)?.value) || 0;
    const maxB = parseFloat(document.getElementById(`maxBal${i}`)?.value) || 0;
    const minB = parseFloat(document.getElementById(`minBal${i}`)?.value) || 0;
    totalCrTO += cr;
    totalDrTO += dr;
    totalMaxBal += maxB;
    totalMinBal += minB;
  }

  function setSpan(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(val || 0).toFixed(2);
  }

  setSpan('totalCrTO', totalCrTO);
  setSpan('totalDrTO', totalDrTO);
  setSpan('totalMaxBal', totalMaxBal);
  setSpan('totalMinBal', totalMinBal);

  setSpan('monthlyAvgCrTO', totalCrTO / 3);
  setSpan('monthlyAvgDrTO', totalDrTO / 3);
  setSpan('monthlyAvgMaxBal', totalMaxBal / 3);
  setSpan('monthlyAvgMinBal', totalMinBal / 3);

  setSpan('weeklyAvgCrTO', totalCrTO / 12);
  setSpan('weeklyAvgDrTO', totalDrTO / 12);
  setSpan('weeklyAvgMaxBal', totalMaxBal / 12);
  setSpan('weeklyAvgMinBal', totalMinBal / 12);

  setSpan('dailyAvgCrTO', totalCrTO / 90);
  setSpan('dailyAvgDrTO', totalDrTO / 90);
  setSpan('dailyAvgMaxBal', totalMaxBal / 90);
  setSpan('dailyAvgMinBal', totalMinBal / 90);
}

// ---- File Upload Preview ----
function updateFilePreview(input) {
  if (!input) return;
  const map = {
    'bank-statement': 'bank-statement-name',
    'pay-slip': 'pay-slip-name',
    'undertaking': 'undertaking-name',
    'loan-statement': 'loan-statement-name'
  };
  const previewId = map[input.id] || (input.id + '-name');
  const span = document.getElementById(previewId);
  if (!span) return;
  if (input.files && input.files[0]) {
    span.textContent = input.files[0].name;
    span.style.color = '#16a34a';
  } else {
    span.textContent = 'No file chosen';
    span.style.color = '';
  }
}

function addAdditionalDocument() {
  additionalDocumentCount++;
  const container = document.querySelector('#tab4 .upload-grid') || document.getElementById('tab4');
  if (!container) return;
  const upItem = document.createElement('div');
  upItem.className = 'upload-item small-upload-card';
  upItem.innerHTML = `
    <label for="otherDocument${additionalDocumentCount}" style="display:block;font-weight:600;margin-bottom:6px;">Other Document ${additionalDocumentCount}:</label>
    <input type="file" id="otherDocument${additionalDocumentCount}" class="file-input" onchange="updateFilePreview(this)">
    <span id="otherDocument${additionalDocumentCount}-name" class="file-name">No file chosen</span>
  `;
  container.appendChild(upItem);
}

// ---- Populate Review Fields ----
function populateReview() {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('review-name', safeValue('name') || 'Not provided');
  setText('review-amount', safeValue('amount') || 'Not provided');
  setText('review-purpose', safeValue('purpose') || 'Not provided');
  setText('review-duration', safeValue('duration') || 'Not provided');
  setText('review-interestRate', safeValue('interestRate') || 'Not provided');

  setText('review-characterComment', document.getElementById('characterComment')?.value || 'No character comments provided');

  // Loan History review
  const lhTBody = document.getElementById('review-loanHistoryTable')?.querySelector('tbody');
  if (lhTBody) {
    lhTBody.innerHTML = '';
    const rows = document.querySelectorAll('#loanHistoryTable tbody tr');
    if (!rows.length) {
      lhTBody.innerHTML = `<tr><td colspan="5" class="no-data">No loan history provided</td></tr>`;
    } else {
      rows.forEach(row => {
        const nrow = document.createElement('tr');
        for (let i = 0; i < 5; i++) {
          const input = row.cells[i]?.querySelector('input');
          const val = input ? (input.value || '') : (row.cells[i]?.textContent || '');
          nrow.innerHTML += `<td>${escapeHtml(val)}</td>`;
        }
        lhTBody.appendChild(nrow);
      });
    }
  }

  // Budget review (grouped)
  const budTBody = document.getElementById('review-personalBudgetTable')?.querySelector('tbody');
  if (budTBody) {
    budTBody.innerHTML = '';
    const rows = Array.from(document.querySelectorAll('#personalBudgetTable tbody tr'));
    const groups = { Income: [], Expense: [], Repayment: [] };

    rows.forEach(row => {
      const type = (row.cells[0]?.textContent || '').trim();
      const desc = row.cells[1]?.querySelector('input')?.value || '';
      const amt = parseFloat(row.cells[2]?.querySelector('input')?.value) || 0;
      if (groups[type] !== undefined) groups[type].push({ type, desc, amt });
      else groups.Expense.push({ type, desc, amt });
    });

    function appendGroup(title, items) {
      const header = document.createElement('tr');
      header.innerHTML = `<td colspan="2" style="font-weight:bold; padding-top:8px;">${escapeHtml(title)}</td>`;
      budTBody.appendChild(header);

      if (!items.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="2" class="no-data">No ${escapeHtml(title.toLowerCase())} items</td>`;
        budTBody.appendChild(emptyRow);
        return;
      }

      items.forEach(it => {
        const r = document.createElement('tr');
        r.innerHTML = `<td>${escapeHtml(it.desc)}</td><td>${it.amt.toFixed(2)}</td>`;
        budTBody.appendChild(r);
      });
    }

    appendGroup('INCOME', groups.Income);
    appendGroup('EXPENDITURE', groups.Expense);
    appendGroup('REPAYMENT', groups.Repayment);

    const netIncomeVal = safeValue('netIncome') || '0.00';
    const netRow = document.createElement('tr');
    netRow.innerHTML = `<td style="text-align:right; font-weight:bold;">NET INCOME</td><td style="font-weight:bold;">${escapeHtml(netIncomeVal)}</td>`;
    budTBody.appendChild(netRow);

    const dsrVal = safeValue('debtServiceRatio') || '0.00%';
    const dsrRow = document.createElement('tr');
    dsrRow.innerHTML = `<td style="text-align:right; font-weight:bold;">Debt Service Ratio:</td><td style="font-weight:bold;">${escapeHtml(dsrVal)}</td>`;
    budTBody.appendChild(dsrRow);
  }

  // Monthly Turnover review
  const mtTBody = document.getElementById('review-monthlyTurnoverTable')?.querySelector('tbody');
  if (mtTBody) {
    mtTBody.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const month = safeValue(`month${i}`) || '';
      const cr = safeValue(`crTO${i}`) || '0.00';
      const dr = safeValue(`drTO${i}`) || '0.00';
      const maxB = safeValue(`maxBal${i}`) || '0.00';
      const minB = safeValue(`minBal${i}`) || '0.00';
      mtTBody.innerHTML += `<tr><td>${escapeHtml(month)}</td><td>${escapeHtml(cr)}</td><td>${escapeHtml(dr)}</td><td>${escapeHtml(maxB)}</td><td>${escapeHtml(minB)}</td></tr>`;
    }
    const appendSummaryRow = (label, ids) => {
      const v0 = parseFloat(safeText(ids[0], '0')) || 0;
      const v1 = parseFloat(safeText(ids[1], '0')) || 0;
      const v2 = parseFloat(safeText(ids[2], '0')) || 0;
      const v3 = parseFloat(safeText(ids[3], '0')) || 0;
      mtTBody.innerHTML += `<tr><td>${label}</td><td>${v0.toFixed(2)}</td><td>${v1.toFixed(2)}</td><td>${v2.toFixed(2)}</td><td>${v3.toFixed(2)}</td></tr>`;
    };
    if (document.getElementById('totalCrTO')) appendSummaryRow('<strong>Total</strong>', ['totalCrTO','totalDrTO','totalMaxBal','totalMinBal']);
    if (document.getElementById('monthlyAvgCrTO')) appendSummaryRow('<strong>Monthly Average</strong>', ['monthlyAvgCrTO','monthlyAvgDrTO','monthlyAvgMaxBal','monthlyAvgMinBal']);
    if (document.getElementById('weeklyAvgCrTO')) appendSummaryRow('<strong>Weekly Average</strong>', ['weeklyAvgCrTO','weeklyAvgDrTO','weeklyAvgMaxBal','weeklyAvgMinBal']);
    if (document.getElementById('dailyAvgCrTO')) appendSummaryRow('<strong>Daily Average</strong>', ['dailyAvgCrTO','dailyAvgDrTO','dailyAvgMaxBal','dailyAvgMinBal']);
  }

  // Risk comments
  setTextIfExists('review-marginComment', document.getElementById('marginComment')?.value || 'No margin requirements specified');
  setTextIfExists('review-repaymentComment', document.getElementById('repaymentComment')?.value || 'Standard repayment terms apply');
  setTextIfExists('review-securityComment', document.getElementById('securityComment')?.value || 'Primary collateral required');
  setTextIfExists('review-financialsComment', document.getElementById('financialsComment')?.value || 'Financial statements reviewed and acceptable');
  setTextIfExists('review-risksComment', document.getElementById('risksComment')?.value || 'Moderate market risk identified');
  setTextIfExists('review-riskMitigationComment', document.getElementById('riskMitigationComment')?.value || 'Regular monitoring implemented');
  setTextIfExists('review-creditOfficerComment', document.getElementById('creditOfficerComment')?.value || 'No recommendation provided');

  // Uploaded documents list
  const uploadsList = document.getElementById('review-uploads-list');
  if (uploadsList) {
    uploadsList.innerHTML = '';
    const docs = [
      { label: 'Bank Statement', spanId: 'bank-statement-name' },
      { label: 'Pay Slip', spanId: 'pay-slip-name' },
      { label: 'Letter of Undertaking', spanId: 'undertaking-name' },
      { label: 'Loan Statement', spanId: 'loan-statement-name' }
    ];
    docs.forEach(d => {
      const span = document.getElementById(d.spanId);
      const name = span ? span.textContent.trim() : '';
      const li = document.createElement('li');
      if (!name || /no file/i.test(name)) {
        li.innerHTML = `<strong>${d.label}:</strong> <span style="color:#666;">Not uploaded</span>`;
      } else {
        li.innerHTML = `<strong>${d.label}:</strong> <span>${escapeHtml(name)}</span>`;
      }
      uploadsList.appendChild(li);
    });
  }
}

// ---- Build structured data from modal ----
function buildModalFormData() {
  const formData = {
    name: safeValue('name'),
    amount: safeValue('amount'),
    purpose: safeValue('purpose'),
    duration: safeValue('duration'),
    interestRate: safeValue('interestRate'),
    characterComment: document.getElementById('characterComment')?.value || '',
    loanHistory: [],
    personalBudget: [],
    netIncome: safeValue('netIncome') || '0.00',
    totalRepayments: computeTotalRepayments(),
    debtServiceRatio: safeValue('debtServiceRatio') || '0.00%',
    monthlyTurnover: {
      month1: safeValue('month1') || '',
      month2: safeValue('month2') || '',
      month3: safeValue('month3') || '',
      crTO1: safeValue('crTO1') || 0,
      crTO2: safeValue('crTO2') || 0,
      crTO3: safeValue('crTO3') || 0,
      drTO1: safeValue('drTO1') || 0,
      drTO2: safeValue('drTO2') || 0,
      drTO3: safeValue('drTO3') || 0,
      maxBal1: safeValue('maxBal1') || 0,
      maxBal2: safeValue('maxBal2') || 0,
      maxBal3: safeValue('maxBal3') || 0,
      minBal1: safeValue('minBal1') || 0,
      minBal2: safeValue('minBal2') || 0,
      minBal3: safeValue('minBal3') || 0,
      totalCrTO: safeText('totalCrTO') || 0,
      totalDrTO: safeText('totalDrTO') || 0,
      totalMaxBal: safeText('totalMaxBal') || 0,
      totalMinBal: safeText('totalMinBal') || 0,
      monthlyAvgCrTO: safeText('monthlyAvgCrTO') || 0,
      monthlyAvgDrTO: safeText('monthlyAvgDrTO') || 0,
      monthlyAvgMaxBal: safeText('monthlyAvgMaxBal') || 0,
      monthlyAvgMinBal: safeText('monthlyAvgMinBal') || 0,
      weeklyAvgCrTO: safeText('weeklyAvgCrTO') || 0,
      weeklyAvgDrTO: safeText('weeklyAvgDrTO') || 0,
      weeklyAvgMaxBal: safeText('weeklyAvgMaxBal') || 0,
      weeklyAvgMinBal: safeText('weeklyAvgMinBal') || 0,
      dailyAvgCrTO: safeText('dailyAvgCrTO') || 0,
      dailyAvgDrTO: safeText('dailyAvgDrTO') || 0,
      dailyAvgMaxBal: safeText('dailyAvgMaxBal') || 0,
      dailyAvgMinBal: safeText('dailyAvgMinBal') || 0
    },
    marginComment: document.getElementById('marginComment')?.value || '',
    repaymentComment: document.getElementById('repaymentComment')?.value || '',
    securityComment: document.getElementById('securityComment')?.value || '',
    financialsComment: document.getElementById('financialsComment')?.value || '',
    risksComment: document.getElementById('risksComment')?.value || '',
    riskMitigationComment: document.getElementById('riskMitigationComment')?.value || '',
    creditOfficerComment: document.getElementById('creditOfficerComment')?.value || '',
    uploadedFiles: {
      bankStatement: safeText('bank-statement-name'),
      paySlip: safeText('pay-slip-name'),
      undertaking: safeText('undertaking-name'),
      loanStatement: safeText('loan-statement-name')
    }
  };

  // loan history rows
  const lhRows = document.querySelectorAll('#loanHistoryTable tbody tr');
  lhRows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    formData.loanHistory.push({
      disbursementDate: inputs[0]?.value || '',
      tenure: inputs[1]?.value || '',
      amount: inputs[2]?.value || 0,
      endDate: inputs[3]?.value || '',
      comment: inputs[4]?.value || ''
    });
  });

  // personal budget rows
  const pbRows = document.querySelectorAll('#personalBudgetTable tbody tr');
  pbRows.forEach(row => {
    const type = row.cells[0]?.textContent || '';
    const desc = row.cells[1]?.querySelector('input')?.value || '';
    const amt = row.cells[2]?.querySelector('input')?.value || 0;
    formData.personalBudget.push({ type, description: desc, amount: amt });
  });

  return formData;
}

// ---- Save draft ----
function saveDraftFromModal() {
  const loggedInUser = localStorage.getItem('loggedInName') || '';
  if (!loggedInUser) {
    alert('Please login first!');
    return;
  }

  const appNumber = window.currentAppNumber || document.getElementById('app-number')?.textContent || '';
  if (!appNumber) {
    alert('Application number not found.');
    return;
  }

  const name = document.getElementById('name')?.value;
  if (!name) {
    alert('Please at least enter the applicant name for the draft.');
    return;
  }

  const formData = buildModalFormData();

  if (typeof showLoading === 'function') showLoading('Saving draft...');
  window.apiService.saveApplication(appNumber, formData, loggedInUser, true, { showLoading: false })
    .then(function(res) {
      if (typeof hideLoading === 'function') hideLoading();
      if (res && res.success) {
        alert(res.message || 'Draft saved!');
        closeNewApplicationModal();
        if (typeof refreshApplications === 'function') refreshApplications();
        if (typeof updateBadgeCounts === 'function') updateBadgeCounts();
      } else {
        alert('Failed to save draft: ' + (res?.message || 'unknown error'));
      }
    })
    .catch(function(err) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('Error saving draft: ' + (err?.message || err));
    });
}

// ---- Submit application (final) ----
function submitNewApplication() {
  const loggedInUser = localStorage.getItem('loggedInName');
  if (!loggedInUser) {
    alert('Please login first!');
    return;
  }

  const appNumber = window.currentAppNumber || document.getElementById('app-number')?.textContent || '';
  if (!appNumber) {
    alert('Application number not found. Please start a new application from the main dashboard.');
    return;
  }

  const name = document.getElementById('name')?.value;
  const amount = document.getElementById('amount')?.value;
  const purpose = document.getElementById('purpose')?.value;
  const duration = document.getElementById('duration')?.value;
  const interestRate = document.getElementById('interestRate')?.value;

  if (!name || !amount || !purpose || !duration || !interestRate) {
    alert('Please fill in all required fields: Name, Amount, Purpose, Duration, and Interest Rate');
    return;
  }

  const characterComment = document.getElementById('characterComment')?.value;
  const creditOfficerComment = document.getElementById('creditOfficerComment')?.value;

  if (!characterComment || characterComment.trim() === '') {
    if (!confirm('Character comment is empty. Submit anyway?')) return;
  }

  if (!creditOfficerComment || creditOfficerComment.trim() === '') {
    if (!confirm('Credit Officer recommendation is empty. Submit anyway?')) return;
  }

  const formData = buildModalFormData();
  formData.appNumber = appNumber;

  if (typeof showLoading === 'function') showLoading('Submitting application...');

  window.apiService.saveApplication(appNumber, formData, loggedInUser, false, { showLoading: false })
    .then(function(response) {
      if (typeof hideLoading === 'function') hideLoading();
      if (response && response.success) {
        if (typeof showSuccessModal === 'function') {
          showSuccessModal(response.message || 'Application submitted successfully!');
        } else {
          alert(response.message || 'Application submitted successfully!');
        }
        closeNewApplicationModal();
        if (typeof refreshApplications === 'function') refreshApplications();
        if (typeof updateBadgeCounts === 'function') updateBadgeCounts();
      } else {
        alert('Error submitting application: ' + (response?.message || 'unknown error'));
      }
    })
    .catch(function(error) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('Error submitting application: ' + (error?.message || error));
    });
}

// ---- Populate form with existing data ----
function loadExistingApplication(appNumber) {
  console.log('Loading existing application:', appNumber);
  if (typeof showLoading === 'function') showLoading('Loading application data...');
  const userName = localStorage.getItem('loggedInName') || '';

  window.apiService.getApplicationDetails(appNumber, userName, { showLoading: false })
    .then(function(response) {
      if (typeof hideLoading === 'function') hideLoading();
      if (response && response.success && response.data) {
        const appData = response.data;
        window.currentAppNumber = appNumber;
        window.currentAppFolderId = appData.folderId || '';
        const appNumberEl = document.getElementById('app-number');
        if (appNumberEl) appNumberEl.textContent = appNumber;
        populateFormWithData(appData);
        const modal = document.getElementById('newApplicationModal');
        if (modal) modal.style.display = 'block';
        openTab('tab1');
        calculateTotals();
        calculateBudget();
      } else {
        alert('Failed to load application: ' + (response?.message || 'Application not found'));
      }
    })
    .catch(function(error) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('Error loading application: ' + (error?.message || error));
    });
}

function populateFormWithData(appData) {
  console.log('Populating form with data:', appData);
  setInputValue('name', appData.name || '');
  setInputValue('amount', appData.amount || '');
  setInputValue('purpose', appData.purpose || '');
  setInputValue('duration', appData.duration || '');
  setInputValue('interestRate', appData.interestRate || '');
  setTextareaValue('characterComment', appData.characterComment || '');
  populateLoanHistory(appData.loanHistory || []);
  populatePersonalBudget(appData.personalBudget || []);
  populateMonthlyTurnover(appData.monthlyTurnover || {});
  setTextareaValue('marginComment', appData.marginComment || '');
  setTextareaValue('repaymentComment', appData.repaymentComment || '');
  setTextareaValue('securityComment', appData.securityComment || '');
  setTextareaValue('financialsComment', appData.financialsComment || '');
  setTextareaValue('risksComment', appData.risksComment || '');
  setTextareaValue('riskMitigationComment', appData.riskMitigationComment || '');
  setTextareaValue('creditOfficerComment', appData.creditOfficerComment || '');
  setInputValue('netIncome', appData.netIncome || '0.00');
  setInputValue('debtServiceRatio', appData.debtServiceRatio || '0.00%');
  updateFilePreviews(appData.documents || []);
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
function setTextareaValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
  }
}
function formatDateForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}
function populateLoanHistory(loanHistory) {
  const tbody = document.getElementById('loanHistoryTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  loanHistory.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="date" value="${formatDateForInput(item.disbursementDate)}" required></td>
      <td><input type="text" value="${escapeHtml(item.tenure || '')}" placeholder="e.g., 12 months"></td>
      <td><input type="number" step="0.01" value="${item.amount || 0}" required></td>
      <td><input type="date" value="${formatDateForInput(item.endDate)}" required></td>
      <td><input type="text" value="${escapeHtml(item.comment || '')}" placeholder="Comments"></td>
      <td><button type="button" class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}
function populatePersonalBudget(personalBudget) {
  const tbody = document.getElementById('personalBudgetTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  personalBudget.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(item.type || '')}</td>
      <td><input type="text" value="${escapeHtml(item.description || '')}" placeholder="Description" required></td>
      <td><input type="number" step="0.01" value="${item.amount || 0}" required oninput="calculateBudget()"></td>
      <td><button type="button" class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}
function populateMonthlyTurnover(turnover) {
  if (!turnover) return;
  if (turnover.month1 !== undefined) setInputValue('month1', turnover.month1 || 'Nov-24');
  if (turnover.month2 !== undefined) setInputValue('month2', turnover.month2 || 'Dec-24');
  if (turnover.month3 !== undefined) setInputValue('month3', turnover.month3 || 'Jan-25');
  if (turnover.crTO1 !== undefined) setInputValue('crTO1', turnover.crTO1 || 0);
  if (turnover.crTO2 !== undefined) setInputValue('crTO2', turnover.crTO2 || 0);
  if (turnover.crTO3 !== undefined) setInputValue('crTO3', turnover.crTO3 || 0);
  if (turnover.drTO1 !== undefined) setInputValue('drTO1', turnover.drTO1 || 0);
  if (turnover.drTO2 !== undefined) setInputValue('drTO2', turnover.drTO2 || 0);
  if (turnover.drTO3 !== undefined) setInputValue('drTO3', turnover.drTO3 || 0);
  if (turnover.maxBal1 !== undefined) setInputValue('maxBal1', turnover.maxBal1 || 0);
  if (turnover.maxBal2 !== undefined) setInputValue('maxBal2', turnover.maxBal2 || 0);
  if (turnover.maxBal3 !== undefined) setInputValue('maxBal3', turnover.maxBal3 || 0);
  if (turnover.minBal1 !== undefined) setInputValue('minBal1', turnover.minBal1 || 0);
  if (turnover.minBal2 !== undefined) setInputValue('minBal2', turnover.minBal2 || 0);
  if (turnover.minBal3 !== undefined) setInputValue('minBal3', turnover.minBal3 || 0);
}

function updateFilePreviews(documents) {
  if (!documents) return;
  if (Array.isArray(documents)) {
    documents.forEach(doc => {
      if (doc.type === 'bankStatement') {
        safeSetText('bank-statement-name', doc.name || 'File uploaded');
        const el = document.getElementById('bank-statement-name');
        if (el) el.style.color = '#16a34a';
      } else if (doc.type === 'paySlip') {
        safeSetText('pay-slip-name', doc.name || 'File uploaded');
        const el = document.getElementById('pay-slip-name');
        if (el) el.style.color = '#16a34a';
      } else if (doc.type === 'undertaking') {
        safeSetText('undertaking-name', doc.name || 'File uploaded');
        const el = document.getElementById('undertaking-name');
        if (el) el.style.color = '#16a34a';
      } else if (doc.type === 'loanStatement') {
        safeSetText('loan-statement-name', doc.name || 'File uploaded');
        const el = document.getElementById('loan-statement-name');
        if (el) el.style.color = '#16a34a';
      }
    });
  } else {
    if (documents.bankStatement) {
      safeSetText('bank-statement-name', documents.bankStatementName || 'File uploaded');
      const el = document.getElementById('bank-statement-name');
      if (el) el.style.color = '#16a34a';
    }
    if (documents.paySlip) {
      safeSetText('pay-slip-name', documents.paySlipName || 'File uploaded');
      const el = document.getElementById('pay-slip-name');
      if (el) el.style.color = '#16a34a';
    }
    if (documents.undertaking) {
      safeSetText('undertaking-name', documents.undertakingName || 'File uploaded');
      const el = document.getElementById('undertaking-name');
      if (el) el.style.color = '#16a34a';
    }
    if (documents.loanStatement) {
      safeSetText('loan-statement-name', documents.loanStatementName || 'File uploaded');
      const el = document.getElementById('loan-statement-name');
      if (el) el.style.color = '#16a34a';
    }
  }
}

// ---- Small helpers ----
function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}
