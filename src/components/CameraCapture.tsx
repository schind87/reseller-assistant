"use client";

import { useEffect, useRef, useState } from "react";
import { BigButton } from "@/components/BigButton";
import type { PhotoAspectGuide } from "@/lib/platforms";

type CameraCaptureProps = {
  aspect: PhotoAspectGuide;
  showAspectGuide: boolean;
  guideNote?: string;
  onCapture: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
  onFallbackFile: (file: File) => void;
};

/** Map a DOM rect over an object-cover <video> into source pixel coords. */
function mapDisplayRectToVideoPixels(
  video: HTMLVideoElement,
  displayRect: DOMRect
): { sx: number; sy: number; sw: number; sh: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const elem = video.getBoundingClientRect();
  if (elem.width <= 0 || elem.height <= 0) return null;

  const videoRatio = vw / vh;
  const elemRatio = elem.width / elem.height;

  let renderedW: number;
  let renderedH: number;
  let offsetX: number;
  let offsetY: number;
  if (videoRatio > elemRatio) {
    // Wider than the element — height fills, sides crop.
    renderedH = elem.height;
    renderedW = elem.height * videoRatio;
    offsetX = (renderedW - elem.width) / 2;
    offsetY = 0;
  } else {
    // Taller than the element — width fills, top/bottom crop.
    renderedW = elem.width;
    renderedH = elem.width / videoRatio;
    offsetX = 0;
    offsetY = (renderedH - elem.height) / 2;
  }

  const scaleX = vw / renderedW;
  const scaleY = vh / renderedH;

  const left = displayRect.left - elem.left + offsetX;
  const top = displayRect.top - elem.top + offsetY;

  let sx = left * scaleX;
  let sy = top * scaleY;
  let sw = displayRect.width * scaleX;
  let sh = displayRect.height * scaleY;

  // Clamp to the video frame.
  sx = Math.max(0, Math.min(sx, vw - 1));
  sy = Math.max(0, Math.min(sy, vh - 1));
  sw = Math.max(1, Math.min(sw, vw - sx));
  sh = Math.max(1, Math.min(sh, vh - sy));

  return { sx, sy, sw, sh };
}

export function CameraCapture({
  aspect,
  showAspectGuide,
  guideNote,
  onCapture,
  onCancel,
  onFallbackFile,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturePhase, setCapturePhase] = useState<
    "idle" | "capturing" | "uploading"
  >("idle");
  const capturingRef = useRef(false);
  const capturing = capturePhase !== "idle";

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

  async function captureFrame() {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const cropEl = showAspectGuide ? guideRef.current : stageRef.current;
    if (!cropEl) return;

    const mapped = mapDisplayRectToVideoPixels(
      video,
      cropEl.getBoundingClientRect()
    );
    if (!mapped) return;

    const { sx, sy, sw, sh } = mapped;
    const targetRatio = showAspectGuide
      ? aspect.width / aspect.height
      : sw / sh;

    const longEdge = Math.min(1600, Math.max(sw, sh));
    let outW: number;
    let outH: number;
    if (targetRatio >= 1) {
      outW = Math.round(longEdge);
      outH = Math.round(longEdge / targetRatio);
    } else {
      outH = Math.round(longEdge);
      outW = Math.round(longEdge * targetRatio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, outW);
    canvas.height = Math.max(1, outH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    capturingRef.current = true;
    setCapturePhase("capturing");
    video.pause();
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", 0.92);
    });

    if (!blob) {
      capturingRef.current = false;
      setCapturePhase("idle");
      void video.play();
      return;
    }

    setCapturePhase("uploading");
    try {
      await onCapture(blob);
    } finally {
      capturingRef.current = false;
      setCapturePhase("idle");
      void video.play();
    }
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

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {showAspectGuide ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              ref={guideRef}
              className={
                aspect.height > aspect.width
                  ? "relative h-full max-h-[min(78vh,92vw)] w-auto border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  : "relative w-full max-w-[min(92vw,70vh)] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              }
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
              {guideNote ?? "Will not go on the listing"}
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
        <BigButton
          disabled={!ready || Boolean(error) || capturing}
          aria-busy={capturing}
          onClick={() => void captureFrame()}
        >
          {capturePhase === "uploading"
            ? "Uploading…"
            : capturePhase === "capturing"
              ? "Capturing…"
              : "Capture photo"}
        </BigButton>
        <BigButton
          variant="secondary"
          disabled={capturing}
          onClick={() => {
            // Do not set capture= on this input — that forces the camera on
            // iOS/Android and skips the photo library.
            fileRef.current?.click();
          }}
        >
          Choose from library
        </BigButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
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
