// Admin-side chrome — separate from the public chrome.js so we can show a
// different banner, side nav and the signed-in admin's name. Used by every
// page under /admin/.

(function () {
  const officialBanner = `
    <div class="govbb-official-banner">
      <div class="govbb-width-container govbb-official-banner__inner">
        <div class="govbb-official-banner__crest">
          <img class="govbb-official-banner__icon" src="/assets/images/govbb-crest.svg" alt="" />
        </div>
        <div class="govbb-official-banner__text">
          <span>Official government website</span>
        </div>
      </div>
    </div>`;

  // Yellow government bar + admin label
  const header = `
    <header class="govbb-header" data-govbb-module="header">
      <div class="govbb-width-container govbb-header__inner">
        <a class="govbb-header__home" href="/admin/" aria-label="Job Letters admin — home">
          <img class="govbb-header__logo" src="/assets/images/govbb-logo.svg" alt="Government of Barbados" />
        </a>
        <span class="govbb-text-h4">Job letters · Admin</span>
      </div>
    </header>`;

  // Distinctive blue admin bar so it's obvious you're not on the public side
  const adminBar = `
    <div style="background:#00267f;color:#fff;">
      <div class="govbb-width-container" style="padding-block: var(--govbb-space-s); display:flex; align-items:center; gap:var(--govbb-space-m); flex-wrap:wrap;">
        <strong style="font-size:0.9rem;letter-spacing:0.04em;text-transform:uppercase;">Admin console</strong>
        <nav style="display:flex;gap:var(--govbb-space-m);align-items:center;font-size:0.95rem;">
          <a href="/admin/" style="color:#fff;text-decoration:none;" data-nav="dashboard">Dashboard</a>
          <a href="/admin/letters.html" style="color:#fff;text-decoration:none;" data-nav="letters">Letters</a>
          <a href="/admin/employees.html" style="color:#fff;text-decoration:none;" data-nav="employees">Employees</a>
          <a href="/admin/admins.html" style="color:#fff;text-decoration:none;" data-nav="admins">Admins</a>
          <a href="/admin/settings.html" style="color:#fff;text-decoration:none;" data-nav="settings">Settings</a>
        </nav>
        <div style="margin-left:auto; display:flex; align-items:center; gap:var(--govbb-space-s); font-size:0.85rem;">
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
      <div class="govbb-width-container govbb-footer__inner">
        <nav class="govbb-footer__nav" aria-label="Footer navigation">
          <ul class="govbb-footer__list">
            <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="/admin/">Admin home</a></li>
            <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="/">Public service</a></li>
            <li class="govbb-footer__item"><a class="govbb-link govbb-footer__link" href="https://github.com/govtech-bb/Get-a-job-letter-from-the-Ministry-of-Education" rel="noopener">View source</a></li>
          </ul>
        </nav>
        <hr class="govbb-footer__divider" aria-hidden="true" />
        <div class="govbb-footer__end">
          <img class="govbb-footer__coat" src="/assets/images/govbb-crest.svg" alt="" />
          <p class="govbb-footer__copy">
            Built by GovTech Barbados with the Ministry of Education Transformation.
          </p>
        </div>
      </div>
    </footer>`;

  const skipLink = `<a class="govbb-skip-link" href="#main-content">Skip to main content</a>`;

  function render() {
    const body = document.body;
    const main = document.getElementById("main-content");
    if (!main) return;
    // Without this the skip link scrolls but leaves focus on the link itself.
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    // govbb-main-wrapper owns the vertical padding the old .page-main used to
    // supply. The public pages get it in their markup; admin's <main> is here.
    main.classList.add("govbb-main-wrapper");
    main.classList.remove("page-main");

    // Wrap children, preserving identity
    // The admin console is a wide data view, so it uses the width container
    // without the two-thirds column the public pages take.
    if (!main.querySelector(":scope > .govbb-width-container")) {
      const container = document.createElement("div");
      container.className = "govbb-width-container";
      const column = document.createElement("div");
      column.className = "stack-lg";
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

  // The header is a progressive-enhancement component (data-govbb-module),
  // so initAll() has to run after this script has injected it. Dynamic import
  // because this file is a classic script, not a module.
  function enhance() {
    render();
    import("/assets/govbb/index.js")
      .then(({ initAll }) => initAll())
      .catch((err) => console.error("govbb runtime failed to load", err));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }
})();
