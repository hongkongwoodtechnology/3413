import {
  resolveCanonicalReferrerAddress,
  syncUniqueRefereeBinding,
} from './referral-binding';

type ReferralDbLike = Record<
  string,
  {
    stats: { friends: number };
    referees: Array<{ id: string; address: string }>;
  }
>;

function createDb(): ReferralDbLike {
  return {
    'referrer-a': {
      stats: { friends: 1 },
      referees: [{ id: 'ref-a-1', address: 'referee-1' }],
    },
    'referrer-b': {
      stats: { friends: 1 },
      referees: [{ id: 'ref-b-1', address: 'referee-1' }],
    },
    'referrer-c': {
      stats: { friends: 0 },
      referees: [],
    },
  };
}

describe('referral binding helpers', () => {
  it('keeps the existing unique referrer when a conflicting referrer is requested', () => {
    const result = resolveCanonicalReferrerAddress({
      db: {
        'referrer-a': {
          stats: { friends: 1 },
          referees: [{ id: 'ref-a-1', address: 'referee-1' }],
        },
      },
      refereeAddress: 'referee-1',
      requestedReferrerAddress: 'referrer-b',
    });

    expect(result).toEqual({
      referrerAddress: 'referrer-a',
      alreadyBound: true,
      duplicateReferrerAddresses: [],
    });
  });

  it('prefers the requested referrer when duplicate bindings already exist', () => {
    const result = resolveCanonicalReferrerAddress({
      db: createDb(),
      refereeAddress: 'referee-1',
      requestedReferrerAddress: 'referrer-b',
    });

    expect(result).toEqual({
      referrerAddress: 'referrer-b',
      alreadyBound: true,
      duplicateReferrerAddresses: ['referrer-a'],
    });
  });

  it('removes duplicate referee bindings from non-canonical referrers', () => {
    const db = createDb();

    const result = syncUniqueRefereeBinding({
      db,
      canonicalReferrerAddress: 'referrer-b',
      refereeAddress: 'referee-1',
    });

    expect(result).toEqual({
      created: false,
      duplicateReferrerAddresses: ['referrer-a'],
    });
    expect(db['referrer-a'].referees).toEqual([]);
    expect(db['referrer-a'].stats.friends).toBe(0);
    expect(db['referrer-b'].referees).toEqual([{ id: 'ref-b-1', address: 'referee-1' }]);
    expect(db['referrer-b'].stats.friends).toBe(1);
  });
});
