// api.js - JSONP API Service for Loan Application Dashboard

// API Service for Google Apps Script Backend
class ApiService {
  constructor() {
    // UPDATE THIS with your Google Apps Script Web App URL
    this.BASE_URL = ScriptApp.getService().getUrl();
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
      return this.cache.get(cacheKey);
    }
    
    try {
      // Show loading indicator
      if (showLoading && typeof showLoading === 'function') {
        showLoading(true);
      } else if (showLoading && window.showLoading) {
        window.showLoading(true);
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
        
        // Set up callback
        window[callbackName] = (response) => {
          // Cleanup
          this.cleanupRequest(script, callbackName);
          
          // Hide loading
          if (showLoading && typeof showLoading === 'function') {
            showLoading(false);
          } else if (showLoading && window.hideLoading) {
            window.hideLoading();
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
        script.onerror = () => {
          this.cleanupRequest(script, callbackName);
          
          if (showLoading && typeof showLoading === 'function') {
            showLoading(false);
          } else if (showLoading && window.hideLoading) {
            window.hideLoading();
          }
          
          this.activeRequests.delete(requestId);
          reject(new Error('Network error: Failed to load script'));
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          if (this.activeRequests.has(requestId)) {
            this.cleanupRequest(script, callbackName);
            this.activeRequests.delete(requestId);
            reject(new Error(`Request timeout after ${timeout}ms`));
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
      if (showLoading && typeof showLoading === 'function') {
        showLoading(false);
      } else if (showLoading && window.hideLoading) {
        window.hideLoading();
      }
      
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
  }

  // ----------- AUTHENTICATION APIs -----------
  async login(name, options = {}) {
    return this.request('login', { name }, options);
  }

  async verifyUser(name, options = {}) {
    return this.request('verify_user', { name }, options);
  }

  async logout(options = {}) {
    return this.request('logout', {}, options);
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

  async saveApplicationDraft(appObj, userName, options = {}) {
    return this.request('save_application_draft', {
      appObj,
      userName
    }, options);
  }

  async updateApplication(appNumber, updates, userName, options = {}) {
    return this.request('update_application', {
      appNumber,
      updates,
      userName
    }, options);
  }

  async updateApplicationStatus(appNumber, status, comments, userName, options = {}) {
    return this.request('update_application_status', {
      appNumber,
      status,
      comments,
      userName
    }, options);
  }

  async getDraftApplications(userName, options = {}) {
    return this.request('get_draft_applications', { userName }, options);
  }

  async getPendingApplications(userName, options = {}) {
    return this.request('get_pending_applications', { userName }, options);
  }

  async getApprovedApplications(userName, options = {}) {
    return this.request('get_approved_applications', { userName }, options);
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

  async updateUser(userName, updates, options = {}) {
    return this.request('update_user', { userName, updates }, options);
  }

  async getUsersByRole(role, options = {}) {
    return this.request('get_users_by_role', { role }, options);
  }

  // ----------- FILE APIs -----------
  async copyLendingTemplate(appNumber, folderId, options = {}) {
    return this.request('copy_lending_template', {
      appNumber,
      folderId
    }, options);
  }

  async uploadFile(appNumber, fileType, fileData, fileName, options = {}) {
    return this.request('upload_file', {
      appNumber,
      fileType,
      fileData,
      fileName
    }, options);
  }

  async getDocumentUrl(documentId, options = {}) {
    return this.request('get_document_url', { documentId }, options);
  }

  // ----------- WORKFLOW APIs -----------
  async getWorkflowHistory(appNumber, options = {}) {
    return this.request('get_workflow_history', { appNumber }, options);
  }

  async processWorkflowAction(appNumber, action, comments, userName, options = {}) {
    return this.request('process_workflow_action', {
      appNumber,
      action,
      comments,
      userName
    }, options);
  }

  async getNextWorkflowStep(appNumber, userName, options = {}) {
    return this.request('get_next_workflow_step', {
      appNumber,
      userName
    }, options);
  }

  // ----------- DASHBOARD & STATS APIs -----------
  async getDashboardStats(userName, options = {}) {
    return this.request('get_dashboard_stats', { userName }, options);
  }

  async getUserNotifications(userName, options = {}) {
    return this.request('get_user_notifications', { userName }, options);
  }

  async getRecentActivity(options = {}) {
    return this.request('get_recent_activity', {}, options);
  }

  // ----------- SYSTEM APIs -----------
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

  async initializeSystem(options = {}) {
    return this.request('initialize_system', {}, options);
  }

  async getSystemSettings(options = {}) {
    return this.request('get_system_settings', {}, options);
  }

  async updateSystemSettings(settings, options = {}) {
    return this.request('update_system_settings', { settings }, options);
  }

  // ----------- PRINT & EXPORT APIs -----------
  async printApplication(appNumber, options = {}) {
    return this.request('print_application', { appNumber }, options);
  }

  async exportApplication(appNumber, format = 'pdf', options = {}) {
    return this.request('export_application', { appNumber, format }, options);
  }
}

// Create global API instance
window.apiService = new ApiService();

// Legacy compatibility layer
window.ApplicationAPI = {
  getApplicationsByStatus: async (status, options = {}) => {
    const response = await window.apiService.getApplications(status, options);
    return {
      success: response.success,
      data: response.data || []
    };
  },

  getApplicationDetails: async (appNumber, userName, options = {}) => {
    const response = await window.apiService.getApplicationDetails(appNumber, userName, options);
    return response;
  },

  saveApplication: async (appNumber, formData, userName, isDraft = false, options = {}) => {
    const response = await window.apiService.saveApplication(appNumber, formData, userName, isDraft, options);
    return response;
  },

  getApplicationCounts: async (options = {}) => {
    const response = await window.apiService.getApplicationCounts(options);
    return {
      success: response.success,
      data: response.data || {}
    };
  },

  getNewApplicationContext: async (options = {}) => {
    const response = await window.apiService.getNewApplicationContext(options);
    return {
      success: response.success,
      data: response.data || {}
    };
  }
};

window.UserAPI = {
  authenticateUser: async (name, options = {}) => {
    const response = await window.apiService.login(name, options);
    return response;
  },

  getAllUsers: async (options = {}) => {
    const response = await window.apiService.getAllUsers(options);
    return {
      success: response.success,
      data: response.data || []
    };
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
  }
};

// Utility functions
window.apiUtils = {
  // Test API connection
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

  // Clear API cache
  clearCache: () => {
    window.apiService.clearCache();
    console.log('API cache cleared');
  },

  // Get active request count
  getActiveRequestCount: () => {
    return window.apiService.activeRequests.size;
  },

  // Cancel all pending requests
  cancelAllRequests: () => {
    window.apiService.cancelAllRequests();
    console.log('All pending API requests cancelled');
  },

  // Get API base URL
  getBaseUrl: () => {
    return window.apiService.BASE_URL;
  }
};

// Initialize API on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('API Service initialized. Base URL:', window.apiService.BASE_URL);
  
  // Test connection on startup (optional)
  // window.apiUtils.testApi().then(result => {
  //   if (result.connected) {
  //     console.log('API connection successful');
  //   } else {
  //     console.warn('API connection failed:', result.message);
  //   }
  // });
});
