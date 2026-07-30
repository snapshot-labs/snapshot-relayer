import { deadMessageCutoff } from '../../src/check';

const SIX_DAYS = 60 * 60 * 24 * 6;

describe('deadMessageCutoff', () => {
  it('returns the timestamp 6 days before now', () => {
    const now = 1_700_000_000_000;
    expect(deadMessageCutoff(now)).toBe(now / 1e3 - SIX_DAYS);
  });

  it('matches the processing window, so the purge only removes ignored rows', () => {
    const now = Date.now();
    const cutoff = deadMessageCutoff(now);
    const nowSec = parseInt((now / 1e3).toFixed());
    // Loop keeps ts > cutoff; purge removes ts <= cutoff (>= 6 days old).
    expect(nowSec - cutoff).toBe(SIX_DAYS);
  });
});
