/**
 * EconomicsPortal — Configuration
 * 
 * Replace PASTE_YOUR_APPS_SCRIPT_URL_HERE with your deployed Google Apps Script Web App URL.
 * See SETUP_GUIDE.md for step-by-step instructions.
 */
export const API_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

// Helper to determine if we are in demo/fallback mode
export const isDemoMode = () => {
  return !API_URL || API_URL.includes("PASTE_YOUR_APPS_SCRIPT_URL_HERE");
};
