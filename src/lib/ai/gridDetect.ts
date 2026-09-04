// ============================================================
// UXLLY — Grid / Moodboard Detector
// A reference upload can be a single design OR a contact-sheet
// style grid of many distinct layout examples (like a Pinterest
// export or a mockup showcase). This heuristically detects grid
// structure by finding near-uniform "gutter" rows/columns and
// slices the image into individual cells so each layout gets
// analyzed on its own instead of as one confusing composite.
//
// Best-effort: if no confident grid is found, returns the image
// untouched as a single "cell" — callers should treat that as
// the normal single-reference case.
// ============================================================

import sharp from "sharp";

export interface GridSliceResult {
  isGrid: boolean;
  rows: number;
  cols: number;
  cells: string[]; // base64 data URLs, row-major order
}

// ==================== Tuning Constants ====================

const GUTTER_STDDEV_THRESHOLD = 10; // how "flat" a row/col must be to count as a gutter
const MIN_GUTTER_RUN = 3; // consecutive uniform px (at analysis res) to count as a real gutter
const ANALYSIS_MAX_DIM = 640; // downscale target for fast pixel scanning
const MAX_CELLS = 40; // sanity cap
const MIN_CELLS = 4; // below this, it's not worth treating as a grid
const CELL_SIZE_TOLERANCE = 0.35; // coefficient of variation allowed across cell dimensions

// ==================== Detect & Slice ====================

export async function detectAndSliceGrid(dataUrl: string): Promise<GridSliceResult> {
  const single: GridSliceResult = { isGrid: false, rows: 1, cols: 1, cells: [dataUrl] };

  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const original = Buffer.from(base64, "base64");

    const meta = await sharp(original).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (!width || !height) return single;

    // Downscale for fast pixel scanning
    const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(width, height));
    const scaledW = Math.max(1, Math.round(width * scale));
    const scaledH = Math.max(1, Math.round(height * scale));

    const { data, info } = await sharp(original)
      .resize(scaledW, scaledH, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const w = info.width;
    const h = info.height;

    const rowStdDev = (y: number): number => {
      let sumR = 0, sumG = 0, sumB = 0;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2];
      }
      const meanR = sumR / w, meanG = sumG / w, meanB = sumB / w;
      let varSum = 0;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        varSum += (data[idx] - meanR) ** 2 + (data[idx + 1] - meanG) ** 2 + (data[idx + 2] - meanB) ** 2;
      }
      return Math.sqrt(varSum / (w * 3));
    };

    const colStdDev = (x: number): number => {
      let sumR = 0, sumG = 0, sumB = 0;
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * channels;
        sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2];
      }
      const meanR = sumR / h, meanG = sumG / h, meanB = sumB / h;
      let varSum = 0;
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * channels;
        varSum += (data[idx] - meanR) ** 2 + (data[idx + 1] - meanG) ** 2 + (data[idx + 2] - meanB) ** 2;
      }
      return Math.sqrt(varSum / (h * 3));
    };

    const uniformRows: boolean[] = [];
    for (let y = 0; y < h; y++) uniformRows.push(rowStdDev(y) < GUTTER_STDDEV_THRESHOLD);

    const uniformCols: boolean[] = [];
    for (let x = 0; x < w; x++) uniformCols.push(colStdDev(x) < GUTTER_STDDEV_THRESHOLD);

    const findBoundaries = (uniform: boolean[]): number[] => {
      const boundaries: number[] = [];
      let runStart = -1;
      for (let i = 0; i < uniform.length; i++) {
        if (uniform[i]) {
          if (runStart === -1) runStart = i;
        } else {
          if (runStart !== -1 && i - runStart >= MIN_GUTTER_RUN) {
            boundaries.push(Math.round((runStart + i - 1) / 2));
          }
          runStart = -1;
        }
      }
      if (runStart !== -1 && uniform.length - runStart >= MIN_GUTTER_RUN) {
        boundaries.push(Math.round((runStart + uniform.length - 1) / 2));
      }
      return boundaries;
    };

    // Ignore boundaries right at the edges — those are just image margins
    const edgeMarginY = h * 0.02;
    const edgeMarginX = w * 0.02;

    const rawRowBoundaries = findBoundaries(uniformRows).filter(
      (y) => y > edgeMarginY && y < h - edgeMarginY
    );
    const rawColBoundaries = findBoundaries(uniformCols).filter(
      (x) => x > edgeMarginX && x < w - edgeMarginX
    );

    if (rawRowBoundaries.length === 0 && rawColBoundaries.length === 0) {
      return single; // no internal structure found — treat as a normal single reference
    }

    const rowLinesRaw = [0, ...rawRowBoundaries, h].sort((a, b) => a - b);
    const colLinesRaw = [0, ...rawColBoundaries, w].sort((a, b) => a - b);

    // Trim a wildly-uneven edge row/col (a footer caption bar, credit line,
    // or header strip) rather than rejecting the whole grid because one
    // edge doesn't match the others. Only trims the outermost band, and
    // only if it's genuinely an outlier vs. the rest.
    const trimOutlierEdges = (lines: number[]): number[] => {
      let arr = [...lines];
      const median = (nums: number[]): number => {
        const s = [...nums].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      };
      // Only ever trim once per side — keep at least a 2x2 grid worth of lines
      if (arr.length > 3) {
        const sizes = arr.slice(1).map((v, i) => v - arr[i]);
        const med = median(sizes);
        if (med > 0 && Math.abs(sizes[0] - med) / med > 0.5) {
          arr = arr.slice(1); // drop an outlier leading band
        }
      }
      if (arr.length > 3) {
        const sizes = arr.slice(1).map((v, i) => v - arr[i]);
        const med = median(sizes);
        if (med > 0 && Math.abs(sizes[sizes.length - 1] - med) / med > 0.5) {
          arr = arr.slice(0, -1); // drop an outlier trailing band
        }
      }
      return arr;
    };

    const rowLines = trimOutlierEdges(rowLinesRaw);
    const colLines = trimOutlierEdges(colLinesRaw);

    const rows = rowLines.length - 1;
    const cols = colLines.length - 1;
    const cellCount = rows * cols;

    if (cellCount < MIN_CELLS || cellCount > MAX_CELLS) return single;

    // Validate roughly-equal cell sizes to reject false-positive grids
    const coeffVar = (arr: number[]): number => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (mean === 0) return 999;
      const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
      return Math.sqrt(variance) / mean;
    };

    const rowHeights = Array.from({ length: rows }, (_, i) => rowLines[i + 1] - rowLines[i]);
    const colWidths = Array.from({ length: cols }, (_, i) => colLines[i + 1] - colLines[i]);

    if (rows > 1 && coeffVar(rowHeights) > CELL_SIZE_TOLERANCE) return single;
    if (cols > 1 && coeffVar(colWidths) > CELL_SIZE_TOLERANCE) return single;

    // Passed validation — slice the ORIGINAL full-resolution image
    const invScale = 1 / scale;
    const cells: string[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const top = Math.round(rowLines[r] * invScale);
        const bottom = Math.round(rowLines[r + 1] * invScale);
        const left = Math.round(colLines[c] * invScale);
        const right = Math.round(colLines[c + 1] * invScale);

        const cellW = Math.max(1, Math.min(width - left, right - left));
        const cellH = Math.max(1, Math.min(height - top, bottom - top));

        try {
          const cellBuffer = await sharp(original)
            .extract({ left, top, width: cellW, height: cellH })
            .jpeg({ quality: 88 })
            .toBuffer();
          cells.push(`data:image/jpeg;base64,${cellBuffer.toString("base64")}`);
        } catch (err) {
          console.error("[GRID DETECT] Failed to extract cell", r, c, err);
        }
      }
    }

    if (cells.length < MIN_CELLS) return single;

    console.log(`[GRID DETECT] Detected ${rows}x${cols} grid (${cells.length} cells)`);
    return { isGrid: true, rows, cols, cells };
  } catch (err) {
    console.error("[GRID DETECT] Failed, treating as single reference:", err);
    return single;
  }
}
