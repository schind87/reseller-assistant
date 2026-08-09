/* global RA_COACH_STEPS */

(function initPageCoach() {
  const HOST_ID = "reseller-assistant-page-coach";
  if (document.getElementById(HOST_ID)) return;

  let state = null;
  let busy = false;
  let minimized = false;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483646";
  host.style.right = "16px";
  host.style.bottom = "16px";
  host.style.width = "min(360px, calc(100vw - 24px))";
  host.style.fontFamily =
    '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
      .panel {
        background: #fff;
        color: #1a1a1a;
        border: 2px solid #1f5c4a;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.22);
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: #1f5c4a;
        color: #fff;
        padding: 12px 14px;
      }
      .head strong { font-size: 16px; }
      .head button {
        border: 0;
        background: rgba(255,255,255,0.18);
        color: #fff;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .body { padding: 14px; display: grid; gap: 10px; }
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
        background: #f4f7f5;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        color: #243;
        max-height: 72px;
        overflow: hidden;
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
      .mini {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: #1f5c4a;
        color: #fff;
        border-radius: 999px;
        padding: 12px 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        cursor: pointer;
        border: 0;
        width: 100%;
        font-size: 15px;
        font-weight: 700;
      }
      :host(.collapsed) .panel { display: none; }
      :host(.collapsed) .mini { display: flex; }
    </style>
    <button class="mini" type="button" id="expand">
      <span>Reseller Assistant</span>
      <span id="mini-step">Open helper</span>
    </button>
    <div class="panel" id="panel">
      <div class="head">
        <strong>Reseller Assistant</strong>
        <button type="button" id="minimize" aria-label="Minimize">Hide</button>
      </div>
      <div class="body">
        <div class="step" id="step-label">Connecting…</div>
        <div class="bar"><span id="progress"></span></div>
        <h2 class="title" id="title">Listing helper</h2>
        <p class="help" id="help">Getting ready…</p>
        <div class="preview" id="preview"></div>
        <div class="actions">
          <button class="btn btn-primary" type="button" id="do-step">Do this for me</button>
          <button class="btn-link" type="button" id="tweak">Tweak listing fields…</button>
          <div class="row">
            <button class="btn btn-secondary" type="button" id="prev">Back</button>
            <button class="btn btn-secondary" type="button" id="next">Next step</button>
          </div>
        </div>
        <p class="status" id="status" role="status"></p>
        <p class="note">This helper never presses List or Publish for you.</p>
      </div>
    </div>
  `;

  const ui = {
    root: shadow.getElementById("panel").parentNode || shadow,
    panelWrap: host,
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
    minimize: shadow.getElementById("minimize"),
    expand: shadow.getElementById("expand"),
    miniStep: shadow.getElementById("mini-step"),
  };

  function setBusy(next) {
    busy = next;
    ui.doStep.disabled = busy;
    ui.tweak.disabled = busy;
    ui.prev.disabled = busy;
    ui.next.disabled = busy;
  }

  function render() {
    host.classList.toggle("collapsed", minimized);
    if (!state) {
      ui.stepLabel.textContent = "Connecting…";
      ui.title.textContent = "Listing helper";
      ui.help.textContent = "One moment…";
      ui.preview.textContent = "";
      ui.doStep.textContent = "Do this for me";
      ui.status.textContent = "";
      return;
    }

    if (!state.paired) {
      ui.stepLabel.textContent = "Not connected";
      ui.title.textContent = "Connect your listing";
      ui.help.textContent =
        state.message ||
        "Open your listing’s Post checklist in Reseller Assistant, then return to this page.";
      ui.preview.textContent = "";
      ui.doStep.textContent = "Check connection";
      ui.progress.style.width = "0%";
      ui.miniStep.textContent = "Not connected";
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
    ui.doStep.textContent = step.actionLabel || "Do this for me";
    ui.progress.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
    ui.miniStep.textContent = `${index + 1}/${total}: ${step.label || "Step"}`;

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
        error instanceof Error ? error.message : "Something went wrong.";
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
        "Scroll the form, check the details, then press List yourself.";
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
  ui.minimize.addEventListener("click", () => {
    minimized = true;
    render();
  });
  ui.expand.addEventListener("click", () => {
    minimized = false;
    render();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "coachStateUpdated" && message.state) {
      state = message.state;
      render();
    }
  });

  void refresh();
})();
