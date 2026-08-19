const DB_NAME = "reseller-assistant";
const DB_VERSION = 1;
const STORE = "handles";
const HANDLE_KEY = "photoFolder";
export const DEVICE_PHOTO_FOLDER_NAME = "ResellerAssistant";

type DirectoryHandle = FileSystemDirectoryHandle;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function storeHandle(handle: DirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not store folder"));
  });
  db.close();
}

async function loadHandle(): Promise<DirectoryHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<DirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () =>
        resolve((req.result as DirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Could not load folder"));
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

async function ensureWritePermission(handle: DirectoryHandle): Promise<boolean> {
  const withPermission = handle as DirectoryHandle & {
    queryPermission?: (desc: { mode: "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (desc: {
      mode: "readwrite";
    }) => Promise<PermissionState>;
  };

  if (typeof withPermission.queryPermission === "function") {
    const current = await withPermission.queryPermission({ mode: "readwrite" });
    if (current === "granted") return true;
    if (current === "denied") return false;
  }

  if (typeof withPermission.requestPermission === "function") {
    const next = await withPermission.requestPermission({ mode: "readwrite" });
    return next === "granted";
  }

  // Older implementations may allow write without explicit permission helpers.
  return true;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/** iPhone/iPad Safari (and other WebKit browsers) — downloads open a share/Files sheet. */
export function isIosPhotoSavePromptingBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ can report as MacIntel while still using touch + WebKit downloads.
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

export function canPickDevicePhotoFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function getDevicePhotoFolderStatus(): Promise<{
  ready: boolean;
  name: string | null;
}> {
  const handle = await loadHandle();
  if (!handle) return { ready: false, name: null };
  const ok = await ensureWritePermission(handle);
  if (!ok) return { ready: false, name: null };
  return { ready: true, name: handle.name || DEVICE_PHOTO_FOLDER_NAME };
}

/** User gesture required. Creates/uses a ResellerAssistant folder inside the pick. */
export async function pickDevicePhotoFolder(): Promise<string> {
  if (!canPickDevicePhotoFolder()) {
    throw new Error("This browser cannot choose a save folder.");
  }

  const picker = window as unknown as {
    showDirectoryPicker: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: string;
    }) => Promise<DirectoryHandle>;
  };

  const root = await picker.showDirectoryPicker({
    id: "reseller-assistant-photos",
    mode: "readwrite",
    startIn: "pictures",
  });

  const folder = await root.getDirectoryHandle(DEVICE_PHOTO_FOLDER_NAME, {
    create: true,
  });
  await storeHandle(folder);
  return folder.name || DEVICE_PHOTO_FOLDER_NAME;
}

export function buildDevicePhotoFilename(params: {
  listingId: string;
  role: string;
  sequence?: number;
}): string {
  const shortId = params.listingId.replace(/-/g, "").slice(0, 8);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const seq =
    typeof params.sequence === "number"
      ? `-${String(params.sequence).padStart(2, "0")}`
      : "";
  return `${DEVICE_PHOTO_FOLDER_NAME}-${shortId}-${params.role}${seq}-${stamp}.jpg`;
}

/**
 * Saves a camera capture onto the phone when it can be done without a prompt.
 * Prefers the chosen ResellerAssistant folder. On Android/desktop Chrome, falls
 * back to a quiet Downloads write. On iOS, skips the download fallback — Safari
 * would open a share/Files sheet after every shot.
 */
export async function saveCapturedPhotoToDevice(
  blob: Blob,
  params: { listingId: string; role: string; sequence?: number }
): Promise<"folder" | "download" | "skipped"> {
  const filename = buildDevicePhotoFilename(params);
  const handle = await loadHandle();

  if (handle) {
    try {
      const ok = await ensureWritePermission(handle);
      if (ok && "getFileHandle" in handle) {
        const listingDir = await handle.getDirectoryHandle(
          params.listingId.replace(/-/g, "").slice(0, 8),
          { create: true }
        );
        const fileHandle = await listingDir.getFileHandle(
          `${params.role}${
            typeof params.sequence === "number"
              ? `-${String(params.sequence).padStart(2, "0")}`
              : ""
          }-${Date.now()}.jpg`,
          { create: true }
        );
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return "folder";
      }
    } catch (err) {
      console.warn("device folder save failed, downloading instead:", err);
    }
  }

  if (isIosPhotoSavePromptingBrowser()) {
    return "skipped";
  }

  downloadBlob(blob, filename);
  return "download";
}
