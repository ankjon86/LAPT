// api.js - Consolidated API functions

// Application Management APIs
class ApplicationAPI {
  // Get all applications by status
  static getApplicationsByStatus(status) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        [`get${status.charAt(0).toUpperCase() + status.slice(1)}Applications`]();
    });
  }

  // Get application details
  static getApplicationDetails(appNumber, userName) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getApplicationDetails(appNumber, userName);
    });
  }

  // Save application (draft or submit)
  static saveApplication(appNumber, formData, userName, isDraft = false) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .saveProcessApplicationForm(appNumber, formData, userName, isDraft);
    });
  }

  // Get application counts
  static getApplicationCounts() {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getAllApplicationCounts();
    });
  }

  // Get new application context
  static getNewApplicationContext() {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getNewApplicationContext();
    });
  }
}

// User Management APIs
class UserAPI {
  // Authenticate user
  static authenticateUser(name) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .authenticateUser(name);
    });
  }

  // Get all users
  static getAllUsers() {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getAllUsers();
    });
  }

  // Add user
  static addUser(userData) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .addUser(userData);
    });
  }

  // Delete user
  static deleteUser(userName) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .deleteUser(userName);
    });
  }

  // Get applications count for user
  static getApplicationsCountForUser(userName) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getApplicationsCountForUser(userName);
    });
  }
}

// Utility APIs
class UtilityAPI {
  // Copy lending template
  static copyLendingTemplate(appNumber, folderId) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .copyLendingTemplate(appNumber, folderId);
    });
  }

  // Save application draft
  static saveApplicationDraft(appObj, userName) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .saveApplicationDraft(appObj, userName);
    });
  }

  // Submit application
  static submitApplication(appObj, userName) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .submitApplication(appObj, userName);
    });
  }
}

// Export APIs
window.ApplicationAPI = ApplicationAPI;
window.UserAPI = UserAPI;
window.UtilityAPI = UtilityAPI;
