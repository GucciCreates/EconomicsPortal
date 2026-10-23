/**
 * EconomicsPortal — Configuration
 * 
 * Google Apps Script Web App Endpoint
 */
export const API_URL = "https://script.google.com/macros/s/AKfycbyertPqD_BRcBp-94ZecGWYQrf_tbLJmBEjXkVckYI/exec";

// Helper to determine if we are in demo/fallback mode
export const isDemoMode = () => {
  return !API_URL || API_URL.includes("PASTE_YOUR_APPS_SCRIPT_URL_HERE");
};
