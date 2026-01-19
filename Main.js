// ----------- CACHED ELEMENTS & VARIABLES -----------
const cachedElements = {};
let currentAppNumber = "";
let currentAppFolderId = "";
let lastAppCount = 0;
let notificationCheckInterval;
let refreshInterval;
let _startButtonOriginalHTML = null;
let _startButtonRestoreTimer = null;
let currentViewingAppData = null; // Store current modal app data

// Cache frequently used elements
function cacheElements() {
  const elements = {
    'login-modal': 'login-modal',
    'logged-in-user': 'logged-in-user',
    'current-date': 'current-date',
    'loading': 'loading',
    'success-modal': 'success-modal',
    'success-message': 'success-message',
    'app-number': 'app-number',
    'user-notification-badge': 'user-notification-badge',
    'start-new-application-card-btn': 'start-new-application-card-btn',
    'start-new-application-btn': 'start-new-application-btn',
    'viewApplicationModal': 'viewApplicationModal' // Add view application modal
  };
  for (const [key, id] of Object.entries(elements)) {
    cachedElements[key] = document.getElementById(id);
  }
  // keep original HTML for the Start New Application button
  if (!_startButtonOriginalHTML && cachedElements['start-new-application-card-btn']) {
    _startButtonOriginalHTML = cachedElements['start-new-application-card-btn'].innerHTML;
  }
}

// Add this function to handle communication between main app and modal
function handleNewApplicationSave(appNumber, formData) {
  showLoading();
  const userName = localStorage.getItem('loggedInName');
  
  google.script.run
    .withSuccessHandler(function(response) {
      hideLoading();
      if (response.success) {
        showSuccessModal('Application saved successfully!');
        // Refresh application counts
        updateBadgeCounts();
        updateUserNotificationBadge();
        // Close modal if open
        const modal = document.getElementById('newApplicationModal');
        if (modal) {
          modal.style.display = 'none';
        }
        // Refresh applications list
        refreshApplications();
        // Mark saved (visually replace start button briefly), reset application number
        markApplicationSaved(appNumber, formData.name || '', false);
      } else {
        alert('Error: ' + response.message);
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      alert('Error saving application: ' + error.message);
    })
    .saveProcessApplicationForm(appNumber, formData);
}


function closeModal() {
  const modal = document.getElementById('newApplicationModal');
  if (modal) modal.style.display = 'none';
}

// Close modal when clicking outside (main newApplication modal)
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('newApplicationModal');
  if (modal) {
    window.addEventListener('click', function(event) {
      if (event.target == modal) closeModal();
    });
  }
});

// ----------- DEBOUNCE HELPERS -----------
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

// ----------- START BUTTON STATE HELPERS -----------
function setStartButtonToTemporaryLabel(label, durationMs = 3000) {
  // Change the lending template start button to show label (Saved / Auto Saved) temporarily
  const btn = cachedElements['start-new-application-card-btn'] || document.getElementById('start-new-application-card-btn');
  if (!btn) return;
  // clear any previous restore timer
  if (_startButtonRestoreTimer) {
    clearTimeout(_startButtonRestoreTimer);
    _startButtonRestoreTimer = null;
  }
  // store original HTML if not already
  if (!_startButtonOriginalHTML) {
    _startButtonOriginalHTML = btn.innerHTML;
  }
  btn.innerHTML = `<i class="fas fa-check-circle"></i> ${label}`;
  btn.disabled = true;
  btn.classList.add('btn-template-disabled');
  // Also update the top-left start button (in case of two UI locations)
  const topBtn = cachedElements['start-new-application-btn'] || document.getElementById('start-new-application-btn');
  if (topBtn) {
    topBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${label}`;
    topBtn.disabled = true;
    topBtn.classList.add('btn-template-disabled');
  }
  // restore after duration
  _startButtonRestoreTimer = setTimeout(() => {
    restoreStartButton();
  }, durationMs);
}

function restoreStartButton() {
  const btn = cachedElements['start-new-application-card-btn'] || document.getElementById('start-new-application-card-btn');
  const topBtn = cachedElements['start-new-application-btn'] || document.getElementById('start-new-application-btn');
  if (btn) {
    btn.innerHTML = _startButtonOriginalHTML || '<i class="fas fa-plus-circle"></i> Start New Application';
    btn.disabled = false;
    btn.classList.remove('btn-template-disabled');
  }
  if (topBtn) {
    topBtn.innerHTML = '<i class="fas fa-plus"></i> Start New Application';
    topBtn.disabled = false;
    topBtn.classList.remove('btn-template-disabled');
  }
  if (_startButtonRestoreTimer) {
    clearTimeout(_startButtonRestoreTimer);
    _startButtonRestoreTimer = null;
  }
}

// Called by modal or save handlers to show saved state and reset app number
function markApplicationSaved(appNumber, applicantName, auto = false) {
  // show temporary "Saved" or "Auto Saved" on the start button
  setStartButtonToTemporaryLabel(auto ? 'Auto Saved' : 'Saved', 3000);
  // reset client-side current application context
  resetCurrentAppNumber();
  // optionally show a small hint in the details area (if currently visible)
  try {
    const detailsEl = document.getElementById('app-details-content');
    if (detailsEl) {
      // if application details panel was open for the app just saved, update header
      // we'll clear it to avoid stale state
      detailsEl.innerHTML = `<div class="detail-card"><h3>Application ${appNumber} saved${applicantName ? ' — ' + escapeHtml(applicantName) : ''}.</h3></div>`;
    }
  } catch (e) {
    // ignore
  }
}

// resets the app number variables and UI display
function resetCurrentAppNumber() {
  currentAppNumber = '';
  currentAppFolderId = '';
  if (cachedElements['app-number']) cachedElements['app-number'].textContent = '';
}

// safe html escaper for tiny UI injection
function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}

// ----------- AUTH & LOGIN -----------
function showLoginModal() {
  if (cachedElements['login-modal']) cachedElements['login-modal'].style.display = 'flex';
  if (cachedElements['logged-in-user']) cachedElements['logged-in-user'].textContent = '';
  document.querySelectorAll('content-section').forEach(section => section.classList.remove('active'));
}
function hideLoginModal() {
  if (cachedElements['login-modal']) cachedElements['login-modal'].style.display = 'none';
}
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('loggedInName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLevel');
    clearIntervals();
    showLoginModal();
  }
}
function setLoggedInUser(name, role = '') {
  const userElement = cachedElements['logged-in-user'];
  if (userElement) userElement.textContent = role ? `${name} (${role})` : name;
  if (name) updateUserNotificationBadge();
}
function restrictIfNotLoggedIn() {
  const loggedInName = localStorage.getItem('loggedInName');
  if (!loggedInName) {
    showLoginModal();
    return true;
  }
  return false;
}
function updateUserNotificationBadge() {
  const userName = localStorage.getItem('loggedInName');
  if (!userName) return;
  google.script.run
    .withSuccessHandler(function(count) {
      const badge = cachedElements['user-notification-badge'];
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    })
    .withFailureHandler(function(e) { console.error('Error updating badge:', e); })
    .getApplicationsCountForUser(userName);
}

// ----------- PAGE INITIALIZATION -----------
function clearIntervals() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (refreshInterval) clearInterval(refreshInterval);
}
window.addEventListener('load', function() {
  // purposely clear any existing login to force fresh auth in this UI model
  localStorage.removeItem('loggedInName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLevel');
  clearIntervals();
});
document.addEventListener('DOMContentLoaded', function() {
  cacheElements();
  if (cachedElements['current-date']) {
    cachedElements['current-date'].textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  initializeBrowserNotifications();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const loggedInName = localStorage.getItem('loggedInName');
  if (!loggedInName) { showLoginModal(); }
  else { verifyUserOnLoad(loggedInName); }
});

function verifyUserOnLoad(loggedInName) {
  google.script.run
    .withSuccessHandler(function(authResult) {
      if (authResult.success) {
        const userRole = localStorage.getItem('userRole');
        setLoggedInUser(loggedInName, userRole);
        hideLoginModal();
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        document.getElementById('new').classList.add('active');
        initializeAppCount();
        initializeAndRefreshTables();
      } else {
        localStorage.removeItem('loggedInName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userLevel');
        showLoginModal();
      }
    })
    .withFailureHandler(function() {
      localStorage.removeItem('loggedInName');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userLevel');
      showLoginModal();
    })
    .authenticateUser(loggedInName);
}

// ----------- LOGIN FORM HANDLER -----------
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('login-name').value.trim();
  if (!name) {
    alert('Name is required!');
    return;
  }
  showLoading();
  google.script.run
    .withSuccessHandler(function(authResult) {
      hideLoading();
      if (authResult.success) {
        handleSuccessfulLogin(name, authResult.user);
      } else {
        handleFailedLogin(authResult.message);
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      alert('Login error: ' + error.message);
      document.getElementById('login-name').value = '';
      document.getElementById('login-name').focus();
    })
    .authenticateUser(name);
});
function handleSuccessfulLogin(name, user) {
  localStorage.setItem('loggedInName', name);
  localStorage.setItem('userRole', user.role);
  localStorage.setItem('userLevel', user.level);
  setLoggedInUser(name, user.role);
  hideLoginModal();
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  document.getElementById('new').classList.add('active');
  initializeAppCount();
  initializeAndRefreshTables();
  initializeBrowserNotifications();
}
function handleFailedLogin(message) {
  alert(message || 'Authentication failed');
  document.getElementById('login-name').value = '';
  document.getElementById('login-name').focus();
}

// ----------- SECTION NAVIGATION -----------
const debouncedShowSection = debounce(function(sectionId) {
  if (restrictIfNotLoggedIn()) return;
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.menu-btn[onclick*="showSection('${sectionId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
  if (sectionId === 'new-application') startNewApplication();
  else if (sectionId === 'users-list') refreshUsersList();
  // Remove application-details from navigation since we're using modal now
}, 150);
function showSection(sectionId) { debouncedShowSection(sectionId); }

// ----------- APPLICATION LOGIC -----------
function startNewApplication() {
  google.script.run.withSuccessHandler(function(ctx) {
    currentAppNumber = ctx.appNumber;
    currentAppFolderId = ctx.folderId;
    if (cachedElements['app-number']) {
      cachedElements['app-number'].textContent = currentAppNumber;
    }
  }).getNewApplicationContext();
}
function updateBadgeCount(status, count) {
  const badgeElement = document.getElementById(status + '-count');
  if (badgeElement) {
    badgeElement.textContent = count;
    badgeElement.style.display = count > 0 ? 'inline-block' : 'none';
  }
}
const format = {
  date: date => date ? new Date(date).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}) : '',
  currency: amount => {
    if (amount === null || amount === undefined) return '0.00';
    const num = parseFloat(amount);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};
function downloadLendingTemplate() {
  if (!currentAppNumber || !currentAppFolderId) {
    alert("Application number/folder not set.");
    return;
  }
  showLoading();
  google.script.run.withSuccessHandler(function(url) {
    hideLoading();
    window.open(url, '_blank');
  }).copyLendingTemplate(currentAppNumber, currentAppFolderId);
}


function showLoading() {
  if (cachedElements['loading']) {
    cachedElements['loading'].style.display = 'flex';
  }
}
function hideLoading() {
  if (cachedElements['loading']) {
    cachedElements['loading'].style.display = 'none';
  }
}

function saveDraft() {
  const appObj = {
    appNumber: currentAppNumber
    // Removed: applicantName and requestedAmount
  };
  
  // Removed validation for name and amount
  
  showLoading();
  const userName = localStorage.getItem('loggedInName');
  google.script.run.withSuccessHandler(function(res) {
    hideLoading();
    showSuccessModal(res.message || 'Draft saved!');
    updateUserNotificationBadge();
    showSection('new');
  }).saveApplicationDraft(appObj, userName);
}

document.getElementById('application-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  // Removed validation for name and amount fields
  
  showLoading();
  const userName = localStorage.getItem('loggedInName');
  google.script.run.withSuccessHandler(function(res) {
    hideLoading();
    showSuccessModal(res.message || 'Application submitted!');
    updateUserNotificationBadge();
    resetApplicationForm();
    showSection('new');
  }).submitApplication({
    appNumber: currentAppNumber
    // Removed: applicantName and requestedAmount
  }, userName);
});

function resetApplicationForm() {
  const form = document.getElementById('application-form');
  if (form) form.reset();
  ['bank-statement-name','pay-slip-name','undertaking-name','loan-statement-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'No file chosen';
      el.style.color = '';
    }
  });
  currentAppNumber = "";
  currentAppFolderId = "";
  if (cachedElements['app-number']) {
    cachedElements['app-number'].textContent = "";
  }
}
function triggerFileUpload(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.click();
}

// ----------- TABLES & APPLICATION LISTING -----------
// Improved populateTable to support hidden/background refresh (no flicker) and smoother DOM updates.
// Call populateTable(tableId, statusFunction, { showLoading: true|false })
function getStatusBadgeClass(status) {
  const statusMap = {
    'DRAFT': 'status-draft',
    'NEW': 'status-new',
    'PENDING': 'status-pending',
    'PENDING APPROVAL': 'status-pending',
    'APPROVED': 'status-approved',
    'COMPLETE': 'status-approved'
  };
  return statusMap[status] || 'status-pending';
}
function populateTable(tableId, statusFunction, options = {}) {
  const { showLoading = true } = options;
  const tbody = document.querySelector(`#${tableId}`);
  if (!tbody) {
    console.error(`Table body not found: ${tableId}`);
    return;
  }

  // If explicit loading requested (initial/manual), show placeholder.
  if (showLoading) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading applications...</td></tr>`;
  } else {
    // For background refreshes, keep existing rows visible but mark busy for subtle UI hint.
    tbody.setAttribute('aria-busy', 'true');
    tbody.style.opacity = '0.7';
  }

  const onSuccess = function(data) {
    // Clear busy state
    tbody.removeAttribute('aria-busy');
    tbody.style.opacity = '1';

    const filteredData = Array.isArray(data) ? data.filter(row => row?.appNumber?.toString().trim()) : [];
    // Build rows via DOM to avoid innerHTML flicker
    if (!filteredData.length) {
      // If no data, show a no-data row
      tbody.innerHTML = `<tr><td colspan="5" class="no-data">No applications found</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    filteredData.forEach(row => {
      const appNumber = row.appNumber || '';
      const tr = document.createElement('tr');

      // App number cell with link (attach event listener rather than inline onclick)
      const tdApp = document.createElement('td');
      tdApp.className = 'app-number';
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.className = 'app-number-link';
      a.textContent = appNumber;
      a.addEventListener('click', function() { handleAppNumberClick(appNumber); });
      tdApp.appendChild(a);
      tr.appendChild(tdApp);

      // Applicant name
      const tdName = document.createElement('td');
      tdName.className = 'applicant-name';
      tdName.textContent = row.applicantName || 'N/A';
      tr.appendChild(tdName);

      // Amount
      const tdAmount = document.createElement('td');
      tdAmount.className = 'amount';
      tdAmount.textContent = format.currency(row.amount);
      tr.appendChild(tdAmount);

      // Date
      const tdDate = document.createElement('td');
      tdDate.className = 'date';
      tdDate.textContent = row.date ? format.date(row.date) : 'N/A';
      tr.appendChild(tdDate);

      // Action by
      const tdActionBy = document.createElement('td');
      tdActionBy.className = 'action-by';
      tdActionBy.textContent = row.actionBy || 'N/A';
      tr.appendChild(tdActionBy);

      fragment.appendChild(tr);
    });

    // Replace children in one operation for smooth update
    tbody.replaceChildren(fragment);
  };

  const onFailure = function(error) {
    // Remove busy state
    tbody.removeAttribute('aria-busy');
    tbody.style.opacity = '1';

    // If the table was previously empty, show an error row; otherwise keep existing rows intact.
    if (!tbody.children.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading data: ${error?.message || 'Unknown error'}</td></tr>`;
    } else {
      console.error('Error populating table (background refresh kept existing rows):', error);
      // Optionally, you could show a transient toast/console message here instead of replacing rows.
    }
  };

  const statusFunctions = {
    'getNewApplications': google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onFailure).getNewApplications,
    'getPendingApplications': google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onFailure).getPendingApplications,
    'getPendingApprovalApplications': google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onFailure).getPendingApprovalApplications,
    'getApprovedApplications': google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onFailure).getApprovedApplications
  };
  if (statusFunctions[statusFunction]) statusFunctions[statusFunction]();
}

// ----------- UPDATED APPLICATION CLICK HANDLER -----------
// ----------- UPDATED APPLICATION CLICK HANDLER -----------
function handleAppNumberClick(appNumber) {
  if (!appNumber || appNumber === 'undefined' || appNumber === 'null') {
    alert('Error: Invalid application number');
    return;
  }
  
  const userName = localStorage.getItem('loggedInName');
  showLoading();
  
  google.script.run
    .withSuccessHandler(function(response) {
      hideLoading();
      if (response && response.success && response.data) {
        const appData = response.data;
        
        // Check if this is a draft (NEW status with DRAFT completion status)
        if (appData.status === 'NEW' && appData.completionStatus === 'DRAFT') {
          // Open in edit mode (newApplicationModal)
          showNewApplicationModal(appNumber); // This will load the existing draft
        } else {
          // Open in view mode (viewApplicationModal)
          openViewApplicationModal(appData);
        }
      } else {
        alert('Failed to load application: ' + (response?.message || 'Application not found'));
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      if (error?.message?.includes('Application not found')) {
        alert('Application not found: ' + appNumber + '. Please try refreshing the list.');
      } else if (error?.message?.includes('not authorized')) {
        alert('You are not authorized to view this application.');
      } else {
        alert('Error loading application details: ' + (error?.message || error));
      }
    })
    .getApplicationDetails(appNumber, userName);
}

// ----------- VIEW APPLICATION MODAL FUNCTIONS -----------
  
// Function to open view application modal
function openViewApplicationModal(appData) {
  currentViewingAppData = appData;
  
  // Store app number in modal for reference
  sessionStorage.setItem('currentViewingApp', appData.appNumber);
  
  // Show modal
  if (cachedElements['viewApplicationModal']) {
    cachedElements['viewApplicationModal'].style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
  
  // Initialize modal with data if function exists
  if (typeof window.initViewApplicationModal === 'function') {
    window.initViewApplicationModal(appData);
  }
}

// Function to close view application modal
function closeViewApplicationModal() {
  if (cachedElements['viewApplicationModal']) {
    cachedElements['viewApplicationModal'].style.display = 'none';
    document.body.style.overflow = 'auto';
    currentViewingAppData = null;
    sessionStorage.removeItem('currentViewingApp');
  }
}

// Make function globally available
window.closeViewApplicationModal = closeViewApplicationModal;

// Handle escape key to close modal
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    if (cachedElements['viewApplicationModal'] && 
        cachedElements['viewApplicationModal'].style.display === 'block') {
      closeViewApplicationModal();
    }
  }
});

// Close modal when clicking outside
if (cachedElements['viewApplicationModal']) {
  cachedElements['viewApplicationModal'].addEventListener('click', function(event) {
    if (event.target === this) {
      closeViewApplicationModal();
    }
  });
}

function loadApplications(sectionId, options = { showLoading: true }) {
  const sectionMap = {
    'new': ['new-list','getNewApplications'],
    'pending': ['pending-list','getPendingApplications'],
    'pending-approvals': ['pending-approvals-list','getPendingApprovalApplications'],
    'approved': ['approved-list','getApprovedApplications']
  };
  if (sectionMap[sectionId]) {
    const [tableId, statusFunction] = sectionMap[sectionId];
    populateTable(tableId, statusFunction, options);
  }
}
function updateBadgeCounts() {
  google.script.run
    .withSuccessHandler(counts => {
      updateBadgeCount('new', counts.new);
      updateBadgeCount('pending', counts.pending);
      updateBadgeCount('pending-approvals', counts.pendingApprovals);
      updateBadgeCount('approved', counts.approved);
    })
    .withFailureHandler(error => { console.error('Error updating badge counts:', error); })
    .getAllApplicationCounts();
}
const debouncedRefreshApplications = debounce(function() {
  const activeSection = document.querySelector('.content-section.active')?.id;
  if (activeSection && activeSection !== 'new-application') {
    // Manual refresh should show loading to indicate action to the user
    loadApplications(activeSection, { showLoading: true });
    updateBadgeCounts();
    updateUserNotificationBadge();
  }
}, 300);
function refreshApplications() { debouncedRefreshApplications(); }
function initializeAndRefreshTables() {
  // initial load should show loading indicators
  loadApplications('new', { showLoading: true });
  updateBadgeCounts();
  updateUserNotificationBadge();
  if (refreshInterval) clearInterval(refreshInterval);
  // Background auto-refresh: keep it hidden (no "Loading..." placeholder) to avoid flicker.
  refreshInterval = setInterval(() => {
    const activeSection = document.querySelector('.content-section.active')?.id;
    if (activeSection && activeSection !== 'new-application') {
      // pass showLoading:false so the existing rows remain visible during the update
      loadApplications(activeSection, { showLoading: false });
    }
    updateBadgeCounts();
    updateUserNotificationBadge();
  }, 60000);
}

// ----------- REMOVE OLD APPLICATION DETAILS FUNCTIONS -----------
// Remove or comment out these old functions since we're using modal now:
// function displayApplicationDetails(appData) { ... }
// function generateDocumentLinks(documents) { ... }
// function viewLendingTemplate(docName, docUrl) { ... }
// function openReviewModal(appData) { ... }
// function generateReviewContent(appData) { ... }
// function closeReviewModal() { ... }
// function submitApplicationFromDetails(appNumber) { ... }
// function goBackToList() { ... } // If exists

// ----------- USER MANAGEMENT -----------
function getAllUsersHandler(users) {
  const tbody = document.getElementById('users-list-body');
  if (!tbody) return;
  if (!users?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="no-data">No users found</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.level)}</td>
      <td>${escapeHtml(user.role)}</td>
      <td class="actions">
        <button class="btn-icon btn-delete" title="Delete" onclick="deleteUser('${escapeHtml(user.name)}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}
function populateUsersTable() {
  google.script.run.withSuccessHandler(getAllUsersHandler).getAllUsers();
}
function refreshUsersList() { populateUsersTable(); }
document.getElementById('add-user-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('new-user-name')?.value.trim();
  const level = document.getElementById('new-user-level')?.value;
  const role = document.getElementById('new-user-role')?.value;
  if (!name || !level || !role) {
    alert('Please fill all fields!');
    return;
  }
  google.script.run.withSuccessHandler(function(res) {
    showSuccessModal(res.message || 'User added!');
    if (res.success) {
      showSection('users-list');
      refreshUsersList();
    }
  }).addUser({ name, level, role });
});
function deleteUser(userName) {
  if (!confirm('Are you sure you want to delete user: ' + userName + '?')) return;
  google.script.run.withSuccessHandler(function(res) {
    showSuccessModal(res.message || 'User deleted!');
    if (res.success) refreshUsersList();
  }).deleteUser(userName);
}

// ----------- SUCCESS MODAL -----------
function showSuccessModal(message) {
  if (cachedElements['success-message']) cachedElements['success-message'].textContent = message;
  if (cachedElements['success-modal']) cachedElements['success-modal'].style.display = 'flex';
}
function closeSuccessModal() {
  if (cachedElements['success-modal']) cachedElements['success-modal'].style.display = 'none';
}

// ----------- BROWSER NOTIFICATIONS -----------
function initializeBrowserNotifications() {
  if (!("Notification" in window)) return;
  switch (Notification.permission) {
    case "granted":
      setupNotificationListener(); break;
    case "denied":
      break;
    case "default":
      Notification.requestPermission().then(permission => {
        if (permission === "granted") setupNotificationListener();
      });
      break;
  }
}
function setupNotificationListener() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  notificationCheckInterval = setInterval(function() { checkForNewApplications(); }, 30000);
}
function checkForNewApplications() {
  const userName = localStorage.getItem('loggedInName');
  if (!userName || document.visibilityState === 'visible') return;
  google.script.run
    .withSuccessHandler(function(currentCount) {
      const previousCount = lastAppCount;
      lastAppCount = currentCount;
      if (currentCount > previousCount && previousCount > 0) {
        const newCount = currentCount - previousCount;
        const userRole = localStorage.getItem('userRole') || '';
        showApplicationNotification(userName, userRole, newCount);
      }
    })
    .withFailureHandler(function(error) { console.error('Error checking applications:', error); })
    .getApplicationsCountForUser(userName);
}
function showApplicationNotification(userName, userRole, count) {
  if (Notification.permission === "granted" && document.visibilityState !== 'visible') {
    const notification = new Notification("New Application Assignment", {
      body: `${userName} have ${count} application(s) for your action${userRole ? ` as ${userRole}` : ''}`,
      icon: "https://img.icons8.com/color/192/000000/loan.png",
      badge: "https://img.icons8.com/color/192/000000/loan.png",
      tag: "loan-application",
      requireInteraction: true
    });
    notification.onclick = function() {
      window.focus();
      notification.close();
      refreshApplications();
    };
    setTimeout(() => { notification.close(); }, 10000);
  }
}
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    refreshApplications();
    updateUserNotificationBadge();
  } else {
    const userName = localStorage.getItem('loggedInName');
    if (userName) {
      google.script.run.withSuccessHandler(function(count) {
        lastAppCount = count;
      }).getApplicationsCountForUser(userName);
    }
  }
}
function initializeAppCount() {
  const userName = localStorage.getItem('loggedInName');
  if (userName) {
    google.script.run
      .withSuccessHandler(function(count) { lastAppCount = count; })
      .getApplicationsCountForUser(userName);
  }
}