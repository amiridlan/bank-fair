import type { Qualification } from '../../../core/models';

/**
 * One visual line of a PDF, with enough layout to tell a heading from a body
 * line and a sidebar from the main column.
 */
export interface TextLine {
  readonly text: string;
  /** Left edge, in PDF user units from the left of the page. */
  readonly x: number;
  /** Baseline, in PDF user units from the BOTTOM of the page. */
  readonly y: number;
  /** Rendered height of the glyphs, which stands in for font size. */
  readonly size: number;
  readonly page: number;
}

/**
 * What an import found. Every field is nullable on purpose: a field it is not
 * sure about is left empty for the person to fill, never guessed (docs/08
 * S-D6). `skills` is empty rather than null for the same reason — an empty
 * list adds nothing to the form.
 */
export interface ImportedProfile {
  readonly fullName: string | null;
  readonly headline: string | null;
  readonly university: string | null;
  readonly fieldOfStudy: string | null;
  readonly qualification: Qualification | null;
  readonly graduationYear: number | null;
  readonly skills: readonly string[];
}

export const EMPTY_PROFILE: ImportedProfile = {
  fullName: null,
  headline: null,
  university: null,
  fieldOfStudy: null,
  qualification: null,
  graduationYear: null,
  skills: [],
};

/**
 * Headings LinkedIn's PDF export uses. Matched case-insensitively and exactly,
 * so a line that merely contains the word (a job title of "Education Officer")
 * is not mistaken for a section break.
 */
const SECTION_HEADINGS = [
  'contact',
  'top skills',
  'skills',
  'languages',
  'certifications',
  'honors-awards',
  'honors & awards',
  'publications',
  'summary',
  'experience',
  'education',
  'projects',
  'interests',
  'volunteering',
  'volunteer experience',
  'references',
] as const;

/** Words that mean "this is a person's name" is wrong. */
const NOT_A_NAME = /^(page \d|www\.|https?:|linkedin\.com|curriculum vitae|resum[eé]|contact)/i;

/**
 * A contact line, not a headline. A CV usually puts the email and phone
 * directly under the name, exactly where a headline would be, and taking it
 * would fill someone's public headline with their phone number — the one
 * field employers read first, and the one the masking rules keep private.
 */
const CONTACT_LINE = /@|\+?\d[\d\s()+-]{6,}/;

const QUALIFICATION_PATTERNS: readonly (readonly [RegExp, Qualification])[] = [
  [/\b(ph\.?\s?d|doctor(ate|al)?)\b/i, 'phd'],
  [/\b(master'?s?|m\.?sc|m\.?eng|m\.?b\.?a|magister)\b/i, 'masters'],
  [/\b(bachelor'?s?|b\.?sc|b\.?eng|b\.?a\b|degree|sarjana muda)\b/i, 'degree'],
  [/\b(diploma|dip\.)\b/i, 'diploma'],
];

function normalise(text: string): string {
  // PDF text carries non-breaking and thin spaces that break every later match.
  return text.replace(/[\u00A0\u2000-\u200B]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Takes the text, not the line: a name candidate is checked before it is one. */
function headingName(text: string): string {
  return normalise(text).toLowerCase().replace(/[:\s]+$/, '');
}

function isHeading(text: string): boolean {
  return SECTION_HEADINGS.includes(headingName(text) as (typeof SECTION_HEADINGS)[number]);
}

/**
 * Lines in reading order: page, then down the page, then left to right.
 *
 * PDF y grows upwards, so "down the page" is descending y. Baselines of one
 * visual line wobble by a fraction of a point, hence the tolerance.
 */
export function inReadingOrder(lines: readonly TextLine[]): readonly TextLine[] {
  return [...lines].sort(
    (a, b) => a.page - b.page || (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x),
  );
}

/**
 * LinkedIn's export is two columns: a narrow sidebar (Contact, Top Skills,
 * Languages) and the main column with the name, summary and education.
 *
 * The split is found from the data rather than hard-coded at some x: the page
 * width is not fixed, and a CV that is not LinkedIn's has no sidebar at all.
 * If there is no clear gap, everything counts as the main column, which is the
 * right answer for an ordinary one-column CV.
 */
export function splitColumns(lines: readonly TextLine[]): {
  sidebar: readonly TextLine[];
  main: readonly TextLine[];
} {
  const firstPage = lines.filter((line) => line.page === 1);
  if (firstPage.length === 0) {
    return { sidebar: [], main: lines };
  }

  const left = Math.min(...firstPage.map((line) => line.x));
  const right = Math.max(...firstPage.map((line) => line.x));
  const boundary = left + (right - left) * 0.35;

  const nearLeft = firstPage.filter((line) => line.x < boundary);
  const nearRight = firstPage.filter((line) => line.x >= boundary);

  // A real sidebar holds a meaningful share of the page. Anything less is an
  // indented line in a single-column document.
  const looksTwoColumn =
    nearLeft.length >= 4 && nearRight.length >= 4 && right - left > 100;
  if (!looksTwoColumn) {
    return { sidebar: [], main: lines };
  }

  return {
    sidebar: nearLeft,
    main: lines.filter((line) => line.page > 1 || line.x >= boundary),
  };
}

/** The lines under a heading, up to the next heading. */
function section(lines: readonly TextLine[], heading: string): readonly TextLine[] {
  const start = lines.findIndex((line) => headingName(line.text) === heading);
  if (start === -1) {
    return [];
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => isHeading(line.text));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The name is the largest text in the main column — a layout fact rather than
 * a string match, so it survives LinkedIn changing its wording, and works on
 * an ordinary CV with a name at the top.
 */
function findName(main: readonly TextLine[]): TextLine | null {
  const candidates = main
    .filter((line) => line.page === 1)
    .map((line) => ({ line, text: normalise(line.text) }))
    .filter(
      ({ text }) =>
        text.length >= 3 &&
        text.length <= 60 &&
        !NOT_A_NAME.test(text) &&
        !isHeading(text) &&
        // A name has no digits and is not a sentence.
        !/\d/.test(text) &&
        !text.includes('@'),
    );

  if (candidates.length === 0) {
    return null;
  }

  const largest = Math.max(...candidates.map(({ line }) => line.size));
  // Ties go to the highest on the page.
  const winners = candidates.filter(({ line }) => line.size >= largest - 0.5);
  const winner = winners.reduce((best, entry) => (entry.line.y > best.line.y ? entry : best));

  // If the largest text is no larger than the body, there is no name-shaped
  // line here and a guess would be worse than nothing.
  const bodySize = median(main.map((line) => line.size));
  return winner.line.size > bodySize * 1.2 ? winner.line : null;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The line directly beneath the name, if it reads like a headline. */
function findHeadline(main: readonly TextLine[], name: TextLine | null): string | null {
  if (!name) {
    return null;
  }

  const below = main
    .filter((line) => line.page === 1 && line.y < name.y && name.y - line.y < name.size * 3)
    .sort((a, b) => b.y - a.y);

  for (const line of below) {
    const text = normalise(line.text);
    if (text.length < 3 || isHeading(text) || NOT_A_NAME.test(text) || CONTACT_LINE.test(text)) {
      continue;
    }
    return text.slice(0, 120);
  }
  return null;
}

/**
 * LinkedIn writes education as an institution line followed by a degree line:
 * `Bachelor of Computer Science, Computer Science · (2022 - 2026)`.
 */
function findEducation(main: readonly TextLine[]): {
  university: string | null;
  fieldOfStudy: string | null;
  qualification: Qualification | null;
  graduationYear: number | null;
} {
  const lines = section(main, 'education').map((line) => normalise(line.text)).filter(Boolean);
  if (lines.length === 0) {
    return { university: null, fieldOfStudy: null, qualification: null, graduationYear: null };
  }

  const university = lines[0].length <= 120 ? lines[0] : null;
  const detail = lines.slice(1, 4).join(' ');

  const qualification =
    QUALIFICATION_PATTERNS.find(([pattern]) => pattern.test(detail))?.[1] ?? null;

  // The field sits between the first comma and the separator LinkedIn uses.
  const field = /,\s*([^,·(]+?)\s*(?:·|\(|$)/.exec(detail)?.[1];
  const fieldOfStudy = field && field.length >= 2 && field.length <= 80 ? field.trim() : null;

  return {
    university,
    fieldOfStudy,
    qualification,
    graduationYear: findGraduationYear(detail),
  };
}

/**
 * The later year of a range, which is the one someone graduates in.
 *
 * Bounded to a plausible window so a street address or a company founded in
 * 1965 cannot become a graduation year.
 */
function findGraduationYear(text: string, thisYear = new Date().getFullYear()): number | null {
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)]
    .map((match) => Number(match[0]))
    .filter((year) => year >= thisYear - 60 && year <= thisYear + 10);

  return years.length === 0 ? null : Math.max(...years);
}

/**
 * Skills come from LinkedIn's "Top Skills" block, or a "Skills" heading on an
 * ordinary CV. A CV often comma-separates them on one line; LinkedIn puts one
 * per line. Both are handled.
 */
function findSkills(all: readonly TextLine[]): readonly string[] {
  const lines = section(all, 'top skills').length
    ? section(all, 'top skills')
    : section(all, 'skills');

  const skills = lines
    .flatMap((line) => normalise(line.text).split(/[,;•|]/))
    .map((skill) => skill.trim())
    .filter((skill) => skill.length >= 2 && skill.length <= 40 && !/^\d+$/.test(skill));

  // De-duplicate case-insensitively, keeping the first spelling, and cap the
  // list: a form with sixty chips is not a form anyone will check.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const skill of skills) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(skill);
    }
  }
  return unique.slice(0, 20);
}

/**
 * Reads a profile out of the lines of a PDF.
 *
 * Pure, and deliberately separate from pdf.js: the parsing is the part that
 * will be wrong and need changing, and it is worth being able to test it
 * against a layout without a PDF in the loop.
 */
export function parseProfile(lines: readonly TextLine[]): ImportedProfile {
  const ordered = inReadingOrder(lines);
  if (ordered.length === 0) {
    return EMPTY_PROFILE;
  }

  const { sidebar, main } = splitColumns(ordered);
  const name = findName(main);
  const education = findEducation(main);

  // Skills live in the sidebar on LinkedIn's layout and in the body on a CV.
  const skills = findSkills(sidebar).length ? findSkills(sidebar) : findSkills(ordered);

  return {
    fullName: name ? normalise(name.text) : null,
    headline: findHeadline(main, name),
    university: education.university,
    fieldOfStudy: education.fieldOfStudy,
    qualification: education.qualification,
    graduationYear: education.graduationYear,
    skills,
  };
}
