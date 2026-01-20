// ----------- MAIN APPLICATION LOGIC -----------

// ----------- GLOBAL VARIABLES -----------
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
    'viewApplicationModal': 'viewApplicationModal',
    'newApplicationModal': 'newApplicationModal',
    'application-form': 'application-form',
    'login-form': 'login-form'
  };
  for (const [key, id] of Object.entries(elements)) {
    cachedElements[key] = document.getElementById(id);
  }
  // keep original HTML for the Start New Application button
  if (!_startButtonOriginalHTML && cachedElements['start-new-application-card-btn']) {
    _startButtonOriginalHTML = cachedElements['start-new-application-card-btn'].innerHTML;
  }
}

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
  
  // Set current date
  if (cachedElements['current-date']) {
    cachedElements['current-date'].textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  
  // Initialize browser notifications
  initializeBrowserNotifications();
  
  // Setup visibility change handler
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Check if user is already logged in
  const loggedInName = localStorage.getItem('loggedInName');
  if (!loggedInName) { 
    showLoginModal(); 
  } else { 
    verifyUserOnLoad(loggedInName); 
  }
  
  // Setup application form submit handler
  if (cachedElements['application-form']) {
    cachedElements['application-form'].addEventListener('submit', handleApplicationFormSubmit);
  }
  
  // Setup login form submit handler (if not already in Login.js)
  if (cachedElements['login-form'] && !cachedElements['login-form'].hasAttribute('data-handler-attached')) {
    cachedElements['login-form'].addEventListener('submit', handleLoginFormSubmit);
    cachedElements['login-form'].setAttribute('data-handler-attached', 'true');
  }
  
  // Close modals when clicking outside
  setupModalClickOutsideHandlers();
});

function setupModalClickOutsideHandlers() {
  // New Application Modal
  const newAppModal = cachedElements['newApplicationModal'];
  if (newAppModal) {
    window.addEventListener('click', function(event) {
      if (event.target == newAppModal) closeModal();
    });
  }
  
  // View Application Modal
  const viewAppModal = cachedElements['viewApplicationModal'];
  if (viewAppModal) {
    viewAppModal.addEventListener('click', function(event) {
      if (event.target === this) {
        closeViewApplicationModal();
      }
    });
  }
}

// ----------- LOGIN FORM HANDLER -----------
function handleLoginFormSubmit(e) {
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
}

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
  
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  
  // Show selected section
  document.getElementById(sectionId).classList.add('active');
  
  // Update active menu buttons
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.menu-btn[onclick*="showSection('${sectionId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Handle section-specific logic
  if (sectionId === 'new-application') {
    startNewApplication();
  } else if (sectionId === 'users-list') {
    refreshUsersList();
  }
  
  // Remove application-details from navigation since we're using modal now
}, 150);

function showSection(sectionId) { 
  debouncedShowSection(sectionId); 
}

// ----------- APPLICATION FORM HANDLER -----------
function handleApplicationFormSubmit(e) {
  e.preventDefault();
  
  // Validate form fields
  const form = e.target;
  const formData = new FormData(form);
  const applicantName = formData.get('applicantName')?.trim();
  const requestedAmount = formData.get('requestedAmount')?.trim();
  
  if (!applicantName || !requestedAmount) {
    alert('Please fill in all required fields: Applicant Name and Requested Amount');
    return;
  }
  
  if (isNaN(parseFloat(requestedAmount)) || parseFloat(requestedAmount) <= 0) {
    alert('Please enter a valid amount greater than 0');
    return;
  }
  
  showLoading();
  const userName = localStorage.getItem('loggedInName');
  
  google.script.run
    .withSuccessHandler(function(res) {
      hideLoading();
      if (res.success) {
        showSuccessModal(res.message || 'Application submitted successfully!');
        updateUserNotificationBadge();
        resetApplicationForm();
        showSection('new'); // Navigate back to main view
      } else {
        alert('Error: ' + res.message);
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      alert('Error submitting application: ' + error.message);
    })
    .submitApplication({
      appNumber: currentAppNumber,
      applicantName: applicantName,
      requestedAmount: requestedAmount
    }, userName);
}

// ----------- VIEW APPLICATION MODAL FUNCTIONS -----------
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

function closeViewApplicationModal() {
  if (cachedElements['viewApplicationModal']) {
    cachedElements['viewApplicationModal'].style.display = 'none';
    document.body.style.overflow = 'auto';
    currentViewingAppData = null;
    sessionStorage.removeItem('currentViewingApp');
  }
}

// Make functions globally available
window.showSection = showSection;
window.openViewApplicationModal = openViewApplicationModal;
window.closeViewApplicationModal = closeViewApplicationModal;

// Handle escape key to close modals
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    // Close View Application Modal
    if (cachedElements['viewApplicationModal'] && 
        cachedElements['viewApplicationModal'].style.display === 'block') {
      closeViewApplicationModal();
    }
    
    // Close New Application Modal
    if (cachedElements['newApplicationModal'] && 
        cachedElements['newApplicationModal'].style.display === 'block') {
      closeModal();
    }
  }
});

// ----------- UTILITY FUNCTIONS -----------
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

function resetApplicationForm() {
  const form = document.getElementById('application-form');
  if (form) form.reset();
  
  // Reset file upload labels
  ['bank-statement-name','pay-slip-name','undertaking-name','loan-statement-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'No file chosen';
      el.style.color = '';
    }
  });
  
  // Reset application context
  currentAppNumber = "";
  currentAppFolderId = "";
  if (cachedElements['app-number']) {
    cachedElements['app-number'].textContent = "";
  }
}

// Safe HTML escaper for UI injection
function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, function(m){ 
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; 
  });
}

// Export functions for other modules
window.MainApp = {
  showSection,
  openViewApplicationModal,
  closeViewApplicationModal,
  showLoading,
  hideLoading,
  resetApplicationForm,
  cacheElements,
  getCachedElement: (key) => cachedElements[key]
};