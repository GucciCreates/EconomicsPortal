/**
 * EconomicsPortal — Configuration
 * 
 * Google Apps Script Web App Endpoint
 */
export const API_URL = "https://script.google.com/macros/s/AKfycbzOEBiS8iRwbVvoazNAjv6i3FjSGkbBH5E1sPcOS-XCqV2lRw5w2RIfqgy8pzYzBEnk/exec";

// Helper to determine if we are in demo/fallback mode
export const isDemoMode = () => {
  return (
    !API_URL ||
    API_URL.includes("PASTE_YOUR_APPS_SCRIPT_URL_HERE") ||
    localStorage.getItem("economics_portal_force_demo") === "true"
  );
};
