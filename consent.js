/* Preferencias locales: no se cargan herramientas de analítica ni publicidad. */
(() => {
  "use strict";
  const consentKey = "romelia-consent-v1";
  const categoryKey = "romelia-categoria-v1";
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById("cookie-banner");
  const dialog = document.getElementById("cookie-dialog");
  const personalization = document.getElementById("cookie-personalization");
  const categories = new Set([...document.querySelectorAll("[data-filter]")].map(button => button.dataset.filter));

  function parseConsent(raw) {
    try {
      const value = JSON.parse(raw);
      if (value?.version !== 1 || value.necessary !== true || typeof value.personalization !== "boolean") return null;
      if (!Number.isFinite(value.savedAt) || value.savedAt > Date.now() + 60000 || Date.now() - value.savedAt >= lifetime) return null;
      return value;
    } catch { return null; }
  }

  function readConsent() {
    const choices = [];
    try {
      const cookie = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${consentKey}=`));
      if (cookie) choices.push(parseConsent(decodeURIComponent(cookie.slice(consentKey.length + 1))));
    } catch { /* El navegador puede restringir cookies. */ }
    try { choices.push(parseConsent(localStorage.getItem(consentKey))); } catch { /* Solo memoria. */ }
    return choices.filter(Boolean).sort((a, b) => b.savedAt - a.savedAt)[0] || null;
  }

  let consent = readConsent();

  function clearCategory() {
    try { localStorage.removeItem(categoryKey); } catch { /* No se requiere almacenamiento opcional. */ }
  }

  function getCategory() {
    if (!consent?.personalization) return "todos";
    try {
      const saved = localStorage.getItem(categoryKey);
      return categories.has(saved) ? saved : "todos";
    } catch { return "todos"; }
  }

  function rememberCategory(category) {
    if (!consent?.personalization || !categories.has(category)) return;
    try { localStorage.setItem(categoryKey, category); } catch { /* La categoría actual sigue funcionando. */ }
  }

  function syncBannerSpace() {
    const space = banner.hidden ? 0 : Math.ceil(banner.getBoundingClientRect().height) + 30;
    document.documentElement.style.setProperty("--cookie-space", `${space}px`);
  }

  function syncInterface() {
    banner.hidden = Boolean(consent);
    personalization.checked = consent?.personalization === true;
    if (!consent?.personalization) clearCategory();
    syncBannerSpace();
  }

  function persistChoice(allowPersonalization) {
    consent = { version: 1, necessary: true, personalization: allowPersonalization === true, savedAt: Date.now() };
    const value = JSON.stringify(consent);
    let persisted = false;
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${consentKey}=${encodeURIComponent(value)}; Max-Age=${lifetime / 1000}; Path=/; SameSite=Lax${secure}`;
      persisted = document.cookie.split(";").some(part => part.trim() === `${consentKey}=${encodeURIComponent(value)}`);
    } catch { /* Se usa almacenamiento local como alternativa. */ }
    try {
      localStorage.setItem(consentKey, value);
      persisted = localStorage.getItem(consentKey) === value || persisted;
    } catch { /* La elección se aplica a esta visita, aunque no se pueda guardar. */ }
    if (dialog.open) dialog.close();
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
    syncInterface();
    if (consent.personalization) {
      const active = document.querySelector("[data-filter].active");
      if (active) rememberCategory(active.dataset.filter);
    }
    window.dispatchEvent(new CustomEvent("romelia:privacy-saved", { detail: { persisted } }));
  }

  function openPreferences() {
    document.querySelectorAll("dialog[open]").forEach(other => { if (other !== dialog) other.close(); });
    personalization.checked = consent?.personalization === true;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
  }

  document.addEventListener("click", event => {
    const action = event.target.closest("[data-cookie-action]")?.dataset.cookieAction;
    if (action === "manage") openPreferences();
    if (action === "all") persistChoice(true);
    if (action === "necessary") persistChoice(false);
  });

  document.getElementById("cookie-form").addEventListener("submit", event => {
    event.preventDefault();
    persistChoice(personalization.checked);
  });
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
  });
  window.addEventListener("storage", event => {
    if (event.key === consentKey || event.key === null) {
      consent = readConsent();
      syncInterface();
    }
  });
  window.addEventListener("resize", syncBannerSpace);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncBannerSpace).observe(banner);
  window.RomeliaPrivacy = Object.freeze({ getCategory, rememberCategory, openPreferences });
  syncInterface();
})();
