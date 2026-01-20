// api.js - Simplified to work with your new request handler
class ApiService {
  constructor() {
    this.BASE_URL = 'https://script.google.com/macros/s/AKfycbxPg6_2_tTutca2EM6ZInFvH18YXKkx56KcqY8DfYgrBBjlKge2iomqt42huj85aA3agQ/exec';
  }

  // Generic JSONP request method
  async function request(action, data = {}, options = {}) {
  const showLoading = options.showLoading !== false;
  const timeout = options.timeout || 30000;
  
  try {
    // Only show loading for non-background requests
    if (showLoading) {
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'flex';
    }
      
      return new Promise((resolve, reject) => {
        const callbackName = `api_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create script element
        const script = document.createElement('script');
        const url = new URL(this.BASE_URL);
        
        // Add parameters - using the format your handleRequest expects
        url.searchParams.append('action', action);
        url.searchParams.append('data', JSON.stringify(data));
        url.searchParams.append('callback', callbackName);
        url.searchParams.append('_', Date.now()); // Cache buster
        
        console.log('API Request:', { action, data, url: url.toString() });
        
        // Set up callback
        window[callbackName] = (response) => {
          console.log('API Response:', { action, response });
          
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          delete window[callbackName];
          
          // Hide loading
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
            const error = new Error(response?.error || response?.message || 'API request failed');
            error.response = response;
            reject(error);
          }
        };
        
        // Set up error handling
        script.onerror = (error) => {
          console.error('API Script Error:', error);
          
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          if (window[callbackName]) {
            delete window[callbackName];
          }
          
          // Hide loading
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          // Clear timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          reject(new Error(`Failed to load script from ${url.toString()}`));
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          // Cleanup
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          if (window[callbackName]) {
            delete window[callbackName];
          }
          reject(new Error(`Request timeout after ${timeout}ms for action: ${action}`));
        }, timeout);
        
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

// Legacy compatibility layer
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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('API Service initialized with URL:', window.apiService.BASE_URL);
});
