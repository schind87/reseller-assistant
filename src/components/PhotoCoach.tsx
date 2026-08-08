"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { CameraCapture } from "@/components/CameraCapture";
import { StepProgress } from "@/components/StepProgress";
import {
  getPhotoSteps,
  PLATFORM_LABELS,
  PLATFORM_PHOTO_ASPECT,
  photoRoleLabel,
} from "@/lib/platforms";
import type { Listing, ListingPhotoWithUrl, PhotoRole, Platform } from "@/lib/types";

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
  const phoneMode = searchParams.get("phone") === "1" || joinOnly;

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

  async function uploadBlob(blob: Blob, role: PhotoRole) {
    setBusy(true);
    setError(null);
    try {
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

  if (cameraOpen && step) {
    return (
      <CameraCapture
        aspect={aspect}
        showAspectGuide={step.purpose === "listing"}
        guideNote={
          step.purpose === "identify"
            ? "Identification tag — will not be posted"
            : step.purpose === "inventory"
              ? "Inventory only — will not be posted"
              : undefined
        }
        onCancel={() => setCameraOpen(false)}
        onCapture={(blob) => void uploadBlob(blob, step.role)}
        onFallbackFile={(file) => void uploadBlob(file, step.role)}
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
          Great work. Review the draft on this screen, or take more photos.
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
      ? "Identification photos — not posted"
      : step.purpose === "inventory"
        ? "Inventory photo — not posted"
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
            Done with {step.purpose === "identify" ? "tags" : "these"} — next
          </BigButton>
        ) : null}

        {!step.allowMultiple && currentRolePhotos.length > 0 ? (
          <BigButton onClick={goNext}>Looks good — next</BigButton>
        ) : null}

        {step.optional ? (
          <BigButton
            variant="secondary"
            disabled={busy}
            onClick={goNext}
          >
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
