// api.js - Simplified to work with your new request handler
class ApiService {
  constructor() {
    this.BASE_URL = 'https://script.google.com/macros/s/AKfycbxPg6_2_tTutca2EM6ZInFvH18YXKkx56KcqY8DfYgrBBjlKge2iomqt42huj85aA3agQ/exec';
  }

  // Generic JSONP request method
  async request(action, data = {}, options = {}) {
    const showLoading = options.showLoading !== false;
    const timeout = options.timeout || 30000;
    
    console.log(`API Request [${action}]:`, { 
      action, 
      data, 
      showLoading,
      options 
    });
    
    try {
      // Show loading indicator only for foreground requests
      if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
          loadingEl.style.display = 'flex';
          // Update loading message if provided
          if (options.loadingMessage) {
            const messageEl = loadingEl.querySelector('p');
            if (messageEl) {
              messageEl.textContent = options.loadingMessage;
            }
          }
        }
      }
      
      return new Promise((resolve, reject) => {
        const callbackName = `api_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create script element
        const script = document.createElement('script');
        const url = new URL(this.BASE_URL);
        
        // Add parameters - using the format your handleRequest expects
        url.searchParams.append('action', action);
        
        // Add data if provided
        if (data && Object.keys(data).length > 0) {
          url.searchParams.append('data', JSON.stringify(data));
        }
        
        url.searchParams.append('callback', callbackName);
        url.searchParams.append('_', Date.now()); // Cache buster
        
        console.log('API Request URL:', url.toString());
        
        // Set up callback
        window[callbackName] = (response) => {
          console.log(`API Response [${action}]:`, response);
          
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          delete window[callbackName];
          
          // Hide loading only if it was shown
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          // Clear timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          // Handle response
          if (response && response.success !== undefined) {
            resolve(response);
          } else {
            const error = new Error(response?.error || response?.message || `API request failed for action: ${action}`);
            error.response = response;
            reject(error);
          }
        };
        
        // Set up error handling
        script.onerror = (error) => {
          console.error(`API Script Error [${action}]:`, error);
          
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          if (window[callbackName]) {
            delete window[callbackName];
          }
          
          // Hide loading only if it was shown
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          // Clear timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          reject(new Error(`Failed to load script from ${url.toString()}. Network error or CORS issue.`));
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          console.error(`API Request Timeout [${action}] after ${timeout}ms`);
          
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          if (window[callbackName]) {
            delete window[callbackName];
          }
          
          // Hide loading only if it was shown
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          reject(new Error(`Request timeout after ${timeout}ms for action: ${action}`));
        }, timeout);
        
        // Set script attributes
        script.type = 'text/javascript';
        script.charset = 'utf-8';
        script.async = true;
        
        // Load script
        script.src = url.toString();
        document.head.appendChild(script);
        
        // Log script addition
        console.log(`Script element added for action: ${action}`);
      });
      
    } catch (error) {
      // Hide loading on error only if it was shown
      if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
      }
      
      console.error(`API Request Catch Error [${action}]:`, error);
      throw error;
    }
  }

  // ----------- AUTHENTICATION APIs -----------
  async login(name, options = {}) {
    return this.request('login', { name }, { 
      ...options, 
      loadingMessage: 'Signing in...' 
    });
  }

  async verifyUser(name, options = {}) {
    return this.request('verify_user', { name }, { 
      ...options, 
      showLoading: false // Background verification
    });
  }

  // ----------- APPLICATION APIs -----------
  async getApplications(status, options = {}) {
    // Default to not showing loading for this, as it's often used for auto-refresh
    const defaultOptions = { showLoading: false, loadingMessage: 'Loading applications...' };
    return this.request('get_applications', { status }, { ...defaultOptions, ...options });
  }

  async getApplicationDetails(appNumber, userName, options = {}) {
    return this.request('get_application_details', { appNumber, userName }, { 
      ...options, 
      loadingMessage: 'Loading application details...' 
    });
  }

  async getApplicationCounts(options = {}) {
    return this.request('get_application_counts', {}, { 
      ...options, 
      showLoading: false // Background update
    });
  }

  async getApplicationCountsForUser(userName, options = {}) {
    return this.request('get_application_counts_for_user', { userName }, { 
      ...options, 
      showLoading: false // Background update
    });
  }

  async getNewApplicationContext(options = {}) {
    return this.request('get_new_application_context', {}, { 
      ...options, 
      loadingMessage: 'Preparing new application...' 
    });
  }

  async saveApplication(appNumber, formData, userName, isDraft = false, options = {}) {
    return this.request('save_application', {
      appNumber,
      formData,
      userName,
      isDraft
    }, { 
      ...options, 
      loadingMessage: isDraft ? 'Saving draft...' : 'Saving application...' 
    });
  }

  async submitApplication(appData, userName, options = {}) {
    return this.request('submit_application', {
      appData,
      userName
    }, { 
      ...options, 
      loadingMessage: 'Submitting application...' 
    });
  }

  // ----------- USER MANAGEMENT APIs -----------
  async getAllUsers(options = {}) {
    return this.request('get_all_users', {}, { 
      ...options, 
      loadingMessage: 'Loading users...' 
    });
  }

  async addUser(userData, options = {}) {
    return this.request('add_user', userData, { 
      ...options, 
      loadingMessage: 'Adding user...' 
    });
  }

  async deleteUser(userName, options = {}) {
    return this.request('delete_user', { name: userName }, { 
      ...options, 
      loadingMessage: 'Deleting user...' 
    });
  }

  // ----------- UTILITY APIs -----------
  async copyLendingTemplate(appNumber, folderId, options = {}) {
    return this.request('copy_lending_template', {
      appNumber,
      folderId
    }, { 
      ...options, 
      loadingMessage: 'Preparing template...' 
    });
  }

  async saveApplicationDraft(appObj, userName, options = {}) {
    return this.request('save_application_draft', {
      appObj,
      userName
    }, { 
      ...options, 
      loadingMessage: 'Saving draft...' 
    });
  }

  // ----------- TEST API -----------
  async testConnection(options = {}) {
    try {
      const response = await this.request('test_connection', {}, { 
        ...options, 
        showLoading: false 
      });
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

  // ----------- HEALTH CHECK -----------
  async healthCheck(options = {}) {
    return this.testConnection(options);
  }
}

// Create global API instance
window.apiService = new ApiService();

// Legacy compatibility layer
window.ApplicationAPI = {
  getApplicationsByStatus: async (status, options = {}) => {
    const response = await window.apiService.getApplications(status, options);
    return response.data || [];
  },

  getApplicationDetails: async (appNumber, userName, options = {}) => {
    const response = await window.apiService.getApplicationDetails(appNumber, userName, options);
    if (response.success && response.data) {
      return response;
    } else {
      throw new Error(response?.message || 'Failed to get application details');
    }
  },

  saveProcessApplicationForm: async (appNumber, formData, userName, isDraft = false, options = {}) => {
    const response = await window.apiService.saveApplication(appNumber, formData, userName, isDraft, options);
    return response;
  },

  getAllApplicationCounts: async (options = {}) => {
    const response = await window.apiService.getApplicationCounts(options);
    return response.data || {};
  },

  getApplicationsCountForUser: async (userName, options = {}) => {
    const response = await window.apiService.getApplicationCountsForUser(userName, options);
    return response.count || 0;
  },

  getNewApplicationContext: async (options = {}) => {
    const response = await window.apiService.getNewApplicationContext(options);
    return response.data || {};
  },

  getNewApplications: async (options = {}) => {
    const response = await window.apiService.getApplications('NEW', options);
    return response.data || [];
  },

  getPendingApplications: async (options = {}) => {
    const response = await window.apiService.getApplications('PENDING', options);
    return response.data || [];
  },

  getPendingApprovalApplications: async (options = {}) => {
    const response = await window.apiService.getApplications('PENDING_APPROVAL', options);
    return response.data || [];
  },

  getApprovedApplications: async (options = {}) => {
    const response = await window.apiService.getApplications('APPROVED', options);
    return response.data || [];
  }
};

window.UserAPI = {
  authenticateUser: async (name, options = {}) => {
    const response = await window.apiService.login(name, options);
    return response;
  },

  getAllUsers: async (options = {}) => {
    const response = await window.apiService.getAllUsers(options);
    return response.data || [];
  },

  addUser: async (userData, options = {}) => {
    const response = await window.apiService.addUser(userData, options);
    return response;
  },

  deleteUser: async (userName, options = {}) => {
    const response = await window.apiService.deleteUser(userName, options);
    return response;
  },

  getApplicationsCountForUser: async (userName, options = {}) => {
    const response = await window.apiService.getApplicationCountsForUser(userName, options);
    return response.count || 0;
  }
};

window.UtilityAPI = {
  copyLendingTemplate: async (appNumber, folderId, options = {}) => {
    const response = await window.apiService.copyLendingTemplate(appNumber, folderId, options);
    return response.url;
  },

  saveApplicationDraft: async (appObj, userName, options = {}) => {
    const response = await window.apiService.saveApplicationDraft(appObj, userName, options);
    return response;
  },

  submitApplication: async (appObj, userName, options = {}) => {
    const response = await window.apiService.submitApplication(appObj, userName, options);
    return response;
  },

  testConnection: async (options = {}) => {
    return window.apiService.testConnection(options);
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('API Service initialized with URL:', window.apiService.BASE_URL);
  
  // Test connection on startup
  setTimeout(() => {
    window.apiService.testConnection()
      .then(result => {
        console.log('API Connection test:', result.connected ? 'SUCCESS' : 'FAILED', result.message);
      })
      .catch(error => {
        console.warn('API Connection test failed:', error.message);
      });
  }, 1000);
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
}
