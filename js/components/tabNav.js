/**
 * EconomicsPortal — Tab Navigation Component
 *
 * Renders a horizontal tab bar (text tabs on a ruled line) and manages
 * active tab state.
 * Keyboard: Left/Right/Home/End move between tabs (WAI-ARIA tabs pattern).
 *
 *   const tabNav = createTabNav(container, tabs, onTabChange);
 *   tabNav.setActive("tabId");
 *   tabNav.setBadge("tabId", 3);   // shows "3 new"; 0 hides it
 */

import { esc } from "../utils.js";

/**
 * @param {HTMLElement} container - The element to prepend the nav into
 * @param {Array<{id:string, label:string, count?:number, icon?:string, badge?:number}>} tabs
 * @param {Function} onTabChange - callback(tabId)
 * @param {{ storageKey?: string }} [options] - remember the open tab across
 *   dashboard refreshes (sessionStorage) so actions don't jump back to tab 1
 */
export function createTabNav(container, tabs, onTabChange, options = {}) {
  const navEl = document.createElement("nav");
  navEl.className = "tab-nav";
  navEl.setAttribute("role", "tablist");
  navEl.setAttribute("aria-label", "Dashboard sections");

  navEl.innerHTML = tabs
    .map(
      (t) => `
    <button
      type="button"
      class="tab-btn"
      role="tab"
      id="tab-${esc(t.id)}"
      data-tab="${esc(t.id)}"
      aria-selected="false"
      tabindex="-1"
    >
      ${t.icon ? `<span class="tab-icon" aria-hidden="true">${esc(t.icon)}</span>` : ""}
      <span>${esc(t.label)}</span>
      ${t.count !== undefined && t.count !== null ? `<span class="tab-count">${esc(t.count)}</span>` : ""}
      <span class="tab-badge" data-badge-for="${esc(t.id)}" hidden></span>
    </button>
  `
    )
    .join("");

  container.prepend(navEl);
  const buttons = () => [...navEl.querySelectorAll(".tab-btn")];

  function activate(btn) {
    const id = btn.getAttribute("data-tab");
    setActive(id);
    onTabChange(id);
    try {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } catch (e) {}
  }

  buttons().forEach((btn) => btn.addEventListener("click", () => activate(btn)));

  navEl.addEventListener("keydown", (e) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement);
    if (i === -1) return;
    let next = null;
    if (e.key === "ArrowRight") next = all[(i + 1) % all.length];
    else if (e.key === "ArrowLeft") next = all[(i - 1 + all.length) % all.length];
    else if (e.key === "Home") next = all[0];
    else if (e.key === "End") next = all[all.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
    activate(next);
  });

  function setActive(id) {
    if (options.storageKey) {
      try {
        sessionStorage.setItem(options.storageKey, id);
      } catch (e) {}
    }
    buttons().forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
  }

  function setBadge(id, count) {
    const el = navEl.querySelector(`[data-badge-for="${CSS.escape(id)}"]`);
    if (!el) return;
    const n = Number(count) || 0;
    el.hidden = n <= 0;
    el.textContent = n > 0 ? `${n} new` : "";
  }

  let initialTab = tabs.length ? tabs[0].id : null;
  if (options.storageKey) {
    try {
      const saved = sessionStorage.getItem(options.storageKey);
      if (tabs.some((t) => t.id === saved)) initialTab = saved;
    } catch (e) {}
  }
  if (initialTab) setActive(initialTab);
  tabs.forEach((t) => t.badge && setBadge(t.id, t.badge));

  return { setActive, setBadge, initialTab };
}
