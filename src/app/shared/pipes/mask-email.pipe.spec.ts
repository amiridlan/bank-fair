import { MaskEmailPipe } from './mask-email.pipe';

describe('MaskEmailPipe', () => {
  const pipe = new MaskEmailPipe();

  it('keeps the first character and the domain', () => {
    expect(pipe.transform('nur.aisyah@example.com')).toBe('n***@example.com');
  });

  it('masks a single-character local part', () => {
    expect(pipe.transform('a@example.com')).toBe('a***@example.com');
  });

  it('uses the last @ so a plus-addressed local part cannot leak the domain', () => {
    expect(pipe.transform('daniel+fair@example.com')).toBe('d***@example.com');
  });

  it('returns an empty string for null, undefined and empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('masks entirely when the value is not an address', () => {
    expect(pipe.transform('not-an-email')).toBe('***');
    expect(pipe.transform('@example.com')).toBe('***');
  });
});
