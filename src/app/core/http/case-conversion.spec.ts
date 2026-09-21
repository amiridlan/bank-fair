import { camelToSnakeKey, snakeToCamelKey, toCamelCase, toSnakeCase } from './case-conversion';

describe('case conversion', () => {
  describe('key helpers', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamelKey('contact_email')).toBe('contactEmail');
      expect(snakeToCamelKey('booth_total')).toBe('boothTotal');
      expect(snakeToCamelKey('id')).toBe('id');
    });

    it('converts camelCase to snake_case', () => {
      expect(camelToSnakeKey('contactEmail')).toBe('contact_email');
      expect(camelToSnakeKey('minCgpa')).toBe('min_cgpa');
      expect(camelToSnakeKey('id')).toBe('id');
    });

    it('handles digits at a word boundary', () => {
      // `deal_value_myr` round-trips; `fair_01` must not gain a capital.
      expect(snakeToCamelKey('deal_value_myr')).toBe('dealValueMyr');
      expect(camelToSnakeKey('dealValueMyr')).toBe('deal_value_myr');
    });
  });

  describe('toCamelCase', () => {
    it('converts nested objects and arrays', () => {
      const wire = {
        booth_total: 40,
        fair_ids: ['fair-01'],
        contact: { contact_name: 'Farah', contact_phone: null },
        booths: [{ employer_name: 'Meridian Capital Bhd' }],
      };

      expect(toCamelCase(wire)).toEqual({
        boothTotal: 40,
        fairIds: ['fair-01'],
        contact: { contactName: 'Farah', contactPhone: null },
        booths: [{ employerName: 'Meridian Capital Bhd' }],
      });
    });

    it('preserves primitives and null', () => {
      expect(toCamelCase({ cgpa: null, is_contact_visible: false })).toEqual({
        cgpa: null,
        isContactVisible: false,
      });
    });

    it('leaves already-camelCase keys alone', () => {
      expect(toCamelCase({ boothTotal: 1 })).toEqual({ boothTotal: 1 });
    });
  });

  describe('toSnakeCase', () => {
    it('converts nested request bodies', () => {
      const body = {
        contactEmail: 'daniel.lim@example.com',
        boothPackage: 'premium',
        nested: { lostReason: null },
      };

      expect(toSnakeCase(body)).toEqual({
        contact_email: 'daniel.lim@example.com',
        booth_package: 'premium',
        nested: { lost_reason: null },
      });
    });

    it('does not recurse into Date values', () => {
      const date = new Date('2026-09-21T10:00:00+08:00');
      const result = toSnakeCase({ startDate: date }) as { start_date: unknown };

      // Recursing would turn the Date into {} and lose the timestamp.
      expect(result.start_date).toBe(date);
    });
  });

  it('round-trips a payload unchanged', () => {
    const original = { contactName: 'Priya Nair', fairIds: ['fair-02'], dealValueMyr: 7500 };
    expect(toCamelCase(toSnakeCase(original))).toEqual(original);
  });
});
