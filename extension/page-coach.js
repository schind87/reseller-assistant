/* global RA_COACH_STEPS, RA_PAGE_SIDEBAR_WIDTH, raIsListingEditUrl,
   raFillExtensionBuildLabel */

(function initPageCoach() {
  const HOST_ID = "reseller-assistant-page-coach";
  const SPACE_STYLE_ID = "reseller-assistant-page-coach-space";
  const SPACE_CLASS = "ra-reseller-assistant-has-sidebar";
  const SIDEBAR_WIDTH =
    typeof RA_PAGE_SIDEBAR_WIDTH === "number" ? RA_PAGE_SIDEBAR_WIDTH : 340;
  if (document.getElementById(HOST_ID)) return;

  let state = null;
  let busy = false;
  let lastHref = location.href;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("role", "complementary");
  host.setAttribute("aria-label", "Reseller Assistant listing helper");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483646";
  host.style.top = "0";
  host.style.right = "0";
  host.style.bottom = "0";
  host.style.setProperty("width", `${SIDEBAR_WIDTH}px`, "important");
  host.style.setProperty("height", "100vh", "important");
  host.style.overflow = "hidden";
  host.style.fontFamily =
    '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
  document.documentElement.appendChild(host);

  function onListingEditPage() {
    return typeof raIsListingEditUrl === "function"
      ? raIsListingEditUrl(location.href)
      : false;
  }

  function applyPageSpace(show) {
    const html = document.documentElement;
    const body = document.body;
    let style = document.getElementById(SPACE_STYLE_ID);
    if (!show) {
      html.classList.remove(SPACE_CLASS);
      if (body) body.classList.remove(SPACE_CLASS);
      html.style.removeProperty("--ra-sidebar-width");
      if (style) style.remove();
      return;
    }

    html.classList.add(SPACE_CLASS);
    html.style.setProperty("--ra-sidebar-width", `${SIDEBAR_WIDTH}px`);
    if (body) body.classList.add(SPACE_CLASS);
    if (!style) {
      style = document.createElement("style");
      style.id = SPACE_STYLE_ID;
      html.appendChild(style);
    }
    // Shrink the page column so the helper sits beside it, not over it.
    // Do not transform/filter body: that makes it the containing block for
    // position:fixed, so Poshmark photo crop overlays center in the document
    // instead of the viewport the seller is looking at.
    style.textContent = `
      html.${SPACE_CLASS} {
        box-sizing: border-box !important;
        overflow-x: auto !important;
      }
      html.${SPACE_CLASS} body.${SPACE_CLASS} {
        box-sizing: border-box !important;
        width: calc(100vw - ${SIDEBAR_WIDTH}px) !important;
        max-width: calc(100vw - ${SIDEBAR_WIDTH}px) !important;
        margin-right: 0 !important;
        min-height: 100vh;
      }
    `;
  }

  function syncSidebarVisibility() {
    const show = onListingEditPage();
    host.hidden = !show;
    host.style.display = show ? "block" : "none";
    applyPageSpace(show);
    return show;
  }

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { display: block; width: 100%; height: 100%; }
      * { box-sizing: border-box; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
      .panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100vh;
        background: #f7f4ef;
        color: #1a1a1a;
        border-left: 2px solid #1f5c4a;
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: #1f5c4a;
        color: #fff;
        padding: 14px 16px;
        flex-shrink: 0;
      }
      .head strong { font-size: 16px; }
      .body {
        padding: 16px;
        display: grid;
        gap: 10px;
        align-content: start;
        flex: 1;
        overflow: auto;
      }
      .step {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #1f5c4a;
      }
      .title { font-size: 22px; font-weight: 750; line-height: 1.2; margin: 0; }
      .help { margin: 0; font-size: 15px; color: #4a4a4a; line-height: 1.4; }
      .preview {
        background: #fff;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        color: #243;
        max-height: 88px;
        overflow: auto;
      }
      .bar {
        height: 8px;
        background: #e6f0ec;
        border-radius: 999px;
        overflow: hidden;
      }
      .bar > span {
        display: block;
        height: 100%;
        background: #1f5c4a;
        width: 0%;
        transition: width 0.2s ease;
      }
      .actions { display: grid; gap: 8px; }
      .btn {
        border: 0;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 17px;
        font-weight: 750;
        cursor: pointer;
      }
      .btn:disabled { opacity: 0.55; cursor: wait; }
      .btn-primary { background: #1f5c4a; color: #fff; }
      .btn-secondary {
        background: #fff;
        color: #1f5c4a;
        border: 2px solid #1f5c4a;
      }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .btn-link {
        background: transparent;
        color: #1f5c4a;
        border: 0;
        padding: 4px 0;
        font-size: 14px;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
        text-align: left;
      }
      .status {
        min-height: 1.3em;
        font-size: 14px;
        color: #4a4a4a;
      }
      .status.ok { color: #1f5c4a; font-weight: 650; }
      .status.err { color: #8b1e1e; font-weight: 650; }
      .note {
        font-size: 12px;
        color: #666;
        margin: 0;
      }
      .foot {
        flex-shrink: 0;
        padding: 8px 16px 10px;
        background: #f7f4ef;
      }
      .build-label {
        margin: 0;
        color: #9a948a;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.02em;
        line-height: 1.2;
        user-select: all;
      }
    </style>
    <div class="panel" id="panel">
      <div class="head">
        <strong>Reseller Assistant</strong>
      </div>
      <div class="body">
        <div class="step" id="step-label">Connecting…</div>
        <div class="bar"><span id="progress"></span></div>
        <h2 class="title" id="title">Listing helper</h2>
        <p class="help" id="help">Getting ready…</p>
        <div class="preview" id="preview"></div>
        <div class="actions">
          <button class="btn btn-primary" type="button" id="do-step">Fill this field</button>
          <button class="btn-link" type="button" id="tweak">Tweak listing fields…</button>
          <div class="row">
            <button class="btn btn-secondary" type="button" id="prev">Back</button>
            <button class="btn btn-secondary" type="button" id="next">Next step</button>
          </div>
        </div>
        <p class="status" id="status" role="status"></p>
        <p class="note">This helper never presses List or Publish for you.</p>
      </div>
      <div class="foot">
        <p class="build-label" id="build-label"></p>
      </div>
    </div>
  `;

  const ui = {
    progress: shadow.getElementById("progress"),
    stepLabel: shadow.getElementById("step-label"),
    title: shadow.getElementById("title"),
    help: shadow.getElementById("help"),
    preview: shadow.getElementById("preview"),
    doStep: shadow.getElementById("do-step"),
    tweak: shadow.getElementById("tweak"),
    prev: shadow.getElementById("prev"),
    next: shadow.getElementById("next"),
    status: shadow.getElementById("status"),
  };

  if (typeof raFillExtensionBuildLabel === "function") {
    raFillExtensionBuildLabel(shadow.getElementById("build-label"));
  }

  function setBusy(next) {
    busy = next;
    ui.doStep.disabled = busy;
    ui.tweak.disabled = busy;
    ui.prev.disabled = busy;
    ui.next.disabled = busy;
  }

  function render() {
    if (!syncSidebarVisibility()) return;
    if (!state) {
      ui.stepLabel.textContent = "Connecting…";
      ui.title.textContent = "Listing helper";
      ui.help.textContent = "Connecting…";
      ui.preview.textContent = "";
      ui.doStep.textContent = "Fill this field";
      ui.status.textContent = "";
      return;
    }

    if (!state.paired) {
      ui.stepLabel.textContent = "Not connected";
      ui.title.textContent = "Connect your listing";
      ui.help.textContent =
        state.message ||
        "Open your listing in Reseller Assistant, then return to this page.";
      ui.preview.textContent = "";
      ui.doStep.textContent = "Check connection";
      ui.progress.style.width = "0%";
      ui.status.textContent = "";
      ui.status.className = "status";
      return;
    }

    const steps = state.steps || RA_COACH_STEPS || [];
    const index = state.stepIndex || 0;
    const step = state.step || steps[index] || {};
    const total = steps.length || 1;
    ui.stepLabel.textContent = `Step ${index + 1} of ${total}`;
    ui.title.textContent = step.label || "Step";
    ui.help.textContent = step.help || "";
    ui.preview.textContent = state.preview || state.listingTitle || "";
    ui.doStep.textContent = step.actionLabel || "Fill this field";
    ui.progress.style.width = `${Math.round(((index + 1) / total) * 100)}%`;

    if (state.message) {
      ui.status.textContent = state.message;
      ui.status.className = "status " + (state.error ? "err" : "ok");
    } else {
      ui.status.textContent = "";
      ui.status.className = "status";
    }

    ui.prev.disabled = busy || index <= 0;
    ui.next.disabled = busy || index >= total - 1;
    ui.tweak.disabled = busy;
    ui.doStep.disabled = busy || step.key === "review";
    if (step.key === "review") {
      ui.doStep.textContent = "Review on the page";
    }
  }

  async function refresh() {
    try {
      const next = await chrome.runtime.sendMessage({ type: "coachGetState" });
      state = next;
      render();
    } catch (error) {
      state = {
        paired: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not reach the extension. Reload it, then refresh this page.",
        error: true,
      };
      render();
    }
  }

  async function run(type) {
    if (busy) return;
    setBusy(true);
    ui.status.textContent = "Working…";
    ui.status.className = "status";
    try {
      const next = await chrome.runtime.sendMessage({ type });
      state = next;
      render();
    } catch (error) {
      ui.status.textContent =
        error instanceof Error ? error.message : "Couldn’t complete that step.";
      ui.status.className = "status err";
    } finally {
      setBusy(false);
      render();
    }
  }

  ui.doStep.addEventListener("click", () => {
    if (!state?.paired) {
      void run("coachGetState").then(() => refresh());
      return;
    }
    if (state.step?.key === "review") {
      ui.status.textContent =
        "Scroll the form, then press List / Publish.";
      ui.status.className = "status ok";
      return;
    }
    void run("coachDoStep");
  });
  ui.next.addEventListener("click", () => void run("coachNext"));
  ui.prev.addEventListener("click", () => void run("coachPrev"));
  ui.tweak.addEventListener("click", () => {
    if (!state?.paired) {
      ui.status.textContent = "Connect a listing first.";
      ui.status.className = "status err";
      return;
    }
    void run("openTweakListing");
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "coachStateUpdated" && message.state) {
      state = message.state;
      render();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.listingId || changes.listingCache || changes.token) {
      void refresh();
    }
  });

  window.addEventListener("popstate", () => {
    onLocationMaybeChanged();
  });

  function onLocationMaybeChanged() {
    const show = onListingEditPage();
    syncSidebarVisibility();
    if (!show) return;
    void refresh();
  }

  // Mercari/Poshmark are SPAs — poll href so the sidebar hides after leaving sell/edit.
  window.setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    onLocationMaybeChanged();
  }, 400);

  syncSidebarVisibility();
  if (onListingEditPage()) {
    void refresh();
  }
})();
