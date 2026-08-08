"use client";

import { useEffect, useRef, useState } from "react";
import { BigButton } from "@/components/BigButton";
import type { PhotoAspectGuide } from "@/lib/platforms";

type CameraCaptureProps = {
  aspect: PhotoAspectGuide;
  showAspectGuide: boolean;
  guideNote?: string;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  onFallbackFile: (file: File) => void;
};

export function CameraCapture({
  aspect,
  showAspectGuide,
  guideNote,
  onCapture,
  onCancel,
  onFallbackFile,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not available in this browser. Use Choose photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not open the camera. Allow camera access, or choose a photo from your library."
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = aspect.width / aspect.height;

    let cropW = vw;
    let cropH = vw / targetRatio;
    if (cropH > vh) {
      cropH = vh;
      cropW = vh * targetRatio;
    }
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;

    const canvas = document.createElement("canvas");
    const outSize = Math.min(1600, Math.max(cropW, cropH));
    canvas.width = Math.round(outSize);
    canvas.height = Math.round(outSize / targetRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      video,
      sx,
      sy,
      cropW,
      cropH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="text-base font-semibold text-white/90"
          onClick={onCancel}
        >
          Cancel
        </button>
        <p className="text-center text-sm font-semibold">
          {showAspectGuide
            ? `${aspect.label} for listing`
            : guideNote ?? "Identification — not posted"}
        </p>
        <span className="w-14" aria-hidden />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {showAspectGuide ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              className="relative w-full max-w-[min(92vw,70vh)] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
            >
              <div className="absolute inset-x-0 top-2 text-center text-xs font-semibold tracking-wide text-white drop-shadow">
                Fill this frame · {aspect.label}
              </div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
            <p className="rounded-full bg-black/60 px-4 py-2 text-center text-sm font-semibold">
              {guideNote ?? "For identification — will not be posted"}
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p className="bg-red-950 px-4 py-3 text-center text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <BigButton disabled={!ready || Boolean(error)} onClick={captureFrame}>
          Capture photo
        </BigButton>
        <BigButton variant="secondary" onClick={() => fileRef.current?.click()}>
          Choose from library
        </BigButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFallbackFile(file);
          }}
        />
      </div>
    </div>
  );
}
