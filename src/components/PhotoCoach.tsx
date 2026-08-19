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
    if (
      sectionParam === "identify" ||
      sectionParam === "inventory" ||
      sectionParam === "listing"
    ) {
      const idx = steps.findIndex((s) => s.purpose === sectionParam);
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

  function persistStep(next: number) {
    void fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_step: next }),
    }).catch(() => {
      /* phone join sessions may not own the listing */
    });
  }

  function finishCoach() {
    setPreview(null);
    setCameraOpen(false);
    setStepIndex(steps.length);
    persistStep(steps.length);
  }

  function goNext() {
    setPreview(null);
    const next = stepIndex + 1;
    if (next >= steps.length) {
      finishCoach();
      return;
    }
    setStepIndex(next);
    persistStep(next);
  }

  function goBack() {
    if (stepIndex <= 0) return;
    setPreview(null);
    setCameraOpen(false);
    const prev = stepIndex - 1;
    setStepIndex(prev);
    persistStep(prev);
  }

  function takeMorePhotos() {
    setPreview(null);
    setStepIndex(0);
    persistStep(0);
  }

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
          <BigButton variant="secondary" onClick={goBack}>
            Back to last step
          </BigButton>
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

  const canGoBack = stepIndex > 0;
  const nextLabel =
    stepIndex >= steps.length - 1
      ? phoneMode
        ? "Done — send to computer"
        : "Done"
      : currentRolePhotos.length > 0
        ? "Next"
        : "Skip";

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
          Optional
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
            you open the camera — the saved photo matches those borders.
          </p>
        ) : null}
      </div>

      {currentRolePhotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {currentRolePhotos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]"
              style={{
                aspectRatio: `${aspect.width} / ${aspect.height}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl ?? preview ?? ""}
                alt={photoRoleLabel(photo.role)}
                className="h-full w-full object-contain"
              />
            </li>
          ))}
        </ul>
      ) : preview ? (
        <div
          className="overflow-hidden rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]"
          style={{
            aspectRatio: `${aspect.width} / ${aspect.height}`,
            maxHeight: "18rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${step.title} preview`}
            className="h-full w-full object-contain"
          />
        </div>
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
            : currentRolePhotos.length > 0
              ? `Add another ${photoRoleLabel(step.role)} photo`
              : `Take ${photoRoleLabel(step.role)} photo`}
        </BigButton>

        <div className="grid grid-cols-2 gap-3">
          <BigButton
            variant="secondary"
            disabled={busy || !canGoBack}
            onClick={goBack}
          >
            Back
          </BigButton>
          <BigButton disabled={busy} onClick={goNext}>
            {nextLabel}
          </BigButton>
        </div>

        {phoneMode && stepIndex < steps.length - 1 ? (
          <BigButton variant="ghost" disabled={busy} onClick={finishCoach}>
            Done — send to computer
          </BigButton>
        ) : !phoneMode ? (
          <BigButton
            variant="ghost"
            onClick={() => router.push(`/app/listings/${listing.id}`)}
          >
            Done for now
          </BigButton>
        ) : null}
      </div>
    </div>
  );
}
