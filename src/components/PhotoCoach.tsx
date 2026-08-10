"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { CameraCapture } from "@/components/CameraCapture";
import { StepProgress } from "@/components/StepProgress";
import {
  canPickDevicePhotoFolder,
  DEVICE_PHOTO_FOLDER_NAME,
  getDevicePhotoFolderStatus,
  pickDevicePhotoFolder,
  saveCapturedPhotoToDevice,
} from "@/lib/device-photo-folder";
import {
  getPhotoSteps,
  PLATFORM_LABELS,
  PLATFORM_PHOTO_ASPECT,
  photoRoleLabel,
} from "@/lib/platforms";
import type {
  Listing,
  ListingPhotoWithUrl,
  PhotoRole,
  Platform,
} from "@/lib/types";

type PhotoCoachProps = {
  listing: Listing;
  initialPhotos: ListingPhotoWithUrl[];
};

export function PhotoCoach({ listing, initialPhotos }: PhotoCoachProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const platform = listing.platform as Platform;
  const steps = getPhotoSteps(platform);
  const aspect = PLATFORM_PHOTO_ASPECT[platform];
  const sectionParam = searchParams.get("section");
  const startStep = (() => {
    if (sectionParam === "identify") return 0;
    if (sectionParam === "inventory") {
      const idx = steps.findIndex((s) => s.purpose === "inventory");
      return idx >= 0 ? idx : 0;
    }
    if (sectionParam === "listing") {
      const idx = steps.findIndex((s) => s.purpose === "listing");
      return idx >= 0 ? idx : 0;
    }
    return Math.min(Math.max(listing.photo_step, 0), steps.length);
  })();
  const [photos, setPhotos] = useState(initialPhotos);
  const [stepIndex, setStepIndex] = useState(startStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [joinOnly, setJoinOnly] = useState(false);
  const [deviceFolderReady, setDeviceFolderReady] = useState(false);
  const [deviceFolderName, setDeviceFolderName] = useState<string | null>(null);
  const [deviceSaveNote, setDeviceSaveNote] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const phoneMode = searchParams.get("phone") === "1" || joinOnly;
  const folderPickerAvailable = canPickDevicePhotoFolder();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/status")
      .then((res) => res.json())
      .then((json: { joinOnly?: boolean }) => {
        if (!cancelled && json.joinOnly) setJoinOnly(true);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!phoneMode) return;
    let cancelled = false;
    void getDevicePhotoFolderStatus()
      .then((status) => {
        if (cancelled) return;
        setDeviceFolderReady(status.ready);
        setDeviceFolderName(status.name);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [phoneMode]);

  const done = stepIndex >= steps.length;
  const step = done ? null : steps[stepIndex]!;
  const currentRolePhotos = step
    ? photos.filter((p) => {
        if (step.purpose === "identify") {
          return (
            p.role === "id_tag" ||
            p.role === "brand_tag" ||
            p.role === "care_tag"
          );
        }
        return p.role === step.role;
      })
    : [];

  async function chooseDeviceFolder() {
    setPickingFolder(true);
    setError(null);
    try {
      const name = await pickDevicePhotoFolder();
      setDeviceFolderReady(true);
      setDeviceFolderName(name);
      setDeviceSaveNote(`Photo copies will go in ${name} on this phone.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not set a save folder on this phone"
      );
    } finally {
      setPickingFolder(false);
    }
  }

  async function uploadBlob(
    blob: Blob,
    role: PhotoRole,
    opts?: { saveToDevice?: boolean }
  ) {
    setBusy(true);
    setError(null);
    try {
      if (opts?.saveToDevice) {
        try {
          const mode = await saveCapturedPhotoToDevice(blob, {
            listingId: listing.id,
            role,
            sequence: photos.filter((p) => p.role === role).length + 1,
          });
          setDeviceSaveNote(
            mode === "folder"
              ? `Saved a copy to ${deviceFolderName || DEVICE_PHOTO_FOLDER_NAME} on this phone.`
              : `Saved a copy to Downloads (look for ${DEVICE_PHOTO_FOLDER_NAME}-…).`
          );
        } catch (saveErr) {
          console.warn("local photo save failed:", saveErr);
          setDeviceSaveNote(
            "Uploaded to the listing, but could not save a local copy on this phone."
          );
        }
      }

      const body = new FormData();
      body.append(
        "photo",
        new File([blob], `${role}.jpg`, { type: blob.type || "image/jpeg" })
      );
      body.append("role", role);

      const res = await fetch(`/api/listings/${listing.id}/photos`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setPhotos((prev) => [...prev, data.photo]);
      setPreview(data.photo.signedUrl ?? URL.createObjectURL(blob));
      setCameraOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function finishCoach() {
    setPreview(null);
    setCameraOpen(false);
    setStepIndex(steps.length);
  }

  function goNext() {
    setPreview(null);
    const next = stepIndex + 1;
    if (next >= steps.length) {
      finishCoach();
      return;
    }
    setStepIndex(next);
    void fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_step: next }),
    }).catch(() => {
      /* phone join sessions may not own the listing */
    });
  }

  function takeMorePhotos() {
    setPreview(null);
    setStepIndex(0);
  }

  const deviceSaveBanner =
    phoneMode ? (
      <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
        <p className="font-semibold text-[var(--foreground)]">
          Save copies on this phone
        </p>
        {deviceFolderReady ? (
          <p className="mt-1">
            Camera shots also go into{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {deviceFolderName || DEVICE_PHOTO_FOLDER_NAME}
            </span>
            .
          </p>
        ) : folderPickerAvailable ? (
          <p className="mt-1">
            Choose a folder once (we create {DEVICE_PHOTO_FOLDER_NAME} inside
            it). Until then, copies download to Files/Downloads.
          </p>
        ) : (
          <p className="mt-1">
            Each camera shot is also downloaded to this phone — look for files
            named {DEVICE_PHOTO_FOLDER_NAME}-… in Files or Downloads.
          </p>
        )}
        {folderPickerAvailable ? (
          <button
            type="button"
            disabled={pickingFolder}
            onClick={() => void chooseDeviceFolder()}
            className="mt-3 text-base font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            {pickingFolder
              ? "Opening folder picker…"
              : deviceFolderReady
                ? "Change save folder"
                : "Choose save folder"}
          </button>
        ) : null}
        {deviceSaveNote ? (
          <p className="mt-2 text-[var(--foreground)]">{deviceSaveNote}</p>
        ) : null}
      </div>
    ) : null;

  if (cameraOpen && step) {
    return (
      <CameraCapture
        aspect={aspect}
        showAspectGuide={step.purpose === "listing"}
        guideNote={
          step.purpose === "identify"
            ? "For AI identification only — won’t be posted"
            : step.purpose === "inventory"
              ? "Stocking photo — private by default"
              : undefined
        }
        onCancel={() => setCameraOpen(false)}
        onCapture={(blob) =>
          void uploadBlob(blob, step.role, { saveToDevice: phoneMode })
        }
        onFallbackFile={(file) =>
          void uploadBlob(file, step.role, { saveToDevice: false })
        }
      />
    );
  }

  if (done || !step) {
    if (phoneMode) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
          <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
            Photos sent
          </h1>
          <p className="text-lg leading-relaxed text-[var(--muted)]">
            You can put the phone down. Continue on your computer — the listing
            hub will show these garment photos so you can finish the draft.
          </p>
          <p className="text-base text-[var(--muted)]">
            {photos.length} photo{photos.length === 1 ? "" : "s"} uploaded.
          </p>
          {deviceSaveBanner}
          <BigButton onClick={takeMorePhotos}>Take more photos</BigButton>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
        <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
          Photos complete
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Great work. Edit the listing fields on the hub, or take more photos.
        </p>
        <BigButton onClick={() => router.push(`/app/listings/${listing.id}`)}>
          Back to listing hub
        </BigButton>
        <BigButton variant="secondary" onClick={takeMorePhotos}>
          Take more photos
        </BigButton>
      </div>
    );
  }

  const purposeBanner =
    step.purpose === "identify"
      ? "Tag photos for AI — won’t be posted"
      : step.purpose === "inventory"
        ? "Stocking photo — private by default"
        : `Listing photo for ${PLATFORM_LABELS[platform]} · ${aspect.label}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <StepProgress
        current={stepIndex + 1}
        total={steps.length}
        label={`Step ${stepIndex + 1} of ${steps.length}`}
      />

      <div
        className={`rounded-xl px-4 py-3 text-base font-semibold ${
          step.purpose === "listing"
            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
            : "bg-amber-50 text-amber-950"
        }`}
      >
        {purposeBanner}
      </div>

      {deviceSaveBanner}

      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          {step.optional ? "Optional" : "Required"}
          {step.allowMultiple ? " · add as many as you need" : ""}
        </p>
        <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
          {step.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">
          {step.instruction}
        </p>
        {step.purpose === "listing" ? (
          <p className="mt-2 text-base text-[var(--muted)]">
            Aim for {PLATFORM_LABELS[platform]}&apos;s {aspect.label} frame when
            you open the camera.
          </p>
        ) : null}
      </div>

      {currentRolePhotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {currentRolePhotos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl ?? preview ?? ""}
                alt={photoRoleLabel(photo.role)}
                className="aspect-square w-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`${step.title} preview`}
          className="max-h-72 w-full rounded-2xl object-cover ring-1 ring-[var(--border)]"
        />
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <BigButton disabled={busy} onClick={() => setCameraOpen(true)}>
          {busy
            ? "Uploading…"
            : step.allowMultiple
              ? currentRolePhotos.length > 0
                ? "Add another photo"
                : "Take photo"
              : currentRolePhotos.length > 0
                ? "Retake photo"
                : "Take photo"}
        </BigButton>

        {step.allowMultiple && currentRolePhotos.length > 0 ? (
          <BigButton onClick={goNext}>
            Done with{" "}
            {step.purpose === "identify"
              ? "tags"
              : step.purpose === "inventory"
                ? "stocking photos"
                : photoRoleLabel(step.role).toLowerCase()}{" "}
            — next
          </BigButton>
        ) : null}

        {!step.allowMultiple && currentRolePhotos.length > 0 ? (
          <BigButton onClick={goNext}>Looks good — next</BigButton>
        ) : null}

        {step.optional ? (
          <BigButton variant="secondary" disabled={busy} onClick={goNext}>
            {currentRolePhotos.length > 0
              ? "Continue"
              : step.purpose === "identify"
                ? "Skip tags for now"
                : "Skip for now"}
          </BigButton>
        ) : null}

        <BigButton
          variant="ghost"
          onClick={() => {
            if (phoneMode) {
              finishCoach();
              return;
            }
            router.push(`/app/listings/${listing.id}`);
          }}
        >
          {phoneMode ? "Done — send to computer" : "Done for now"}
        </BigButton>
      </div>
    </div>
  );
}
