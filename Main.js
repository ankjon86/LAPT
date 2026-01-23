// Main.js — single modal loader implementation (no recursion) + app logic
// ----------- CACHED ELEMENTS & VARIABLES -----------
const cachedElements = {};
let currentAppNumber = "";
let currentAppFolderId = "";
let lastAppCount = 0;
let notificationCheckInterval;
let refreshInterval;
let currentViewingAppData = null;

// ----------- CORE HELPERS (define early so other code can call them) -----------
function clearIntervals() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (refreshInterval) clearInterval(refreshInterval);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showLoading(message = 'Processing...') {
  const loadingEl = cachedElements['loading'];
  if (loadingEl) {
    const messageEl = loadingEl.querySelector('p');
    if (messageEl) messageEl.textContent = message;
    loadingEl.style.display = 'flex';
  }
}
function hideLoading() {
  const loadingEl = cachedElements['loading'];
  if (loadingEl) loadingEl.style.display = 'none';
}
function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, function(m){ 
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; 
  });
}

// Cache frequently used elements
function cacheElements() {
  const elements = {
    'logged-in-user': 'logged-in-user',
    'current-date': 'current-date',
    'loading': 'loading',
    'success-modal': 'success-modal',
    'success-message': 'success-message',
    'app-number': 'app-number',
    'user-notification-badge': 'user-notification-badge',
    'viewApplicationModal': 'viewApplicationModal'
  };
  for (const [key, id] of Object.entries(elements)) {
    cachedElements[key] = document.getElementById(id);
  }
}

// ----------- PAGE INIT -----------
window.addEventListener('load', function() {
  // clear any transient login data on a full load
  localStorage.removeItem('loggedInName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLevel');
  clearIntervals();
});

document.addEventListener('DOMContentLoaded', function() {
  cacheElements();
  const cd = cachedElements['current-date'];
  if (cd) {
    cd.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  initializeBrowserNotifications();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const loggedInName = localStorage.getItem('loggedInName');
  if (loggedInName) {
    verifyUserOnLoad(loggedInName);
  } else {
    showLoginPage();
  }

  // login form wiring
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const name = (document.getElementById('login-name') || {}).value?.trim();
      if (!name) { alert('Name is required!'); return; }
      await handleLoginFunction(name);
    });
  }

  // Add New Application button: use loadModalContent('new') and then showNewApplicationModal
  const addAppBtn = document.querySelector('.add-app-btn');
  if (addAppBtn) {
    addAppBtn.removeAttribute('onclick');
    addAppBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Add New Application button clicked');
      const ok = await loadModalContent('new');
      if (!ok) {
        alert('Failed to load application form. Please refresh the page.');
        return;
      }
      if (typeof showNewApplicationModal === 'function') {
        showNewApplicationModal();
      }
    });
  }
});

// ----------- AUTH / SESSION ----------
function showLoginPage() {
  document.body.classList.remove('logged-in');
  localStorage.removeItem('loggedInName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLevel');
  clearIntervals();
}

function showDashboard() {
  document.body.classList.add('logged-in');
  const loggedInName = localStorage.getItem('loggedInName');
  const userRole = localStorage.getItem('userRole');
  if (loggedInName) setLoggedInUser(loggedInName, userRole);
}

function setLoggedInUser(name, role = '') {
  const el = cachedElements['logged-in-user'];
  if (el) el.textContent = role ? `${name} (${role})` : name;
  if (name) updateUserNotificationBadge();
}

function logout() {
  if (!confirm('Are you sure you want to logout?')) return;
  localStorage.removeItem('loggedInName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLevel');
  clearIntervals();
  showLoginPage();
}

function restrictIfNotLoggedIn() {
  const loggedInName = localStorage.getItem('loggedInName');
  if (!loggedInName) { showLoginPage(); return true; }
  return false;
}

async function verifyUserOnLoad(name) {
  try {
    const result = await window.apiService.login(name);
    if (result.success) {
      localStorage.setItem('userRole', result.user?.role || '');
      localStorage.setItem('userLevel', result.user?.level || '');
      setLoggedInUser(name, result.user?.role || '');
      showDashboard();
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const newSection = document.getElementById('new');
      if (newSection) newSection.classList.add('active');
      initializeAppCount();
      initializeAndRefreshTables();
    } else {
      showLoginPage();
    }
  } catch (err) {
    console.error('verifyUserOnLoad error', err);
    showLoginPage();
  }
}

async function handleLoginFunction(name) {
  try {
    showLoading('Signing in...');
    const response = await window.apiService.login(name);
    hideLoading();
    if (response.success) {
      localStorage.setItem('loggedInName', name);
      localStorage.setItem('userRole', response.user?.role || '');
      localStorage.setItem('userLevel', response.user?.level || '');
      setLoggedInUser(name, response.user?.role || '');
      showDashboard();
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const newSection = document.getElementById('new');
      if (newSection) newSection.classList.add('active');
      initializeAppCount();
      initializeAndRefreshTables();
    } else {
      alert(response.message || 'Authentication failed');
    }
  } catch (err) {
    hideLoading();
    console.error('Login error', err);
    alert('Login error: ' + (err && err.message ? err.message : err));
  }
}

// ----------- SINGLE MODAL LOADER (NO RECURSION) ----------
async function loadModalContent(modalName = 'new') {
  console.log('loadModalContent called for', modalName);
  const cfg = modalName === 'view' ? {
    url: 'viewApps.html',
    containerSelector: '#viewApplicationModal .modal-content',
    loadedAttr: 'data-view-loaded'
  } : {
    url: 'newApps.html',
    containerSelector: '#newApplicationModalContent',
    loadedAttr: 'data-new-loaded'
  };

  const container = document.querySelector(cfg.containerSelector);
  if (!container) {
    console.error('Modal container not found for', modalName, cfg.containerSelector);
    return false;
  }

  if (container.getAttribute(cfg.loadedAttr) === '1') {
    return true;
  }

  try {
    const resp = await fetch(cfg.url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Failed to fetch ${cfg.url}: ${resp.status}`);
    const html = await resp.text();

    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    const htmlWithoutScripts = html.replace(scriptRe, function(_, scriptContent) {
      scripts.push(scriptContent);
      return '';
    });

    container.innerHTML = htmlWithoutScripts.trim();

    scripts.forEach(scriptContent => {
      try {
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.text = scriptContent;
        document.body.appendChild(s);
      } catch (e) {
        console.error('Error executing modal inline script', e);
      }
    });

    container.setAttribute(cfg.loadedAttr, '1');

    if (modalName === 'new') {
      if (typeof window.initNewApplicationScripts === 'function') {
        try { window.initNewApplicationScripts(); } catch (e) { console.warn('initNewApplicationScripts error', e); }
      }
    } else {
      if (typeof window.viewApplicationModalInit === 'function') {
        try { window.viewApplicationModalInit(); } catch (e) { console.warn('viewApplicationModalInit error', e); }
      }
      if (typeof window.initViewApplicationModal === 'function') {
        try { window.initViewApplicationModal(); } catch (e) { /* ignore */ }
      }
    }

    return true;
  } catch (err) {
    console.error('loadModalContent failed', err);
    return false;
  }
}
async function loadModalContentIfNeeded(modalName = 'new') { return await loadModalContent(modalName); }
window.loadModalContent = loadModalContent;
window.loadModalContentIfNeeded = loadModalContentIfNeeded;

// ----------- VIEW MODAL OPEN ----------
async function openViewApplicationModal(appData) {
  const ok = await loadModalContent('view');
  if (!ok) {
    alert('Failed to load view modal. Please refresh the page.');
    return;
  }

  const modal = document.getElementById('viewApplicationModal');
  if (modal) modal.style.display = 'block';

  if (typeof window.initViewApplicationModal === 'function') {
    try {
      window.initViewApplicationModal(appData);
      return;
    } catch (e) {
      console.warn('initViewApplicationModal raised', e);
    }
  }

  if (typeof window.viewApplication === 'function' && appData && appData.appNumber) {
    try { window.viewApplication(appData.appNumber); } catch (e) { console.error('viewApplication fallback failed', e); }
  }
}

// ----------- LOAD APPLICATIONS / TABLES ----------
async function loadApplications(sectionId, options = {}) {
  const map = { 'new': 'NEW','pending':'PENDING','pending-approvals':'PENDING_APPROVAL','approved':'APPROVED' };
  const status = map[sectionId];
  if (!status) return;

  const tbody = document.getElementById(`${sectionId}-list`);
  if (!tbody) return;

  const isAuto = options.isAutoRefresh || false;
  if (options.showLoading !== false && !isAuto) tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading applications...</td></tr>`;
  else { tbody.setAttribute('aria-busy','true'); tbody.style.opacity='0.7'; }

  try {
    const response = await window.apiService.getApplications(status, { showLoading: false });
    tbody.removeAttribute('aria-busy'); tbody.style.opacity='1';
    if (response.success) populateTable(`${sectionId}-list`, response.data);
    else tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${response.message}</td></tr>`;
  } catch (err) {
    tbody.removeAttribute('aria-busy'); tbody.style.opacity='1';
    tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${err.message}</td></tr>`;
  }
}

function populateTable(tableId, applications) {
  const tbody = document.querySelector(`#${tableId}`);
  if (!tbody) { console.error('Table body not found', tableId); return; }
  if (!applications || !applications.length) { tbody.innerHTML = `<tr><td colspan="5" class="no-data">No applications found</td></tr>`; return; }

  const frag = document.createDocumentFragment();
  applications.forEach(row => {
    const tr = document.createElement('tr');

    const tdApp = document.createElement('td'); tdApp.className='app-number';
    const a = document.createElement('a'); a.href='javascript:void(0)'; a.className='app-number-link';
    a.textContent = row.appNumber || ''; a.addEventListener('click', () => handleAppNumberClick(row.appNumber));
    tdApp.appendChild(a); tr.appendChild(tdApp);

    const tdName = document.createElement('td'); tdName.className='applicant-name'; tdName.textContent = row.applicantName || 'N/A'; tr.appendChild(tdName);
    const tdAmount = document.createElement('td'); tdAmount.className='amount'; tdAmount.textContent = (row.amount==null?'0.00':Number(row.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})); tr.appendChild(tdAmount);
    const tdDate = document.createElement('td'); tdDate.className='date'; tdDate.textContent = row.date ? new Date(row.date).toLocaleDateString() : 'N/A'; tr.appendChild(tdDate);
    const tdActionBy = document.createElement('td'); tdActionBy.className='action-by'; tdActionBy.textContent = row.actionBy || 'N/A'; tr.appendChild(tdActionBy);

    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
}

// handle clicking an application number
async function handleAppNumberClick(appNumber) {
  if (!appNumber) { alert('Invalid application number'); return; }
  const userName = localStorage.getItem('loggedInName') || '';

  showLoading('Loading application details...');
  try {
    const response = await window.apiService.getApplicationDetails(appNumber, userName);
    hideLoading();
    if (response && response.success && response.data) {
      const appData = response.data;
      if (appData.status === 'NEW' && appData.completionStatus === 'DRAFT') {
        const ok = await loadModalContent('new');
        if (!ok) { alert('Failed to load form.'); return; }
        if (typeof showNewApplicationModal === 'function') showNewApplicationModal(appNumber);
      } else {
        await openViewApplicationModal(appData);
      }
    } else {
      alert('Failed to load application: ' + (response?.message || 'Not found'));
    }
  } catch (err) {
    hideLoading();
    console.error('Error loading application details', err);
    alert('Error loading application details: ' + (err && err.message ? err.message : err));
  }
}

// ----------- BADGE & NOTIFICATION HELPERS ----------
async function updateBadgeCounts() {
  try {
    const resp = await window.apiService.getApplicationCounts();
    if (resp.success && resp.data) {
      updateCount('new', resp.data.new || 0);
      updateCount('pending', resp.data.pending || 0);
      updateCount('pending-approvals', resp.data.pendingApprovals || 0);
      updateCount('approved', resp.data.approved || 0);
    }
  } catch (e) { console.error('updateBadgeCounts error', e); }
}
function updateCount(id, n) {
  const el = document.getElementById(id + '-count');
  if (!el) return;
  el.textContent = n; el.style.display = n > 0 ? 'inline-block' : 'none';
}

async function updateUserNotificationBadge() {
  const userName = localStorage.getItem('loggedInName'); if (!userName) return;
  try {
    const res = await window.apiService.getApplicationCountsForUser(userName);
    const count = res.count || 0;
    const badge = document.getElementById('user-notification-badge');
    if (badge) { if (count>0) { badge.textContent = count>99?'99+':count; badge.style.display='flex'; } else badge.style.display='none'; }
  } catch (e) { console.error('updateUserNotificationBadge', e); }
}

const debouncedRefreshApplications = debounce(async (isAuto=false) => {
  const activeSection = document.querySelector('.content-section.active')?.id;
  if (activeSection) {
    await loadApplications(activeSection, { showLoading: !isAuto, isAutoRefresh: isAuto });
    await updateBadgeCounts();
    await updateUserNotificationBadge();
  }
}, 300);

function refreshApplications() { debouncedRefreshApplications(false); }

async function initializeAndRefreshTables() {
  await loadApplications('new', { showLoading: true });
  await updateBadgeCounts();
  await updateUserNotificationBadge();
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    const active = document.querySelector('.content-section.active')?.id;
    if (active) {
      await loadApplications(active, { showLoading: false, isAutoRefresh: true });
      await updateBadgeCounts();
      await updateUserNotificationBadge();
    }
  }, 60000);
}

// ----------- USER MANAGEMENT (minimal) ----------
async function getAllUsersHandler() {
  try {
    const r = await window.apiService.getAllUsers();
    const users = r.data || [];
    const tbody = document.getElementById('users-list-body');
    if (!tbody) return;
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="4" class="no-data">No users found</td></tr>`; return; }
    tbody.innerHTML = users.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.level)}</td><td>${escapeHtml(u.role)}</td><td class="actions"><button class="btn-icon btn-delete" onclick="deleteUser('${escapeHtml(u.name)}')"><i class="fas fa-trash"></i></button></td></tr>`).join('');
  } catch (e) { console.error('getAllUsersHandler', e); const tbody = document.getElementById('users-list-body'); if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users</td></tr>`; }
}
function refreshUsersList() { getAllUsersHandler(); }
async function populateUsersTable() { await getAllUsersHandler(); }

// ----------- NOTIFICATIONS ----------
function initializeBrowserNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') setupNotificationListener();
  else if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p==='granted') setupNotificationListener(); });
}
function setupNotificationListener() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  notificationCheckInterval = setInterval(() => { checkForNewApplications(); }, 30000);
}
async function checkForNewApplications() {
  const user = localStorage.getItem('loggedInName'); if (!user || document.visibilityState === 'visible') return;
  try {
    const r = await window.apiService.getApplicationCountsForUser(user);
    const current = r.count || 0; const previous = lastAppCount; lastAppCount = current;
    if (current > previous && previous > 0) {
      const newCount = current - previous; const role = localStorage.getItem('userRole') || '';
      if (Notification.permission === 'granted') {
        const n = new Notification('New Application Assignment', { body: `${user} have ${newCount} application(s) for your action${role?` as ${role}`:''}`, icon: 'https://img.icons8.com/color/192/000000/loan.png' });
        n.onclick = () => { window.focus(); n.close(); refreshApplications(); };
        setTimeout(()=>n.close(), 10000);
      }
    }
  } catch (e) { console.error('checkForNewApplications', e); }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') { refreshApplications(); updateUserNotificationBadge(); }
  else { const u = localStorage.getItem('loggedInName'); if (u) window.apiService.getApplicationCountsForUser(u).then(r => lastAppCount = r.count || 0).catch(() => {}); }
}
async function initializeAppCount() {
  const u = localStorage.getItem('loggedInName'); if (!u) return;
  try { const r = await window.apiService.getApplicationCountsForUser(u); lastAppCount = r.count || 0; } catch (e) { console.error('initializeAppCount', e); }
}

// ----------- SUCCESS MODAL ----------
function showSuccessModal(message) { const el = cachedElements['success-message']; if (el) el.textContent = message; const sm = cachedElements['success-modal']; if (sm) sm.style.display='flex'; }
function closeSuccessModal() { const sm = cachedElements['success-modal']; if (sm) sm.style.display='none'; }

// ----------- EXPORTS ----------
window.showSection = function(sectionId) {
  if (restrictIfNotLoggedIn()) return;
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(sectionId); if (el) el.classList.add('active');
};
window.refreshApplications = refreshApplications;
window.refreshUsersList = refreshUsersList;
window.deleteUser = async function(name) {
  if (!confirm('Delete user: ' + name + '?')) return;
  try { const res = await window.apiService.deleteUser(name); if (res.success) { showSuccessModal(res.message||'Deleted'); refreshUsersList(); } else alert(res.message||'Delete failed'); } catch(e){ alert('Error deleting user: '+(e && e.message)); }
};
window.logout = logout;
window.closeSuccessModal = closeSuccessModal;
window.setLoggedInUser = setLoggedInUser;
window.loadModalContent = loadModalContent;
window.loadModalContentIfNeeded = loadModalContentIfNeeded;
