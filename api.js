// api.js - Modern API client with error handling

const API_BASE_URL = ScriptApp.getService().getUrl();

class ApiClient {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}?api=true&action=${endpoint}`;
        
        const config = {
            method: options.method || 'GET',
            headers: this.headers,
            muteHttpExceptions: true
        };

        if (options.body) {
            config.payload = JSON.stringify(options.body);
        }

        if (options.params) {
            const params = new URLSearchParams(options.params).toString();
            url = `${url}&${params}`;
        }

        try {
            const response = await new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .doPost({
                        parameter: {
                            api: config.method,
                            action: endpoint,
                            ...options.params
                        },
                        postData: options.body ? {
                            contents: JSON.stringify(options.body),
                            type: 'application/json'
                        } : null
                    });
            });

            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    handleResponse(response) {
        if (typeof response === 'string') {
            try {
                response = JSON.parse(response);
            } catch (e) {
                return {
                    success: false,
                    message: 'Invalid JSON response',
                    error: e.message
                };
            }
        }

        return response;
    }

    handleError(error) {
        console.error('API Error:', error);
        return {
            success: false,
            message: error.message || 'Network error',
            error: error
        };
    }

    // Auth API
    async login(name) {
        return this.request('auth/login', {
            method: 'POST',
            body: { name }
        });
    }

    async verifyUser(name) {
        return this.request('auth/verify', {
            method: 'POST',
            body: { name }
        });
    }

    // Applications API
    async getApplications(status) {
        return this.request(`applications?status=${status}`);
    }

    async getApplicationDetails(appNumber, userName) {
        return this.request(`applications/details`, {
            params: { appNumber, userName }
        });
    }

    async getApplicationCounts() {
        return this.request('applications/count');
    }

    async getNewApplicationContext() {
        return this.request('applications/context');
    }

    async saveApplication(appNumber, formData, userName, isDraft = false) {
        return this.request('applications/save', {
            method: 'POST',
            body: { appNumber, formData, userName, isDraft }
        });
    }

    async submitApplication(appData, userName) {
        return this.request('applications/submit', {
            method: 'POST',
            body: { ...appData, userName }
        });
    }

    async updateApplicationStatus(appNumber, status, comments, userName) {
        return this.request('applications/status', {
            method: 'PUT',
            body: { appNumber, status, comments, userName }
        });
    }

    // Users API
    async getAllUsers() {
        return this.request('users');
    }

    async addUser(userData) {
        return this.request('users/add', {
            method: 'POST',
            body: userData
        });
    }

    async deleteUser(userName) {
        return this.request(`users/${userName}`, {
            method: 'DELETE'
        });
    }

    // Workflow API
    async getWorkflowHistory(appNumber) {
        return this.request(`workflow/history?appNumber=${appNumber}`);
    }

    async processWorkflowAction(appNumber, action, comments, userName) {
        return this.request('workflow/action', {
            method: 'POST',
            body: { appNumber, action, comments, userName }
        });
    }

    // Files API
    async getLendingTemplate(appNumber, folderId) {
        return this.request(`files/template?appNumber=${appNumber}&folderId=${folderId}`);
    }

    async uploadFile(appNumber, fileType, fileData, fileName) {
        return this.request('files/upload', {
            method: 'POST',
            body: { appNumber, fileType, fileData, fileName }
        });
    }

    // Test API
    async testConnection() {
        return this.request('');
    }
}

// Create global API instance
window.api = new ApiClient();

// Legacy compatibility functions
window.ApplicationAPI = {
    getApplicationsByStatus: async (status) => {
        const api = new ApiClient();
        return api.getApplications(status);
    },

    getApplicationDetails: async (appNumber, userName) => {
        const api = new ApiClient();
        return api.getApplicationDetails(appNumber, userName);
    },

    saveApplication: async (appNumber, formData, userName, isDraft = false) => {
        const api = new ApiClient();
        return api.saveApplication(appNumber, formData, userName, isDraft);
    },

    getApplicationCounts: async () => {
        const api = new ApiClient();
        return api.getApplicationCounts();
    },

    getNewApplicationContext: async () => {
        const api = new ApiClient();
        return api.getNewApplicationContext();
    }
};

window.UserAPI = {
    authenticateUser: async (name) => {
        const api = new ApiClient();
        return api.login(name);
    },

    getAllUsers: async () => {
        const api = new ApiClient();
        return api.getAllUsers();
    },

    addUser: async (userData) => {
        const api = new ApiClient();
        return api.addUser(userData);
    },

    deleteUser: async (userName) => {
        const api = new ApiClient();
        return api.deleteUser(userName);
    },

    getApplicationsCountForUser: async (userName) => {
        const api = new ApiClient();
        const result = await api.request('applications/count/user', {
            params: { user: userName }
        });
        return result.count || 0;
    }
};

window.UtilityAPI = {
    copyLendingTemplate: async (appNumber, folderId) => {
        const api = new ApiClient();
        return api.getLendingTemplate(appNumber, folderId);
    },

    saveApplicationDraft: async (appObj, userName) => {
        const api = new ApiClient();
        return api.saveApplication(appObj.appNumber, appObj, userName, true);
    },

    submitApplication: async (appObj, userName) => {
        const api = new ApiClient();
        return api.submitApplication(appObj, userName);
    }
};

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = { ApiClient };
}
