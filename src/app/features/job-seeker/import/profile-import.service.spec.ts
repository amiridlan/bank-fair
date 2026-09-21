import { TestBed } from '@angular/core/testing';

import { MAX_FILE_BYTES, ProfileImportService, groupIntoLines } from './profile-import.service';

/** A pdf.js text run: transform is [a, b, c, d, x, y]. */
function run(str: string, x: number, y: number, width: number, height = 9) {
  return { str, transform: [height, 0, 0, height, x, y], width, height };
}

describe('groupIntoLines', () => {
  it('puts runs sharing a baseline on one line', () => {
    const lines = groupIntoLines(
      [run('Universiti', 72, 700, 48), run('Malaya', 124, 700, 34), run('Education', 72, 680, 46)],
      1,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Universiti Malaya');
  });

  it('does not rejoin a word that kerning split in two', () => {
    // The two runs touch, so there was no space on the page.
    const lines = groupIntoLines([run('Univer', 72, 700, 30), run('siti', 102, 700, 16)], 1);

    expect(lines[0].text).toBe('Universiti');
  });

  it('keeps a space the producer already emitted', () => {
    const lines = groupIntoLines([run('Data ', 72, 700, 26), run('Science', 98, 700, 34)], 1);

    expect(lines[0].text).toBe('Data Science');
  });

  it('tolerates a baseline that wobbles by under a point', () => {
    const lines = groupIntoLines([run('Nurul', 72, 700, 26), run('Huda', 100, 699.4, 26)], 1);

    expect(lines).toHaveLength(1);
  });

  it('takes the tallest run as the line size, so a name is not shrunk by a comma', () => {
    const lines = groupIntoLines([run('Aisyah', 72, 700, 40, 18), run(',', 112, 700, 3, 9)], 1);

    expect(lines[0].size).toBe(18);
  });

  it('drops whitespace-only runs and marked content', () => {
    const lines = groupIntoLines([run('   ', 72, 700, 10), { type: 'beginMarkedContent' }], 1);

    expect(lines).toHaveLength(0);
  });

  it('falls back to the transform when a producer reports no height', () => {
    const lines = groupIntoLines([{ str: 'x', transform: [11, 0, 0, 11, 72, 700], width: 6, height: 0 }], 1);

    expect(lines[0].size).toBe(11);
  });
});

describe('ProfileImportService', () => {
  let service: ProfileImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfileImportService);
  });

  afterEach(() => TestBed.resetTestingModule());

  function file(name: string, type: string, size = 100): File {
    const handle = new File([new Uint8Array(1)], name, { type });
    // A real multi-megabyte buffer in a test buys nothing.
    Object.defineProperty(handle, 'size', { value: size });
    return handle;
  }

  it('refuses a file that is not a PDF', async () => {
    const result = await service.import(file('cv.docx', 'application/msword'));

    expect(result).toEqual({ ok: false, failure: { kind: 'not-pdf' } });
  });

  it('accepts a .pdf whose type the browser left empty', async () => {
    // Dragged from some sources, a File carries no MIME type at all. That is
    // not a reason to refuse it — it is a reason to let pdf.js decide.
    const result = await service.import(file('cv.pdf', ''));

    expect(result.ok === false && result.failure.kind).not.toBe('not-pdf');
  });

  it('refuses a file over the size cap before reading a byte of it', async () => {
    const result = await service.import(file('huge.pdf', 'application/pdf', MAX_FILE_BYTES + 1));

    expect(result).toEqual({ ok: false, failure: { kind: 'too-large', maxBytes: MAX_FILE_BYTES } });
  });

  it('reports an unreadable file rather than throwing', async () => {
    // One byte that is not a PDF. Whatever pdf.js does with it, the caller
    // gets an outcome it can render, never an exception.
    const result = await service.import(file('broken.pdf', 'application/pdf'));

    expect(result.ok).toBe(false);
  });
});

describe('groupIntoLines — two-column pages', () => {
  it('does not weld a sidebar entry to the main column beside it', () => {
    // LinkedIn's export is two columns, so this happens on nearly every page.
    // Grouping by baseline alone produced "SQL Summary".
    const lines = groupIntoLines([run('SQL', 40, 690, 18), run('Summary', 220, 690, 44, 13)], 1);

    expect(lines.map((line) => line.text)).toEqual(['SQL', 'Summary']);
  });

  it('gives each side its own x, so the columns can still be told apart', () => {
    const lines = groupIntoLines([run('Python', 40, 690, 30), run('Experience', 220, 690, 52)], 1);

    expect(lines[0].x).toBe(40);
    expect(lines[1].x).toBe(220);
  });

  it('splits a right-aligned date off the title it sits beside', () => {
    const lines = groupIntoLines(
      [run('Data Intern', 72, 600, 50), run('June 2025 - August 2025', 420, 600, 100)],
      1,
    );

    expect(lines).toHaveLength(2);
  });

  it('still joins ordinary word spacing', () => {
    // A space is a few points, nowhere near the threshold.
    const lines = groupIntoLines([run('Universiti', 72, 700, 48), run('Malaya', 124, 700, 34)], 1);

    expect(lines).toHaveLength(1);
  });
});
