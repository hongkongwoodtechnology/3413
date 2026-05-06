import { getRelativeDate, isMatchOutdated } from './utils';

describe('Time Utils', () => {
  it('getRelativeDate returns a string', () => {
    const dateStr = getRelativeDate(24);
    expect(typeof dateStr).toBe('string');
  });

  it('isMatchOutdated returns false for a future date', () => {
    const futureDate = getRelativeDate(48); // 2 days from now
    const isOutdatedFuture = isMatchOutdated(futureDate);
    expect(isOutdatedFuture).toBe(false);
  });

  it('isMatchOutdated returns true for a past date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(yesterday);
    
    const isOutdatedPast = isMatchOutdated(yesterdayStr);
    expect(isOutdatedPast).toBe(true);
  });
});
