// Admin-side chrome — separate from the public chrome.js so we can show a
// different banner, side nav and the signed-in admin's name. Used by every
// page under /admin/.

(function () {
  const officialBanner = `
    <div class="govbb-official-banner">
      <div class="govbb-container">
        <div class="govbb-official-banner__inner">
          <span class="govbb-official-banner__crest">
            <img class="govbb-official-banner__icon" src="/assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
          </span>
          <div class="govbb-official-banner__text">
            <span>An official service of the Government of Barbados</span>
          </div>
        </div>
      </div>
    </div>`;

  // Yellow government bar + admin label
  const header = `
    <header class="govbb-header">
      <div class="govbb-container">
        <div class="govbb-header__inner">
          <a href="/admin/" aria-label="Job Letters admin — home">
            <img class="govbb-header__logo" src="/assets/images/govbb-logo.svg" alt="Government of Barbados" />
          </a>
          <span class="govbb-text-h4">Job letters · Admin</span>
        </div>
      </div>
    </header>`;

  // Distinctive blue admin bar so it's obvious you're not on the public side
  const adminBar = `
    <div style="background:#00267f;color:#fff;">
      <div class="govbb-container" style="padding-block: var(--spacing-s); display:flex; align-items:center; gap:var(--spacing-m); flex-wrap:wrap;">
        <strong style="font-size:0.9rem;letter-spacing:0.04em;text-transform:uppercase;">Admin console</strong>
        <nav style="display:flex;gap:var(--spacing-m);align-items:center;font-size:0.95rem;">
          <a href="/admin/" style="color:#fff;text-decoration:none;" data-nav="dashboard">Dashboard</a>
          <a href="/admin/letters.html" style="color:#fff;text-decoration:none;" data-nav="letters">Letters</a>
          <a href="/admin/employees.html" style="color:#fff;text-decoration:none;" data-nav="employees">Employees</a>
          <a href="/admin/admins.html" style="color:#fff;text-decoration:none;" data-nav="admins">Admins</a>
          <a href="/admin/settings.html" style="color:#fff;text-decoration:none;" data-nav="settings">Settings</a>
        </nav>
        <div style="margin-left:auto; display:flex; align-items:center; gap:var(--spacing-s); font-size:0.85rem;">
          <span id="admin-whoami" style="color:#cfd8e9;"></span>
          <button id="admin-signout" type="button"
            style="background:transparent;border:1px solid rgba(255,255,255,0.5);color:#fff;padding:4px 10px;border-radius:4px;font:inherit;font-size:0.85rem;cursor:pointer;">
            Sign out
          </button>
        </div>
      </div>
    </div>`;

  const footer = `
    <footer class="govbb-footer">
      <div class="govbb-container">
        <div class="govbb-footer__inner">
          <nav class="govbb-footer__nav" aria-label="Footer">
            <a class="govbb-footer__link" href="/admin/">Admin home</a>
            <a class="govbb-footer__link" href="/">Public service</a>
            <a class="govbb-footer__link" href="https://github.com/govtech-bb/Get-a-job-letter-from-the-Ministry-of-Education" rel="noopener">View source</a>
          </nav>
          <hr class="govbb-footer__divider" />
          <div class="govbb-footer__end">
            <img class="govbb-footer__coat" src="/assets/images/govbb-creast.svg" alt="" aria-hidden="true" />
            <p class="govbb-footer__copy">
              Built by GovTech Barbados with the Ministry of Education Transformation.
            </p>
          </div>
        </div>
      </div>
    </footer>`;

  const skipLink = `<a class="govbb-visually-hidden govbb-visually-hidden-focusable" href="#main-content">Skip to main content</a>`;

  function render() {
    const body = document.body;
    const main = document.getElementById("main-content");
    if (!main) return;

    // Wrap children, preserving identity
    if (!main.querySelector(":scope > .govbb-container")) {
      const container = document.createElement("div");
      container.className = "govbb-container";
      const column = document.createElement("div");
      column.className = "content-column stack-lg";
      column.style.maxWidth = "64rem";
      while (main.firstChild) column.appendChild(main.firstChild);
      container.appendChild(column);
      main.appendChild(container);
    }

    // Skip the admin bar on the login pages (no nav until signed in)
    const isAuthPage = body.dataset.adminAuthPage === "true";
    body.insertAdjacentHTML(
      "afterbegin",
      `<div>` + skipLink + officialBanner + header + (isAuthPage ? "" : adminBar) + `</div>`
    );
    body.insertAdjacentHTML("beforeend", footer);

    if (!isAuthPage) {
      attachAdminBarHandlers();
    }
  }

  function attachAdminBarHandlers() {
    // Highlight current section
    const path = location.pathname;
    document.querySelectorAll("[data-nav]").forEach(a => {
      const key = a.dataset.nav;
      const match =
        (key === "dashboard" && (path === "/admin/" || path === "/admin/index.html" || path === "/admin")) ||
        (key === "letters" && path.includes("/admin/letters")) ||
        (key === "employees" && path.includes("/admin/employees")) ||
        (key === "admins" && path.includes("/admin/admins")) ||
        (key === "settings" && path.includes("/admin/settings"));
      if (match) {
        a.style.borderBottom = "2px solid #ffc726";
        a.style.paddingBottom = "2px";
        a.style.fontWeight = "bold";
      }
    });

    // Fetch the current admin to label the bar; redirect to /admin/login if 401.
    fetch("/api/admin/me", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(me => {
        const el = document.getElementById("admin-whoami");
        if (el) el.textContent = me.name + " · " + me.email;
      })
      .catch(() => {
        location.href = "/admin/login.html";
      });

    const signOut = document.getElementById("admin-signout");
    if (signOut) {
      signOut.addEventListener("click", async () => {
        await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
        location.href = "/admin/login.html";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
