"use client";
/**
 * Rendering + encoding for the Motion lab: SVG frame → canvas, canvas frames →
 * MP4/WebM (mediabunny + WebCodecs), GIF (gifenc) or a PNG-sequence zip, plus a
 * requestAnimationFrame preview loop. Heavy libraries are imported on demand.
 */
import { canvasToBlob, svgToImage } from "@/lib/raster";
import { clamp01 } from "./easing";
import type { FrameDirectives } from "./presets";
import { applyDirectivesToSvg, parseViewBox, type PreparedSvg } from "./timeline";

/* ───────────────────────────── frames ───────────────────────────── */

export interface RenderFrameOptions {
  /** Logo SVG (ideally the `prepared.svg`) */
  svg: string;
  directives: FrameDirectives;
  width: number;
  height: number;
  /** CSS colour, or null / "transparent" for no background */
  background?: string | null;
  /** Fraction of the shorter canvas edge kept clear around the logo (0..0.45) */
  padding?: number;
  prepared?: PreparedSvg;
  colors?: { primary: string; accent: string };
  /** Reuse a canvas (e.g. the visible preview canvas) instead of creating one */
  canvas?: HTMLCanvasElement;
}

const FRAME_MARGIN = 0.5;

export async function renderFrame(o: RenderFrameOptions): Promise<HTMLCanvasElement> {
  const width = Math.max(1, Math.round(o.width));
  const height = Math.max(1, Math.round(o.height));
  const canvas = o.canvas ?? document.createElement("canvas");
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const box = o.prepared ?? parseViewBox(o.svg);
  const pad = clamp01(o.padding ?? 0.12) * Math.min(width, height);
  const availW = Math.max(1, width - 2 * pad);
  const availH = Math.max(1, height - 2 * pad);
  const k = Math.min(availW / box.width, availH / box.height);
  const logoW = box.width * k;
  const logoH = box.height * k;
  const ox = (width - logoW) / 2;
  const oy = (height - logoH) / 2;
  const fullW = box.width * (1 + 2 * FRAME_MARGIN) * k;
  const fullH = box.height * (1 + 2 * FRAME_MARGIN) * k;

  const frameSvg = applyDirectivesToSvg(o.svg, o.directives, { prepared: o.prepared, primary: o.colors?.primary, accent: o.colors?.accent, margin: FRAME_MARGIN });
  const img = await svgToImage(frameSvg, Math.max(1, Math.ceil(fullW)), Math.max(1, Math.ceil(fullH)));

  ctx.clearRect(0, 0, width, height);
  const bgOpacity = clamp01(o.directives.background?.opacity ?? 1);
  if (o.background && o.background !== "transparent" && bgOpacity > 0) {
    ctx.globalAlpha = bgOpacity;
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(img, ox - box.width * FRAME_MARGIN * k, oy - box.height * FRAME_MARGIN * k, fullW, fullH);
  return canvas;
}

/* ───────────────────────────── encoding ───────────────────────────── */

export type FrameSource = AsyncIterable<HTMLCanvasElement> | ((index: number) => Promise<HTMLCanvasElement>);

async function* iterateFrames(frames: FrameSource, count?: number): AsyncGenerator<HTMLCanvasElement> {
  if (typeof frames === "function") {
    const n = Math.max(0, Math.floor(count ?? 0));
    for (let i = 0; i < n; i++) yield await frames(i);
  } else {
    for await (const f of frames) yield f;
  }
}

function abortError(): Error {
  return new DOMException("Export cancelled", "AbortError");
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : e instanceof Error && e.name === "AbortError";
}

export type VideoFormat = "mp4" | "webm";
export type VideoCodecId = "avc" | "hevc" | "vp9" | "av1" | "vp8" | "prores";

const MP4_CODECS: VideoCodecId[] = ["avc", "av1", "vp9"];
const WEBM_CODECS: VideoCodecId[] = ["vp9", "vp8", "av1"];

export const CODEC_LABELS: Record<string, string> = { avc: "H.264", hevc: "HEVC", vp9: "VP9", vp8: "VP8", av1: "AV1", prores: "ProRes" };
export const codecLabel = (codec: string | null | undefined) => (codec ? CODEC_LABELS[codec] ?? codec.toUpperCase() : "—");

export interface VideoSupport {
  webcodecs: boolean;
  mp4: VideoCodecId | null;
  webm: VideoCodecId | null;
}

/** Which codecs this browser can encode for each container (WebCodecs + mediabunny). */
export async function probeVideoSupport(width = 1920, height = 1080): Promise<VideoSupport> {
  if (typeof window === "undefined" || !("VideoEncoder" in window)) return { webcodecs: false, mp4: null, webm: null };
  try {
    const mb = await import("mediabunny");
    const [mp4, webm] = await Promise.all([mb.getFirstEncodableVideoCodec(MP4_CODECS, { width, height }), mb.getFirstEncodableVideoCodec(WEBM_CODECS, { width, height })]);
    return { webcodecs: true, mp4, webm };
  } catch {
    return { webcodecs: true, mp4: null, webm: null };
  }
}

export interface EncodeVideoOptions {
  frames: FrameSource;
  /** Required when `frames` is a function */
  count?: number;
  fps: number;
  width: number;
  height: number;
  format: VideoFormat;
  quality?: "medium" | "high" | "very-high";
  /** Keep alpha (WebM only) */
  transparent?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface EncodedVideo {
  blob: Blob;
  codec: VideoCodecId;
  mime: string;
  ext: string;
}

/** Encodes canvas frames into MP4 or WebM with the first codec the browser can encode. */
export async function encodeVideo(o: EncodeVideoOptions): Promise<EncodedVideo> {
  if (typeof window === "undefined" || !("VideoEncoder" in window)) {
    throw new Error("WebCodecs (VideoEncoder) is not available in this browser — export a GIF or PNG sequence instead.");
  }
  const mb = await import("mediabunny");
  const width = Math.max(2, Math.round(o.width / 2) * 2);
  const height = Math.max(2, Math.round(o.height / 2) * 2);
  const candidates = o.format === "mp4" ? MP4_CODECS : WEBM_CODECS;
  const codec = await mb.getFirstEncodableVideoCodec(candidates, { width, height });
  if (!codec) throw new Error(`This browser cannot encode any ${o.format.toUpperCase()} video codec (${candidates.map(codecLabel).join(", ")}).`);
  const total = typeof o.frames === "function" ? Math.max(0, Math.floor(o.count ?? 0)) : undefined;
  const fps = Math.max(1, o.fps);
  const mime = o.format === "mp4" ? "video/mp4" : "video/webm";

  const run = async (alpha: "keep" | "discard"): Promise<Blob> => {
    const format = o.format === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat();
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format, target });
    const work = document.createElement("canvas");
    work.width = width;
    work.height = height;
    const wctx = work.getContext("2d");
    if (!wctx) throw new Error("Canvas 2D context unavailable");
    const source = new mb.CanvasSource(work, { codec, quality: new mb.Quality(o.quality ?? "high"), alpha, keyFrameInterval: 1 });
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();
    try {
      let i = 0;
      for await (const frame of iterateFrames(o.frames, o.count)) {
        if (o.signal?.aborted) throw abortError();
        wctx.clearRect(0, 0, width, height);
        wctx.drawImage(frame, 0, 0, width, height);
        await source.add(i / fps, 1 / fps);
        i++;
        o.onProgress?.(i, total ?? i);
      }
      if (i === 0) throw new Error("No frames to encode");
      source.close();
      await output.finalize();
    } catch (e) {
      await output.cancel().catch(() => undefined);
      throw e;
    }
    const buffer = target.buffer;
    if (!buffer) throw new Error("Encoder produced no data");
    return new Blob([buffer], { type: mime });
  };

  const wantAlpha = Boolean(o.transparent) && o.format === "webm";
  let blob: Blob;
  try {
    blob = await run(wantAlpha ? "keep" : "discard");
  } catch (e) {
    if (!wantAlpha || isAbortError(e)) throw e;
    blob = await run("discard"); // alpha side-data unsupported by this encoder → opaque fallback
  }
  return { blob, codec, mime, ext: o.format };
}

export interface EncodeGifOptions {
  frames: FrameSource;
  count?: number;
  fps: number;
  width: number;
  height: number;
  /** Longest edge is downscaled to this many pixels (GIFs get big fast) */
  maxSize?: number;
  transparent?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Encodes frames to an animated GIF with a per-frame 256-colour palette. */
export async function encodeGif(o: EncodeGifOptions): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const maxSize = o.maxSize ?? 720;
  const scale = Math.min(1, maxSize / Math.max(o.width, o.height));
  const gw = Math.max(1, Math.round(o.width * scale));
  const gh = Math.max(1, Math.round(o.height * scale));
  const total = typeof o.frames === "function" ? Math.max(0, Math.floor(o.count ?? 0)) : undefined;
  // Browsers treat delays under 20 ms as 100 ms, so 60 fps sources are capped at 50 fps.
  const delay = Math.max(20, Math.round(1000 / Math.max(1, o.fps)));
  const work = document.createElement("canvas");
  work.width = gw;
  work.height = gh;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) throw new Error("Canvas 2D context unavailable");
  const gif = GIFEncoder();
  const format = o.transparent ? "rgba4444" : "rgb565";
  let i = 0;
  for await (const frame of iterateFrames(o.frames, o.count)) {
    if (o.signal?.aborted) throw abortError();
    wctx.clearRect(0, 0, gw, gh);
    wctx.drawImage(frame, 0, 0, gw, gh);
    const rgba = wctx.getImageData(0, 0, gw, gh).data;
    const palette = quantize(rgba, 256, o.transparent ? { format, oneBitAlpha: true } : { format });
    const index = applyPalette(rgba, palette, format);
    const transparentIndex = o.transparent ? palette.findIndex((p) => p.length > 3 && p[3] === 0) : -1;
    gif.writeFrame(index, gw, gh, { palette, delay, repeat: 0, first: i === 0, transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex) });
    i++;
    o.onProgress?.(i, total ?? i);
  }
  if (i === 0) throw new Error("No frames to encode");
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}

export interface EncodePngSequenceOptions {
  frames: FrameSource;
  count?: number;
  /** File name prefix inside the zip */
  prefix?: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Zips every frame as a numbered PNG (`prefix_0001.png` …). */
export async function encodePngSequence(o: EncodePngSequenceOptions): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const total = typeof o.frames === "function" ? Math.max(0, Math.floor(o.count ?? 0)) : undefined;
  const prefix = o.prefix ?? "frame";
  let i = 0;
  for await (const frame of iterateFrames(o.frames, o.count)) {
    if (o.signal?.aborted) throw abortError();
    const blob = await canvasToBlob(frame, "image/png");
    zip.file(`${prefix}_${String(i + 1).padStart(4, "0")}.png`, blob);
    i++;
    o.onProgress?.(i, total ?? i);
  }
  if (i === 0) throw new Error("No frames to export");
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

/* ───────────────────────────── preview loop ───────────────────────────── */

export interface PreviewSnapshot {
  time: number;
  playing: boolean;
  duration: number;
}

export interface PreviewLoop {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seeks (seconds) and redraws; pauses when `pause` is true */
  seek: (time: number, pause?: boolean) => void;
  setDuration: (seconds: number) => void;
  /** Draws the current time again (after the draw function or its inputs changed) */
  redraw: () => void;
  /** Replaces the draw function (e.g. when the timeline or canvas changes) */
  setDraw: (draw: PreviewLoopOptions["draw"]) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PreviewSnapshot;
}

export interface PreviewLoopOptions {
  /** Draws the frame for a time in seconds. Slow draws are never overlapped; frames are dropped instead. */
  draw: (time: number) => Promise<void> | void;
  duration: number;
  loop?: boolean;
}

/** requestAnimationFrame-driven playback clock that calls `draw(time)` at most once per frame. */
export function previewLoop(o: PreviewLoopOptions): PreviewLoop {
  let time = 0;
  let playing = false;
  let drawFn = o.draw;
  let duration = Math.max(0.01, o.duration);
  const loop = o.loop ?? true;
  let raf = 0;
  let last = 0;
  let drawing = false;
  let dirty = true;
  let snapshot: PreviewSnapshot = { time, playing, duration };
  const listeners = new Set<() => void>();

  const notify = () => {
    snapshot = { time, playing, duration };
    listeners.forEach((l) => l());
  };
  const drawNow = async () => {
    if (drawing) {
      dirty = true;
      return;
    }
    drawing = true;
    dirty = false;
    try {
      await drawFn(time);
    } catch {
      // A failed frame should never kill the loop; the next frame retries.
    } finally {
      drawing = false;
    }
    if (dirty && !playing) void drawNow();
  };
  const tick = (now: number) => {
    if (!playing) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    time += dt;
    if (time >= duration) {
      if (loop) time = time % duration;
      else {
        time = duration;
        playing = false;
      }
    }
    void drawNow();
    notify();
    if (playing) raf = requestAnimationFrame(tick);
  };
  const stopRaf = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  return {
    play: () => {
      if (playing) return;
      if (!loop && time >= duration) time = 0;
      playing = true;
      last = 0;
      raf = requestAnimationFrame(tick);
      notify();
    },
    pause: () => {
      if (!playing) return;
      playing = false;
      stopRaf();
      notify();
    },
    toggle() {
      if (playing) this.pause();
      else this.play();
    },
    seek: (t, pause = true) => {
      if (pause && playing) {
        playing = false;
        stopRaf();
      }
      time = Math.min(duration, Math.max(0, t));
      void drawNow();
      notify();
    },
    setDuration: (s) => {
      duration = Math.max(0.01, s);
      if (time > duration) time = loop ? time % duration : duration;
      notify();
    },
    redraw: () => {
      if (!playing) void drawNow();
    },
    setDraw: (fn) => {
      drawFn = fn;
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => snapshot,
  };
}
