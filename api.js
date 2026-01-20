// api.js - Updated with better JSONP handling
class ApiService {
  constructor() {
    this.BASE_URL = 'https://script.google.com/macros/s/AKfycbxPg6_2_tTutca2EM6ZInFvH18YXKkx56KcqY8DfYgrBBjlKge2iomqt42huj85aA3agQ/exec';
    this.cache = new Map();
    this.requestCount = 0;
    this.activeRequests = new Map();
  }

  // Generic JSONP request method
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
        const callbackName = `api_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
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
          console.log('API Response received:', { action, response });
          
          // Cleanup
          this.cleanupRequest(script, callbackName);
          
          // Hide loading
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          // Remove from active requests
          this.activeRequests.delete(requestId);
          
          // Clear timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          // Handle response
          if (response && response.success !== undefined) {
            // Cache successful responses
            if (useCache && response.success) {
              this.cache.set(cacheKey, response);
            }
            resolve(response);
          } else {
            // Handle malformed response
            const error = new Error('Invalid API response format');
            error.response = response;
            reject(error);
          }
        };
        
        // Set up error handling
        script.onerror = (error) => {
          console.error('API Script Loading Error:', error);
          this.cleanupRequest(script, callbackName);
          
          if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
          }
          
          this.activeRequests.delete(requestId);
          
          // Clear timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          reject(new Error(`Network error: Failed to load script from ${url.toString()}`));
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          if (this.activeRequests.has(requestId)) {
            console.error('Request timeout for:', { action, url: url.toString() });
            this.cleanupRequest(script, callbackName);
            this.activeRequests.delete(requestId);
            reject(new Error(`Request timeout after ${timeout}ms for action: ${action}`));
          }
        }, timeout);
        
        // Store request info
        this.activeRequests.set(requestId, { script, callbackName, timeoutId });
        
        // Load script
        script.src = url.toString();
        script.async = true;
        script.defer = true;
        
        // Add error event listener
        script.addEventListener('error', (e) => {
          console.error('Script element error event:', e);
        });
        
        document.head.appendChild(script);
        
        // Log script addition
        console.log('Script element added to DOM:', script.src);
        
      });
      
    } catch (error) {
      // Hide loading on error
      if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
      }
      
      console.error('API Request Setup Error:', error);
      throw error;
    }
  }

  // Cleanup request resources
  cleanupRequest(script, callbackName) {
    // Remove script element
    if (script && script.parentNode) {
      try {
        script.parentNode.removeChild(script);
      } catch (e) {
        console.warn('Error removing script element:', e);
      }
    }
    
    // Remove callback from window
    if (window[callbackName]) {
      try {
        delete window[callbackName];
      } catch (e) {
        console.warn('Error deleting callback:', e);
      }
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

// Add a global error handler for unhandled JSONP errors
window.addEventListener('error', function(e) {
  if (e.filename && e.filename.includes('script.google.com')) {
    console.error('Global error handler caught JSONP error:', e);
  }
});

// Test the API connection on load
document.addEventListener('DOMContentLoaded', function() {
  console.log('API Service initialized with URL:', window.apiService.BASE_URL);
  
  // Test the connection
  setTimeout(() => {
    console.log('Testing API connection...');
    
    // Quick test function
    function testApiConnection() {
      const testUrl = window.apiService.BASE_URL + '?action=test_connection&callback=testCallback&_=' + Date.now();
      
      window.testCallback = function(response) {
        console.log('✅ Direct API test successful:', response);
        delete window.testCallback;
      };
      
      const script = document.createElement('script');
      script.src = testUrl;
      script.onerror = function(e) {
        console.error('❌ Direct API test failed:', e);
      };
      document.head.appendChild(script);
    }
    
    testApiConnection();
  }, 1000);
});
