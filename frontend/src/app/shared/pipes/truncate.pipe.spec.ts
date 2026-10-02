import { TruncatePipe, isTruncated, truncate } from './truncate.pipe';

describe('truncate', () => {
  it('keeps short text as is', () => {
    expect(truncate('Angular', 15)).toBe('Angular');
    expect(truncate('Exactly15chars!', 15)).toBe('Exactly15chars!');
    expect(isTruncated('Exactly15chars!', 15)).toBe(false);
  });

  it('cuts long text to max characters plus an ellipsis', () => {
    expect(truncate('Responsive UI Development', 15)).toBe('Responsive UI D…');
    expect(isTruncated('Responsive UI Development', 15)).toBe(true);
  });

  it('does not leave a trailing space before the ellipsis', () => {
    expect(truncate('State Management', 6)).toBe('State…');
  });

  it('counts characters, not UTF-16 units', () => {
    expect(truncate('😀😀😀😀', 2)).toBe('😀😀…');
  });

  it('pipe handles null', () => {
    expect(new TruncatePipe().transform(null, 5)).toBe('');
  });
});
