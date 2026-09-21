import { Injectable } from '@angular/core';

import { type ImportedProfile, type TextLine, parseProfile } from './profile-parser';

/** 10 MB. A LinkedIn export is tens of kilobytes; a CV with photos, a few hundred. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Enough for any CV. A bound stops a crafted file pinning the tab. */
export const MAX_PAGES = 15;

export type ImportFailure =
  | { readonly kind: 'not-pdf' }
  | { readonly kind: 'too-large'; readonly maxBytes: number }
  | { readonly kind: 'encrypted' }
  | { readonly kind: 'no-text' }
  | { readonly kind: 'unreadable' };

export type ImportOutcome =
  | { readonly ok: true; readonly profile: ImportedProfile; readonly pages: number }
  | { readonly ok: false; readonly failure: ImportFailure };

/**
 * Turns a PDF into a profile, entirely in the browser.
 *
 * The file is never uploaded: it is read into an ArrayBuffer, parsed by
 * pdf.js in a worker, and dropped. That is the strongest privacy position
 * available to this feature and the one the UI claims (docs/08 S-D5), so it
 * must stay true — nothing here may gain a network call.
 *
 * pdf.js is reached only through `import()`. It is an order of magnitude
 * larger than the initial bundle's headroom, so it must never be pulled in by
 * a page that merely links to the import.
 */
@Injectable({ providedIn: 'root' })
export class ProfileImportService {
  async import(file: File): Promise<ImportOutcome> {
    if (!this.looksLikePdf(file)) {
      return { ok: false, failure: { kind: 'not-pdf' } };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, failure: { kind: 'too-large', maxBytes: MAX_FILE_BYTES } };
    }

    try {
      const { lines, pages } = await this.readLines(file);
      if (lines.length === 0) {
        // A scan is a picture of a CV. OCR is a different project.
        return { ok: false, failure: { kind: 'no-text' } };
      }
      return { ok: true, profile: parseProfile(lines), pages };
    } catch (error: unknown) {
      return { ok: false, failure: this.toFailure(error) };
    }
  }

  private looksLikePdf(file: File): boolean {
    // Both, because a browser leaves `type` empty for a file dragged from
    // some sources, and an extension is not evidence on its own.
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  private async readLines(file: File): Promise<{ lines: readonly TextLine[]; pages: number }> {
    const pdfjs = await import('pdfjs-dist');

    // Same-origin and served as a module: the CSP has no worker-src, so this
    // falls back to script-src 'self' (verified against the real headers).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdf-worker/pdf.worker.min.mjs',
      document.baseURI,
    ).href;

    // pdf.js 6 removed `isEvalSupported` because it no longer evaluates
    // source at all — there is no `eval(` or `new Function(` left in the
    // worker, checked against the shipped build. So `script-src 'self'` with
    // no 'unsafe-eval' is enough, which is what docs/08 flagged for verifying.
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      // This reads text and nothing else, so every capability it does not
      // need is switched off: no network prefetch, no font installation.
      disableAutoFetch: true,
      disableFontFace: true,
      useSystemFonts: false,
    });

    try {
      const doc = await task.promise;
      const lines: TextLine[] = [];
      const pages = Math.min(doc.numPages, MAX_PAGES);

      for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          lines.push(...groupIntoLines(content.items, pageNumber));
        } finally {
          page.cleanup();
        }
      }

      return { lines, pages };
    } finally {
      // Tears down the worker and releases the file's bytes. Nothing about
      // this file should outlive the parse — that is the privacy claim the
      // UI makes, and it has to be true of memory too, not just the network.
      await task.destroy();
    }
  }

  private toFailure(error: unknown): ImportFailure {
    const name = error instanceof Error ? error.name : '';
    if (name === 'PasswordException') {
      return { kind: 'encrypted' };
    }
    if (name === 'InvalidPDFException') {
      return { kind: 'not-pdf' };
    }
    return { kind: 'unreadable' };
  }
}

/** A text item as pdf.js reports it, narrowed from its marked-content sibling. */
interface PdfTextItem {
  readonly str: string;
  readonly transform: readonly number[];
  readonly height: number;
  readonly width: number;
}

/**
 * Joins the runs of one line, inserting a space only where the page has a gap.
 *
 * Neither extreme works on its own. Joining with a space breaks a word that a
 * kerning change split in two ("Univer" + "siti"); joining with nothing fuses
 * words from a producer that emits no trailing spaces. The geometry says which
 * happened: a gap wider than a fraction of the font size was a space on the
 * page, and anything tighter was one word.
 */
function joinRuns(
  runs: readonly { text: string; x: number; width: number; size: number }[],
): string {
  return runs.reduce((text, run, index) => {
    if (index === 0) {
      return run.text;
    }
    const previous = runs[index - 1];
    const gap = run.x - (previous.x + previous.width);
    const alreadySpaced = /\s$/.test(previous.text) || /^\s/.test(run.text);
    return alreadySpaced || gap <= run.size * 0.2 ? text + run.text : `${text} ${run.text}`;
  }, '');
}

function isTextItem(item: unknown): item is PdfTextItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  // pdf.js mixes text runs with marked-content markers in the same array.
  const candidate = item as Partial<Record<keyof PdfTextItem, unknown>>;
  return typeof candidate.str === 'string' && Array.isArray(candidate.transform);
}

/**
 * pdf.js reports positioned runs, not lines: a single visual line arrives as
 * several items whenever the font or spacing changes mid-word.
 *
 * Runs sharing a baseline are one line. The tolerance is in PDF points and
 * absorbs the sub-point wobble of a justified line.
 */
export function groupIntoLines(items: readonly unknown[], page: number): readonly TextLine[] {
  const runs = items
    .filter(isTextItem)
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      // transform[3] is the vertical scale; `height` is 0 for some producers.
      size: item.height || Math.abs(item.transform[3]) || 0,
      width: item.width || 0,
    }))
    .filter((run) => run.text.trim().length > 0);

  const buckets: { y: number; runs: typeof runs }[] = [];
  for (const run of runs) {
    const bucket = buckets.find((entry) => Math.abs(entry.y - run.y) <= 2);
    if (bucket) {
      bucket.runs.push(run);
    } else {
      buckets.push({ y: run.y, runs: [run] });
    }
  }

  return buckets.flatMap((bucket) =>
    splitAcrossColumns([...bucket.runs].sort((a, b) => a.x - b.x)).map((segment) => ({
      text: joinRuns(segment),
      x: Math.min(...segment.map((run) => run.x)),
      y: bucket.y,
      size: Math.max(...segment.map((run) => run.size)),
      page,
    })),
  );
}

/**
 * Breaks a baseline into separate lines wherever the page has a chasm.
 *
 * Sharing a baseline does not make two runs one line. LinkedIn's export is
 * two columns, so a sidebar entry and a body line land at the same height
 * constantly — grouping by y alone produced "SQL Summary", one of the
 * sidebar's skills welded to the main column's next heading, which corrupts
 * both columns at once.
 *
 * The threshold is relative to the font: a gap several times the glyph height
 * is not word spacing in any typesetting, it is a different column or a
 * right-aligned date.
 */
function splitAcrossColumns<T extends { x: number; width: number; size: number }>(
  runs: readonly T[],
): readonly T[][] {
  const segments: T[][] = [];
  let current: T[] = [];

  for (const run of runs) {
    const previous = current.at(-1);
    const gap = previous ? run.x - (previous.x + previous.width) : 0;

    if (previous && gap > Math.max(run.size * 5, 24)) {
      segments.push(current);
      current = [];
    }
    current.push(run);
  }

  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}
