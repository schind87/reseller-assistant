import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "extension", "bridge.js"), "utf8");

function loadBridge(chrome) {
  const posted = [];
  const listeners = [];
  const ctx = {
    chrome,
    setTimeout,
    clearTimeout,
    Promise,
    Boolean,
    String,
    Error,
    URL,
    console,
  };
  ctx.globalThis = ctx;
  const window = {
    location: { origin: "http://localhost:3000" },
    addEventListener(type, fn) {
      if (type === "message") listeners.push(fn);
    },
    postMessage(data, origin) {
      posted.push({ data, origin });
    },
  };
  ctx.window = window;
  vm.runInNewContext(src, ctx);
  return { posted, listeners, window };
}

function fireCheckCloset({ listeners, window }, extra = {}) {
  for (const listener of listeners) {
    listener({
      source: window,
      origin: window.location.origin,
      data: {
        source: "reseller-assistant-web",
        type: "check-closet",
        platform: "poshmark",
        username: "barbmarketplace",
        closetUrl: "https://poshmark.com/closet/barbmarketplace",
        ...extra,
      },
    });
  }
}

function closetResults(posted) {
  return posted.filter((entry) => entry.data?.type === "closet-check-result");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ready = loadBridge(undefined);
if (ready.posted.length !== 1 || ready.posted[0].data.type !== "bridge-ready") {
  throw new Error("bridge-ready was not posted on load");
}

fireCheckCloset(ready);
await wait(20);
const missingRuntime = closetResults(ready.posted);
if (missingRuntime.length !== 1) {
  throw new Error(
    `missing runtime: expected 1 closet result, got ${missingRuntime.length}`
  );
}
if (missingRuntime[0].data.ok !== false) {
  throw new Error("missing runtime: expected ok false");
}
if (missingRuntime[0].data.error !== "Could not check closet") {
  throw new Error(
    `missing runtime: unexpected error ${JSON.stringify(missingRuntime[0].data.error)}`
  );
}

const undefinedRuntime = loadBridge({ runtime: undefined });
fireCheckCloset(undefinedRuntime);
await wait(20);
if (closetResults(undefinedRuntime.posted).length !== 1) {
  throw new Error("undefined runtime did not post a closet result");
}

let sendMessageCalls = 0;
const crashingRuntime = {
  runtime: {
    id: "test-extension",
    connect() {
      throw new Error("connect failed");
    },
    get sendMessage() {
      sendMessageCalls += 1;
      return undefined;
    },
  },
};
const crashing = loadBridge(crashingRuntime);
fireCheckCloset(crashing);
await wait(20);
const crashingResults = closetResults(crashing.posted);
if (crashingResults.length !== 1) {
  throw new Error("sendMessage missing: expected a closet result, not a throw");
}
if (sendMessageCalls < 1) {
  throw new Error("sendMessage missing: getter was not checked");
}

const portReplies = [];
const portRuntime = {
  runtime: {
    id: "test-extension",
    connect({ name }) {
      if (name !== "ra-web") throw new Error(`unexpected port ${name}`);
      const port = {
        onMessage: {
          addListener(fn) {
            portReplies.push(fn);
          },
        },
        postMessage(message) {
          if (message.type !== "checkCloset") {
            throw new Error(`unexpected task ${message.type}`);
          }
          queueMicrotask(() => {
            for (const fn of portReplies) {
              fn({
                type: "checkClosetResult",
                result: {
                  ok: true,
                  listings: [
                    {
                      externalId: "abc",
                      title: "Nike tee",
                      url: "https://poshmark.com/listing/Nike-tee-abc",
                    },
                  ],
                },
              });
            }
          });
        },
        disconnect() {},
      };
      return port;
    },
    sendMessage() {
      throw new TypeError("Cannot read properties of undefined (reading 'sendMessage')");
    },
  },
};

const viaPort = loadBridge(portRuntime);
fireCheckCloset(viaPort);
await wait(20);
const portResults = closetResults(viaPort.posted);
if (portResults.length !== 1 || portResults[0].data.ok !== true) {
  throw new Error("port fallback did not return listings");
}
if (portResults[0].data.listings.length !== 1) {
  throw new Error("port fallback lost listings");
}

const sendMessageRuntime = {
  runtime: {
    id: "test-extension",
    connect() {
      return { onMessage: { addListener() {} }, postMessage() {}, disconnect() {} };
    },
    sendMessage(message) {
      if (message.type !== "checkCloset") {
        throw new Error(`unexpected task ${message.type}`);
      }
      return Promise.resolve({
        ok: true,
        listings: [{ externalId: "m1", title: "Coat" }],
      });
    },
  },
};
const viaMessage = loadBridge(sendMessageRuntime);
fireCheckCloset(viaMessage);
await wait(20);
const messageResults = closetResults(viaMessage.posted);
if (messageResults.length !== 1 || messageResults[0].data.ok !== true) {
  throw new Error("sendMessage path did not return listings");
}

console.log("ok bridge missing runtime posts closet-check-result");
console.log("ok bridge sendMessage crash falls back to port");
console.log("ok bridge sendMessage still works");
