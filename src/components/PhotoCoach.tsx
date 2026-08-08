"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { StepProgress } from "@/components/StepProgress";
import { getPhotoSteps } from "@/lib/platforms";
import type { Listing, ListingPhotoWithUrl, PhotoRole, Platform } from "@/lib/types";

type PhotoCoachProps = {
  listing: Listing;
  initialPhotos: ListingPhotoWithUrl[];
};

export function PhotoCoach({ listing, initialPhotos }: PhotoCoachProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const steps = getPhotoSteps(listing.platform as Platform);
  const [photos, setPhotos] = useState(initialPhotos);
  const [stepIndex, setStepIndex] = useState(() => {
    const taken = new Set(initialPhotos.map((p) => p.role));
    const firstMissing = steps.findIndex((s) => !taken.has(s.role));
    return firstMissing === -1 ? steps.length : firstMissing;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const done = stepIndex >= steps.length;
  const step = done ? null : steps[stepIndex]!;
  const currentRolePhotos = step
    ? photos.filter((p) => p.role === step.role)
    : [];

  async function uploadFile(file: File, role: PhotoRole) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
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
      setPreview(data.photo.signedUrl ?? URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !step) return;
    void uploadFile(file, step.role);
  }

  function goNext() {
    setPreview(null);
    const next = stepIndex + 1;
    setStepIndex(next);
    if (next >= steps.length) {
      router.push(`/app/listings/${listing.id}`);
    }
  }

  function skipOptional() {
    if (!step?.optional) return;
    goNext();
  }

  if (done || !step) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
        <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
          Photos complete
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Great work. You can review on the computer or take more photos later.
        </p>
        <BigButton onClick={() => router.push(`/app/listings/${listing.id}`)}>
          Back to listing
        </BigButton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <StepProgress
        current={stepIndex + 1}
        total={steps.length}
        label={`Photo ${stepIndex + 1} of ${steps.length}`}
      />

      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          {step.optional ? "Optional" : "Required"}
        </p>
        <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
          {step.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">
          {step.instruction}
        </p>
      </div>

      {(preview || currentRolePhotos[0]?.signedUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview ?? currentRolePhotos[0]?.signedUrl ?? ""}
          alt={`${step.title} preview`}
          className="max-h-72 w-full rounded-2xl object-cover ring-1 ring-[var(--border)]"
        />
      )}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="flex flex-col gap-3">
        <BigButton
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? "Uploading…"
            : currentRolePhotos.length > 0
              ? "Retake photo"
              : "Take photo"}
        </BigButton>

        {currentRolePhotos.length > 0 ? (
          <BigButton onClick={goNext}>Looks good — next</BigButton>
        ) : null}

        {step.optional ? (
          <BigButton variant="secondary" disabled={busy} onClick={skipOptional}>
            Skip for now
          </BigButton>
        ) : null}

        <BigButton
          variant="ghost"
          onClick={() => router.push(`/app/listings/${listing.id}`)}
        >
          Done for now
        </BigButton>
      </div>
    </div>
  );
}
