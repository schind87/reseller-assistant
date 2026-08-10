"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { BigButton } from "@/components/BigButton";
import type { PhotoAspectGuide } from "@/lib/platforms";
import {
  DEFAULT_PHOTO_CROP_TRANSFORM,
  blobToJpegFile,
  cropImageFileToAspect,
  cropImageUrlToAspect,
  loadImageFromFile,
  loadImageFromUrl,
  type PhotoCropTransform,
} from "@/lib/photo-aspect";

type PhotoAspectCropProps = {
  aspect: PhotoAspectGuide;
  platformLabel: string;
  /** Local file being cropped before upload. */
  file?: File | null;
  /** Existing photo URL (Adjust aspect ratio on a saved shot). */
  imageUrl?: string | null;
  fileName?: string;
  /** Primary cancel / dismiss label. */
  cancelLabel?: string;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
};

export function PhotoAspectCrop({
  aspect,
  platformLabel,
  file = null,
  imageUrl = null,
  fileName = "photo.jpg",
  cancelLabel = "Skip this photo",
  onConfirm,
  onCancel,
}: PhotoAspectCropProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<PhotoCropTransform>(
    DEFAULT_PHOTO_CROP_TRANSFORM
  );
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const transformRef = useRef(transform);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setError(null);
      setTransform(DEFAULT_PHOTO_CROP_TRANSFORM);
      setNatural(null);
      setObjectUrl(null);
      try {
        if (file) {
          createdUrl = URL.createObjectURL(file);
          const img = await loadImageFromFile(file);
          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          return;
        }
        if (imageUrl) {
          const img = await loadImageFromUrl(imageUrl);
          if (cancelled) return;
          setObjectUrl(imageUrl);
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          return;
        }
        setError("No photo to adjust.");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load photo.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, imageUrl]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      setFrameSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  const clampTransform = useCallback(
    (next: PhotoCropTransform): PhotoCropTransform => {
      if (!frameSize || !natural) {
        return { ...next, scale: Math.max(1, next.scale) };
      }
      const { w: fw, h: fh } = frameSize;
      const scale = Math.max(1, next.scale);
      const baseScale = Math.max(fw / natural.w, fh / natural.h);
      const displayScale = baseScale * scale;
      const minX = fw - natural.w * displayScale;
      const minY = fh - natural.h * displayScale;
      return {
        scale,
        offsetX: Math.min(0, Math.max(minX, next.offsetX)),
        offsetY: Math.min(0, Math.max(minY, next.offsetY)),
      };
    },
    [frameSize, natural]
  );

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.offsetX,
      originY: transform.offsetY,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setTransform(
      clampTransform({
        scale: transformRef.current.scale,
        offsetX: drag.originX + (e.clientX - drag.startX),
        offsetY: drag.originY + (e.clientY - drag.startY),
      })
    );
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setTransform((prev) =>
      clampTransform({
        ...prev,
        scale: prev.scale + delta,
      })
    );
  }

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    function distance(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        pinchRef.current = {
          distance: distance(t0, t1),
          scale: transformRef.current.scale,
        };
        dragRef.current = null;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        const d = distance(t0, t1);
        const ratio = d / Math.max(1, pinchRef.current.distance);
        setTransform(
          clampTransform({
            ...transformRef.current,
            scale: pinchRef.current.scale * ratio,
          })
        );
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [clampTransform, natural]);

  async function confirm() {
    if (!frameSize || !natural) return;
    setBusy(true);
    setError(null);
    try {
      const size = { width: frameSize.w, height: frameSize.h };
      const blob = file
        ? await cropImageFileToAspect(file, aspect, transform, size)
        : imageUrl
          ? await cropImageUrlToAspect(imageUrl, aspect, transform, size)
          : null;
      if (!blob) throw new Error("Could not crop this photo.");
      await onConfirm(blobToJpegFile(blob, file?.name ?? fileName));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop this photo.");
      setBusy(false);
    }
  }

  const imgStyle =
    natural && frameSize
      ? (() => {
          const baseScale = Math.max(
            frameSize.w / natural.w,
            frameSize.h / natural.h
          );
          const displayScale = baseScale * Math.max(1, transform.scale);
          const left =
            (frameSize.w - natural.w * displayScale) / 2 + transform.offsetX;
          const top =
            (frameSize.h - natural.h * displayScale) / 2 + transform.offsetY;
          return {
            width: natural.w * displayScale,
            height: natural.h * displayScale,
            transform: `translate(${left}px, ${top}px)`,
          };
        })()
      : undefined;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust aspect ratio"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="text-base font-semibold text-white/90"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-semibold">Adjust aspect ratio</p>
          <p className="truncate text-xs text-white/75">
            {platformLabel} · {aspect.label}
          </p>
        </div>
        <span className="w-14" aria-hidden />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            ref={frameRef}
            className={
              aspect.height > aspect.width
                ? "relative h-full max-h-[min(78vh,92vw)] w-auto touch-none overflow-hidden border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                : "relative w-full max-w-[min(92vw,70vh)] touch-none overflow-hidden border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            }
            style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {objectUrl && natural ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
                style={imgStyle}
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-sm text-white/70">
                Loading…
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold tracking-wide text-white drop-shadow">
              Drag to reposition · pinch or scroll to zoom
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="bg-red-950 px-4 py-3 text-center text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <BigButton
          disabled={busy || !natural || !frameSize || Boolean(error && !natural)}
          onClick={() => void confirm()}
        >
          {busy ? "Saving crop…" : "Use this crop"}
        </BigButton>
        <BigButton variant="secondary" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </BigButton>
      </div>
    </div>
  );
}
