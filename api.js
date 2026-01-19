// API Service for Google Apps Script Backend
class ApiService {
  constructor() {
    // Your Google Apps Script Web App URL
    this.BASE_URL = 'https://script.google.com/macros/library/d/1ak-zLKC_xoyvAn3vOlpu4dBopqAdwoAaduAniMWPqcTqOevbRLksS6g7/15';
    this.cache = new Map();
    this.requestCount = 0;
    this.activeRequests = new Map();
  }

  // Generic JSONP request method
  // options: { showLoading: true/false, useCache: true/false, timeout: 30000 }
  async request(action, data = {}, options = {}) {
    const showLoading = options.showLoading !== false;
    const useCache = options.useCache !== false;
    const timeout = options.timeout || 30000;
    
    // Generate cache key
    const cacheKey = `${action}_${JSON.stringify(data)}`;
    
    // Check cache
    if (useCache && this.cache.has(cacheKey)) {
      console.log('Cache hit for:', cacheKey);
      return Promise.resolve(this.cache.get(cacheKey));
    }
    
    try {
      // Show loading indicator
      if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'flex';
      }
      
      const requestId = ++this.requestCount;
      
      return new Promise((resolve, reject) => {
        const callbackName = `api_callback_${requestId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create script element
        const script = document.createElement('script');
        const url = new URL(this.BASE_URL);
        
        // Add parameters
        url.searchParams.append('action', action);
        url.searchParams.append('data', JSON.stringify(data));
        url.searchParams.append('callback', callbackName);
        url.searchParams.append('_', Date.now()); // Cache buster
        
        console.log('API Request:', { action, data, url: url.toString() });
        
        // Set up callback
        window[callbackName] = (response) => {
          console.log('API Response:', { action, response });
          
          // Cleanup
          this.cleanupRequest(script, callbackName);
          
          // Hide loading
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          // Remove from active requests
          this.activeRequests.delete(requestId);
          
          // Handle response
          if (response && response.success) {
            // Cache successful responses
            if (useCache) {
              this.cache.set(cacheKey, response);
            }
            resolve(response);
          } else {
            const error = new Error(response?.error || response?.message || 'API request failed');
            error.response = response;
            reject(error);
          }
        };
        
        // Set up error handling
        script.onerror = (error) => {
          console.error('API Script Error:', error);
          this.cleanupRequest(script, callbackName);
          
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          this.activeRequests.delete(requestId);
          reject(new Error(`Network error: Failed to load script from ${url.toString()}`));
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          if (this.activeRequests.has(requestId)) {
            this.cleanupRequest(script, callbackName);
            this.activeRequests.delete(requestId);
            reject(new Error(`Request timeout after ${timeout}ms for action: ${action}`));
          }
        }, timeout);
        
        // Store request info
        this.activeRequests.set(requestId, { script, callbackName, timeoutId });
        
        // Load script
        script.src = url.toString();
        document.head.appendChild(script);
        
      });
      
    } catch (error) {
      // Hide loading on error
      if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
      }
      
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Cleanup request resources
  cleanupRequest(script, callbackName) {
    // Remove script element
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
    
    // Remove callback from window
    if (window[callbackName]) {
      delete window[callbackName];
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('API cache cleared');
  }

  // Cancel all pending requests
  cancelAllRequests() {
    for (const [requestId, request] of this.activeRequests) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      this.cleanupRequest(request.script, request.callbackName);
    }
    this.activeRequests.clear();
    console.log('All pending API requests cancelled');
  }

  // ----------- AUTHENTICATION APIs -----------
  async login(name, options = {}) {
    return this.request('login', { name }, options);
  }

  async verifyUser(name, options = {}) {
    return this.request('verify_user', { name }, options);
  }

  // ----------- APPLICATION APIs -----------
  async getApplications(status, options = {}) {
    return this.request('get_applications', { status }, options);
  }

  async getApplicationDetails(appNumber, userName, options = {}) {
    return this.request('get_application_details', { appNumber, userName }, options);
  }

  async getApplicationCounts(options = {}) {
    return this.request('get_application_counts', {}, options);
  }

  async getApplicationCountsForUser(userName, options = {}) {
    return this.request('get_application_counts_for_user', { userName }, options);
  }

  async getNewApplicationContext(options = {}) {
    return this.request('get_new_application_context', {}, options);
  }

  async saveApplication(appNumber, formData, userName, isDraft = false, options = {}) {
    return this.request('save_application', {
      appNumber,
      formData,
      userName,
      isDraft
    }, options);
  }

  async submitApplication(appData, userName, options = {}) {
    return this.request('submit_application', {
      appData,
      userName
    }, options);
  }

  // ----------- USER MANAGEMENT APIs -----------
  async getAllUsers(options = {}) {
    return this.request('get_all_users', {}, options);
  }

  async addUser(userData, options = {}) {
    return this.request('add_user', userData, options);
  }

  async deleteUser(userName, options = {}) {
    return this.request('delete_user', { name: userName }, options);
  }

  // ----------- UTILITY APIs -----------
  async copyLendingTemplate(appNumber, folderId, options = {}) {
    return this.request('copy_lending_template', {
      appNumber,
      folderId
    }, options);
  }

  async saveApplicationDraft(appObj, userName, options = {}) {
    return this.request('save_application_draft', {
      appObj,
      userName
    }, options);
  }

  // ----------- TEST API -----------
  async testConnection(options = {}) {
    try {
      const response = await this.request('test_connection', {}, options);
      return {
        connected: response.success,
        message: response.success ? 'Connected to server' : 'Connection failed',
        response: response
      };
    } catch (error) {
      return {
        connected: false,
        message: 'Connection failed: ' + error.message,
        error: error
      };
    }
  }
}

// Create global API instance
window.apiService = new ApiService();

// Legacy compatibility layer (for existing code that uses google.script.run)
window.ApplicationAPI = {
  getApplicationsByStatus: async (status) => {
    const response = await window.apiService.getApplications(status);
    return response.data || [];
  },

  getApplicationDetails: async (appNumber, userName) => {
    const response = await window.apiService.getApplicationDetails(appNumber, userName);
    if (response.success && response.data) {
      return response;
    } else {
      throw new Error(response?.message || 'Failed to get application details');
    }
  },

  saveProcessApplicationForm: async (appNumber, formData, userName, isDraft = false) => {
    const response = await window.apiService.saveApplication(appNumber, formData, userName, isDraft);
    return response;
  },

  getAllApplicationCounts: async () => {
    const response = await window.apiService.getApplicationCounts();
    return response.data || {};
  },

  getApplicationsCountForUser: async (userName) => {
    const response = await window.apiService.getApplicationCountsForUser(userName);
    return response.count || 0;
  },

  getNewApplicationContext: async () => {
    const response = await window.apiService.getNewApplicationContext();
    return response.data || {};
  },

  getNewApplications: async () => {
    const response = await window.apiService.getApplications('NEW');
    return response.data || [];
  },

  getPendingApplications: async () => {
    const response = await window.apiService.getApplications('PENDING');
    return response.data || [];
  },

  getPendingApprovalApplications: async () => {
    const response = await window.apiService.getApplications('PENDING_APPROVAL');
    return response.data || [];
  },

  getApprovedApplications: async () => {
    const response = await window.apiService.getApplications('APPROVED');
    return response.data || [];
  }
};

window.UserAPI = {
  authenticateUser: async (name) => {
    const response = await window.apiService.login(name);
    return response;
  },

  getAllUsers: async () => {
    const response = await window.apiService.getAllUsers();
    return response.data || [];
  },

  addUser: async (userData) => {
    const response = await window.apiService.addUser(userData);
    return response;
  },

  deleteUser: async (userName) => {
    const response = await window.apiService.deleteUser(userName);
    return response;
  },

  getApplicationsCountForUser: async (userName) => {
    const response = await window.apiService.getApplicationCountsForUser(userName);
    return response.count || 0;
  }
};

window.UtilityAPI = {
  copyLendingTemplate: async (appNumber, folderId) => {
    const response = await window.apiService.copyLendingTemplate(appNumber, folderId);
    return response.url;
  },

  saveApplicationDraft: async (appObj, userName) => {
    const response = await window.apiService.saveApplicationDraft(appObj, userName);
    return response;
  },

  submitApplication: async (appObj, userName) => {
    const response = await window.apiService.submitApplication(appObj, userName);
    return response;
  }
};

// Utility functions for easy access
window.apiUtils = {
  testApi: async () => {
    try {
      const result = await window.apiService.testConnection();
      console.log('API Test Result:', result);
      return result;
    } catch (error) {
      console.error('API Test Failed:', error);
      return { connected: false, message: error.message };
    }
  },

  clearCache: () => {
    window.apiService.clearCache();
  },

  getActiveRequestCount: () => {
    return window.apiService.activeRequests.size;
  },

  cancelAllRequests: () => {
    window.apiService.cancelAllRequests();
  }
};

// Initialize and test connection on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('API Service initialized with URL:', window.apiService.BASE_URL);
  
  // Test connection on startup (optional - can be commented out)
  // window.apiUtils.testApi().then(result => {
  //   if (result.connected) {
  //     console.log('✅ API connection successful');
  //   } else {
  //     console.warn('⚠️ API connection failed:', result.message);
  //   }
  // });
});
