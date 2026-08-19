"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BigButton } from "@/components/BigButton";
import type { PhotoAspectGuide } from "@/lib/platforms";
import {
  DEFAULT_PHOTO_CROP_TRANSFORM,
  PHOTO_CROP_MAX_ZOOM,
  blobToJpegFile,
  clampCropTransform,
  cropImageFileToAspect,
  cropImageUrlToAspect,
  cropRectFromOutline,
  loadImageFromFile,
  loadImageFromUrl,
  resizeCropRectFromCorner,
  transformFromCropRect,
  type CropCorner,
  type PhotoCropTransform,
} from "@/lib/photo-aspect";

type PhotoAspectCropProps = {
  aspect: PhotoAspectGuide;
  platformLabel: string;
  /** Local file being cropped before upload. */
  file?: File | null;
  /** Existing photo URL (Crop on a saved shot). */
  imageUrl?: string | null;
  fileName?: string;
  /** Primary cancel / dismiss label. */
  cancelLabel?: string;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
};

type DisplayLayout = {
  stageW: number;
  stageH: number;
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
  cropLeft: number;
  cropTop: number;
  cropW: number;
  cropH: number;
};

function layoutFor(
  stageW: number,
  stageH: number,
  naturalW: number,
  naturalH: number,
  aspect: PhotoAspectGuide,
  transform: PhotoCropTransform
): DisplayLayout | null {
  if (stageW <= 0 || stageH <= 0 || naturalW <= 0 || naturalH <= 0) return null;

  const fit = Math.min(stageW / naturalW, stageH / naturalH);
  const imgW = naturalW * fit;
  const imgH = naturalH * fit;
  const imgLeft = (stageW - imgW) / 2;
  const imgTop = (stageH - imgH) / 2;

  const rect = cropRectFromOutline(naturalW, naturalH, aspect, transform);
  const cropW = rect.sw * fit;
  const cropH = rect.sh * fit;
  const cropLeft = imgLeft + rect.sx * fit;
  const cropTop = imgTop + rect.sy * fit;

  return {
    stageW,
    stageH,
    imgLeft,
    imgTop,
    imgW,
    imgH,
    cropLeft,
    cropTop,
    cropW,
    cropH,
  };
}

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
  const stageRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<PhotoCropTransform>(
    DEFAULT_PHOTO_CROP_TRANSFORM
  );
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<
    | {
        mode: "move";
        pointerId: number;
        startX: number;
        startY: number;
        originNx: number;
        originNy: number;
        travelX: number;
        travelY: number;
      }
    | {
        mode: "resize";
        pointerId: number;
        corner: CropCorner;
        fit: number;
        imgLeft: number;
        imgTop: number;
        originRect: {
          sx: number;
          sy: number;
          sw: number;
          sh: number;
        };
      }
    | null
  >(null);
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
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  const layout =
    stageSize && natural
      ? layoutFor(
          stageSize.w,
          stageSize.h,
          natural.w,
          natural.h,
          aspect,
          transform
        )
      : null;

  const applyZoom = useCallback((nextScale: number) => {
    setTransform((prev) =>
      clampCropTransform({
        ...prev,
        scale: nextScale,
      })
    );
  }, []);

  function onOutlinePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!layout || !natural) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const fit = Math.min(
      layout.stageW / natural.w,
      layout.stageH / natural.h
    );
    const rect = cropRectFromOutline(
      natural.w,
      natural.h,
      aspect,
      transformRef.current
    );
    const travelX = Math.max(0, (natural.w - rect.sw) * fit);
    const travelY = Math.max(0, (natural.h - rect.sh) * fit);

    dragRef.current = {
      mode: "move",
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originNx: transformRef.current.nx,
      originNy: transformRef.current.ny,
      travelX,
      travelY,
    };
  }

  function onCornerPointerDown(
    corner: CropCorner,
    e: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (!layout || !natural) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const fit = Math.min(
      layout.stageW / natural.w,
      layout.stageH / natural.h
    );
    const rect = cropRectFromOutline(
      natural.w,
      natural.h,
      aspect,
      transformRef.current
    );

    dragRef.current = {
      mode: "resize",
      pointerId: e.pointerId,
      corner,
      fit,
      imgLeft: layout.imgLeft,
      imgTop: layout.imgTop,
      originRect: rect,
    };
  }

  function clientToImagePoint(
    clientX: number,
    clientY: number,
    drag: {
      fit: number;
      imgLeft: number;
      imgTop: number;
    }
  ) {
    const stage = stageRef.current;
    if (!stage) return null;
    const bounds = stage.getBoundingClientRect();
    const stageX = clientX - bounds.left;
    const stageY = clientY - bounds.top;
    return {
      x: (stageX - drag.imgLeft) / drag.fit,
      y: (stageY - drag.imgTop) / drag.fit,
    };
  }

  function onOutlinePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.mode !== "move") return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nx =
      drag.travelX > 0 ? drag.originNx + dx / drag.travelX : drag.originNx;
    const ny =
      drag.travelY > 0 ? drag.originNy + dy / drag.travelY : drag.originNy;
    setTransform(
      clampCropTransform({
        scale: transformRef.current.scale,
        nx,
        ny,
      })
    );
  }

  function onCornerPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !natural) return;
    if (drag.mode !== "resize") return;
    const point = clientToImagePoint(e.clientX, e.clientY, drag);
    if (!point) return;
    const nextRect = resizeCropRectFromCorner(
      natural.w,
      natural.h,
      aspect,
      drag.originRect,
      drag.corner,
      point.x,
      point.y
    );
    setTransform(
      transformFromCropRect(natural.w, natural.h, aspect, nextRect)
    );
  }

  function onDragPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      applyZoom(transformRef.current.scale + delta);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, natural]);

  async function confirm() {
    if (!natural) return;
    setBusy(true);
    setError(null);
    try {
      const blob = file
        ? await cropImageFileToAspect(file, aspect, transform)
        : imageUrl
          ? await cropImageUrlToAspect(imageUrl, aspect, transform)
          : null;
      if (!blob) throw new Error("Could not crop this photo.");
      await onConfirm(blobToJpegFile(blob, file?.name ?? fileName));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop this photo.");
      setBusy(false);
    }
  }

  const zoomPct = Math.round(
    ((transform.scale - 1) / (PHOTO_CROP_MAX_ZOOM - 1)) * 100
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex select-none flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Crop"
      onCopy={(e) => e.preventDefault()}
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
          <p className="text-sm font-semibold">Crop</p>
          <p className="truncate text-xs text-white/75">
            {platformLabel} · {aspect.label}
          </p>
        </div>
        <span className="w-14" aria-hidden />
      </div>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
      >
        {objectUrl && natural && layout ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: layout.imgLeft,
                top: layout.imgTop,
                width: layout.imgW,
                height: layout.imgH,
              }}
            />

            <div
              role="presentation"
              className="absolute cursor-grab touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] active:cursor-grabbing"
              style={{
                left: layout.cropLeft,
                top: layout.cropTop,
                width: layout.cropW,
                height: layout.cropH,
              }}
              onPointerDown={onOutlinePointerDown}
              onPointerMove={onOutlinePointerMove}
              onPointerUp={onDragPointerUp}
              onPointerCancel={onDragPointerUp}
            >
              <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold tracking-wide text-white drop-shadow">
                Drag corners to resize · drag to move
              </div>
            </div>

            {(
              [
                {
                  corner: "nw" as const,
                  left: layout.cropLeft,
                  top: layout.cropTop,
                  cursor: "nwse-resize" as const,
                  label: "Resize from top-left",
                },
                {
                  corner: "ne" as const,
                  left: layout.cropLeft + layout.cropW,
                  top: layout.cropTop,
                  cursor: "nesw-resize" as const,
                  label: "Resize from top-right",
                },
                {
                  corner: "sw" as const,
                  left: layout.cropLeft,
                  top: layout.cropTop + layout.cropH,
                  cursor: "nesw-resize" as const,
                  label: "Resize from bottom-left",
                },
                {
                  corner: "se" as const,
                  left: layout.cropLeft + layout.cropW,
                  top: layout.cropTop + layout.cropH,
                  cursor: "nwse-resize" as const,
                  label: "Resize from bottom-right",
                },
              ] as const
            ).map(({ corner, left, top, cursor, label }) => {
              // Keep the full hit box inside the stage so overflow:hidden
              // doesn't eat corner clicks at the edges.
              const pad = 22;
              const clampedLeft = Math.min(
                layout.stageW - pad,
                Math.max(pad, left)
              );
              const clampedTop = Math.min(
                layout.stageH - pad,
                Math.max(pad, top)
              );
              return (
                <button
                  key={corner}
                  type="button"
                  aria-label={label}
                  className="absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
                  style={{ left: clampedLeft, top: clampedTop, cursor }}
                  onPointerDown={(e) => onCornerPointerDown(corner, e)}
                  onPointerMove={onCornerPointerMove}
                  onPointerUp={onDragPointerUp}
                  onPointerCancel={onDragPointerUp}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none h-4 w-4 rounded-[3px] border-2 border-white bg-[var(--accent)] shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
                  />
                </button>
              );
            })}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            Loading…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <label className="flex items-center gap-3 text-sm font-semibold text-white/90">
          <span className="w-12 shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={PHOTO_CROP_MAX_ZOOM}
            step={0.01}
            value={transform.scale}
            disabled={busy || !natural}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="h-2 w-full flex-1 cursor-pointer accent-[var(--accent)]"
            aria-valuetext={`${zoomPct}% zoom`}
          />
          <span className="w-10 shrink-0 text-right text-xs font-medium text-white/70 tabular-nums">
            {Math.round(transform.scale * 100) / 100}×
          </span>
        </label>

        {error ? (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-center text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <BigButton
          disabled={busy || !natural || Boolean(error && !natural)}
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
