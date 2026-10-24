/**
 * EconomicsPortal — Configuration
 * 
 * Google Apps Script Web App Endpoint
 */
export const API_URL = "https://script.google.com/macros/s/AKfycbwhnUI96IN3yYP9kx53SyfzEgjLHLjKpe_gqPet97Tm0XocvBbbqvDBW5tHOxm8udx8/exec";

// Helper to determine if we are in demo/fallback mode
export const isDemoMode = () => {
  return (
    !API_URL ||
    API_URL.includes("PASTE_YOUR_APPS_SCRIPT_URL_HERE") ||
    localStorage.getItem("economics_portal_force_demo") === "true"
  );
};
