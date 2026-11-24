// Hanya untuk browser: pemeriksaan kualitas gambar (OpenCV.js, cadangan: canvas) dan OCR (Tesseract.js).
// Hasilnya hanya sinyal bantu. Server memvalidasi ulang semuanya dan TIDAK menganggapnya bukti keaslian.
import { supabase } from "@/integrations/supabase/client";
import type { ImageMetrics } from "@/lib/student";

/**
 * Dimuat hanya di halaman verifikasi, dari server SENDIRI (public/vendor), bukan dari situs pihak ketiga: skrip yang
 * dimuat berjalan di origin yang sama dengan sesi login. Unduh sekali dengan `node scripts/fetch-opencv.mjs`.
 * Bila berkas tidak ada atau gagal dimuat, dipakai perhitungan canvas yang setara (hasil ketajaman sama).
 */
const OPENCV_URL = "/vendor/opencv-4.10.0.js";
const METRIC_SIDE = 1000; // ukuran tetap supaya ambang ketajaman konsisten
const OCR_SIDE = 1800;

export async function renderCanvas(file: Blob, maxSide: number): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const out = { canvas, width: bmp.width, height: bmp.height };
  bmp.close?.();
  return out;
}

let cvPromise: Promise<any | null> | null = null;
export function loadOpenCv(): Promise<any | null> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.cv?.Mat) return resolve(w.cv);
    const timer = setTimeout(() => resolve(null), 25_000);
    const done = () => {
      clearTimeout(timer);
      resolve(w.cv?.Mat ? w.cv : null);
    };
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.onload = () => {
      if (w.cv?.Mat) return done();
      if (w.cv) w.cv.onRuntimeInitialized = done;
      else done();
    };
    s.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return cvPromise;
}

function canvasMetrics(canvas: HTMLCanvasElement): { sharpness: number; brightness: number } {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
    sum += g[i]!;
  }
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = g[i - w]! + g[i + w]! + g[i - 1]! + g[i + 1]! - 4 * g[i]!;
      s += v;
      s2 += v * v;
      n++;
    }
  }
  const mean = s / Math.max(1, n);
  return { sharpness: s2 / Math.max(1, n) - mean * mean, brightness: sum / g.length };
}

function opencvMetrics(cv: any, canvas: HTMLCanvasElement): { sharpness: number; brightness: number } {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const lap = new cv.Mat();
  const m = new cv.Mat();
  const sd = new cv.Mat();
  const m2 = new cv.Mat();
  const sd2 = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Laplacian(gray, lap, cv.CV_64F);
    cv.meanStdDev(lap, m, sd);
    cv.meanStdDev(gray, m2, sd2);
    return { sharpness: sd.data64F[0] ** 2, brightness: m2.data64F[0] };
  } finally {
    for (const x of [src, gray, lap, m, sd, m2, sd2]) x.delete();
  }
}

export async function measureQuality(file: File): Promise<{ metrics: ImageMetrics; engine: "opencv" | "canvas" }> {
  const { canvas, width, height } = await renderCanvas(file, METRIC_SIDE);
  const cv = await loadOpenCv();
  if (cv) {
    try {
      return { metrics: { width, height, ...opencvMetrics(cv, canvas) }, engine: "opencv" };
    } catch {
      /* jatuh ke canvas */
    }
  }
  return { metrics: { width, height, ...canvasMetrics(canvas) }, engine: "canvas" };
}

/** OCR di browser (bahasa Indonesia). Berat: modul dimuat hanya saat dipakai. */
export async function ocrImage(file: File, onProgress: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const { canvas } = await renderCanvas(file, OCR_SIDE);
  const worker = await createWorker("ind", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/** Unggah langsung ke bucket privat lewat tautan bertanda tangan dari server. */
export async function uploadToSlot(slot: { path: string; token: string }, file: File): Promise<void> {
  const { error } = await supabase.storage.from("student-docs").uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
  if (error) throw new Error("Gagal mengunggah berkas. Coba lagi.");
}
