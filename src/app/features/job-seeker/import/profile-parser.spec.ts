import { EMPTY_PROFILE, type TextLine, parseProfile, splitColumns } from './profile-parser';

let nextY = 780;

/** Builds a line. y descends automatically, mimicking a page filling downwards. */
function line(text: string, x: number, size = 9, y?: number, page = 1): TextLine {
  nextY -= size * 1.4;
  return { text, x, y: y ?? nextY, size, page };
}

beforeEach(() => (nextY = 780));

/**
 * A reconstruction of LinkedIn's "Save to PDF" layout: a narrow sidebar on the
 * left with Contact and Top Skills, and a main column with the name set large,
 * the headline under it, then Summary, Experience and Education.
 */
function linkedInExport(): TextLine[] {
  nextY = 780;
  return [
    line('Contact', 40, 10),
    line('www.linkedin.com/in/nurul-huda', 40),
    line('Top Skills', 40, 10),
    line('Python', 40),
    line('Data Analysis', 40),
    line('SQL', 40),
    line('Languages', 40, 10),
    line('Bahasa Malaysia', 40),
    line('English', 40),

    line('Nurul Huda binti Ismail', 220, 20, 760),
    line('Final-year Data Science student seeking a graduate analyst role', 220, 10, 735),
    line('Kuala Lumpur, Malaysia', 220, 9, 722),
    line('Summary', 220, 12, 690),
    line('Interested in analytics and machine learning.', 220, 9, 675),
    line('Experience', 220, 12, 640),
    line('Bumi Analytics Sdn Bhd', 220, 10, 625),
    line('Data Intern', 220, 9, 612),
    line('June 2025 - August 2025', 220, 9, 599),
    line('Education', 220, 12, 560),
    line('Universiti Teknologi Malaysia', 220, 10, 545),
    line('Bachelor of Science, Data Science · (2022 - 2026)', 220, 9, 532),
  ];
}

describe('parseProfile — LinkedIn export', () => {
  it('reads the whole profile', () => {
    const result = parseProfile(linkedInExport());

    expect(result).toEqual({
      fullName: 'Nurul Huda binti Ismail',
      headline: 'Final-year Data Science student seeking a graduate analyst role',
      university: 'Universiti Teknologi Malaysia',
      fieldOfStudy: 'Data Science',
      qualification: 'degree',
      graduationYear: 2026,
      skills: ['Python', 'Data Analysis', 'SQL'],
    });
  });

  it('finds the name by size, not by position', () => {
    // The name is whatever is set largest, so LinkedIn moving it, or a CV
    // putting a letterhead above it, does not break the parse.
    const lines = linkedInExport();
    lines.unshift({ text: 'CURRICULUM VITAE', x: 220, y: 800, size: 9, page: 1 });

    expect(parseProfile(lines).fullName).toBe('Nurul Huda binti Ismail');
  });

  it('takes the later year of a range', () => {
    expect(parseProfile(linkedInExport()).graduationYear).toBe(2026);
  });

  it('ignores the sidebar when looking for a name', () => {
    // 'Bahasa Malaysia' is name-shaped. Only the main column is considered.
    const result = parseProfile(linkedInExport());
    expect(result.fullName).not.toBe('Bahasa Malaysia');
  });
});

describe('parseProfile — a plain CV', () => {
  function plainCv(): TextLine[] {
    nextY = 780;
    return [
      line('Tan Wei Ming', 72, 18),
      line('tan.weiming@example.com | 012-3456789', 72),
      line('Aspiring software engineer', 72, 11),
      line('Education', 72, 13),
      line('Universiti Malaya', 72, 10),
      line('Diploma in Information Technology, Software Engineering (2023 - 2025)', 72),
      line('Skills', 72, 13),
      line('Java, Spring Boot, PostgreSQL, Docker', 72),
    ];
  }

  it('reads a one-column CV that is not from LinkedIn', () => {
    const result = parseProfile(plainCv());

    expect(result.fullName).toBe('Tan Wei Ming');
    // NOT the contact line directly under the name. A headline is the field
    // employers read first, and filling it with someone's phone number would
    // publish the very detail the masking rules keep private.
    expect(result.headline).toBe('Aspiring software engineer');
    expect(result.university).toBe('Universiti Malaya');
    expect(result.qualification).toBe('diploma');
    expect(result.graduationYear).toBe(2025);
    expect(result.skills).toEqual(['Java', 'Spring Boot', 'PostgreSQL', 'Docker']);
  });

  it('treats a single column as one column', () => {
    // An indented line is not a sidebar; splitting here would lose the body.
    expect(splitColumns(plainCv()).sidebar).toHaveLength(0);
  });
});

describe('parseProfile — when it cannot tell', () => {
  it('returns empty for an empty document', () => {
    expect(parseProfile([])).toEqual(EMPTY_PROFILE);
  });

  it('leaves the name empty rather than guessing when nothing is set larger', () => {
    // A scanned or uniformly-typeset page. An empty field the person fills is
    // better than a confident wrong one under their name (docs/08 S-D6).
    const flat = [
      { text: 'Some Company Sdn Bhd', x: 72, y: 700, size: 10, page: 1 },
      { text: 'Invoice for services', x: 72, y: 680, size: 10, page: 1 },
      { text: 'Thank you for your business', x: 72, y: 660, size: 10, page: 1 },
    ];

    expect(parseProfile(flat).fullName).toBeNull();
  });

  it('does not mistake an old year for a graduation year', () => {
    const lines = [
      { text: 'Education', x: 72, y: 700, size: 13, page: 1 },
      { text: 'Kolej Bandar Baru', x: 72, y: 685, size: 10, page: 1 },
      { text: 'Founded 1912. Diploma in Accounting', x: 72, y: 670, size: 9, page: 1 },
    ];

    expect(parseProfile(lines).graduationYear).toBeNull();
  });

  it('does not treat a job title containing a heading word as a section break', () => {
    const lines = [
      ...linkedInExport(),
      { text: 'Education Officer', x: 220, y: 300, size: 9, page: 1 },
    ];

    expect(parseProfile(lines).university).toBe('Universiti Teknologi Malaysia');
  });

  it('drops duplicate skills and caps the list', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      text: `Skill ${i % 25}`,
      x: 40,
      y: 700 - i * 12,
      size: 9,
      page: 1,
    }));
    const lines = [{ text: 'Skills', x: 40, y: 720, size: 12, page: 1 }, ...many];

    const skills = parseProfile(lines).skills;
    expect(skills.length).toBeLessThanOrEqual(20);
    expect(new Set(skills.map((s) => s.toLowerCase())).size).toBe(skills.length);
  });

  it('skips an email or phone line when looking for a headline', () => {
    const lines = [
      { text: 'Siti Aminah', x: 72, y: 780, size: 18, page: 1 },
      { text: 'siti@example.com', x: 72, y: 760, size: 9, page: 1 },
      { text: '+60 12-345 6789', x: 72, y: 748, size: 9, page: 1 },
      { text: 'Mechanical engineering graduate', x: 72, y: 736, size: 9, page: 1 },
    ];

    expect(parseProfile(lines).headline).toBe('Mechanical engineering graduate');
  });

  it('normalises the non-breaking spaces PDFs are full of', () => {
    const lines = [
      { text: 'Aisyah Rahman', x: 72, y: 760, size: 18, page: 1 },
      { text: 'Student', x: 72, y: 740, size: 9, page: 1 },
      { text: 'body text here', x: 72, y: 720, size: 9, page: 1 },
    ];

    expect(parseProfile(lines).fullName).toBe('Aisyah Rahman');
  });
});
