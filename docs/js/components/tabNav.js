/**
 * EconomicsPortal — Tab Navigation Component (v3)
 *
 * Renders a horizontal pill-style tab bar and manages active tab state.
 * Usage:
 *   const tabNav = createTabNav(container, tabs, onTabChange);
 *   tabNav.setActive("tabId");
 */

/**
 * @param {HTMLElement} container - The element to prepend the nav into
 * @param {Array<{id:string, label:string, icon?:string}>} tabs
 * @param {Function} onTabChange - callback(tabId)
 * @returns {{ setActive: (id: string) => void }}
 */
export function createTabNav(container, tabs, onTabChange) {
  const navEl = document.createElement("nav");
  navEl.className = "tab-nav";
  navEl.setAttribute("role", "tablist");

  navEl.innerHTML = tabs
    .map(
      (t) => `
    <button
      class="tab-btn"
      role="tab"
      data-tab="${t.id}"
      aria-selected="false"
    >
      ${t.icon ? `<span class="tab-icon">${t.icon}</span>` : ""}
      <span>${t.label}</span>
    </button>
  `
    )
    .join("");

  container.prepend(navEl);

  navEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-tab");
      setActive(id);
      onTabChange(id);
    });
  });

  function setActive(id) {
    navEl.querySelectorAll(".tab-btn").forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  // Activate first tab by default
  if (tabs.length > 0) setActive(tabs[0].id);

  return { setActive };
}
