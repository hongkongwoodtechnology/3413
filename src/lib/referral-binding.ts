type RefereeLike = { address: string };

type ReferrerLike = {
  stats?: { friends?: number };
  referees?: RefereeLike[];
};

type ReferralDbLike = Record<string, ReferrerLike>;

function normalizeReferralAddress(address: string | null | undefined): string | null {
  const normalized = address?.trim();
  return normalized ? normalized : null;
}

function findReferrerAddressesByReferee(
  db: ReferralDbLike,
  refereeAddress: string
): string[] {
  const normalizedReferee = normalizeReferralAddress(refereeAddress);
  if (!normalizedReferee) return [];

  return Object.entries(db)
    .filter(([, data]) =>
      (data.referees ?? []).some(
        (referee) => normalizeReferralAddress(referee.address) === normalizedReferee
      )
    )
    .map(([referrerAddress]) => referrerAddress);
}

export function resolveCanonicalReferrerAddress(params: {
  db: ReferralDbLike;
  refereeAddress: string;
  requestedReferrerAddress?: string | null;
}): {
  referrerAddress: string | null;
  alreadyBound: boolean;
  duplicateReferrerAddresses: string[];
} {
  const normalizedRequestedReferrer = normalizeReferralAddress(params.requestedReferrerAddress);
  const existingReferrerAddresses = findReferrerAddressesByReferee(params.db, params.refereeAddress);

  if (existingReferrerAddresses.length === 0) {
    return {
      referrerAddress: normalizedRequestedReferrer,
      alreadyBound: false,
      duplicateReferrerAddresses: [],
    };
  }

  if (normalizedRequestedReferrer && existingReferrerAddresses.includes(normalizedRequestedReferrer)) {
    return {
      referrerAddress: normalizedRequestedReferrer,
      alreadyBound: true,
      duplicateReferrerAddresses: existingReferrerAddresses.filter(
        (address) => address !== normalizedRequestedReferrer
      ),
    };
  }

  return {
    referrerAddress: existingReferrerAddresses[0] ?? null,
    alreadyBound: true,
    duplicateReferrerAddresses: existingReferrerAddresses.slice(1),
  };
}

export function syncUniqueRefereeBinding<T extends ReferralDbLike>(params: {
  db: T;
  canonicalReferrerAddress: string;
  refereeAddress: string;
}): {
  created: boolean;
  duplicateReferrerAddresses: string[];
} {
  const normalizedCanonicalReferrer = normalizeReferralAddress(params.canonicalReferrerAddress);
  const normalizedReferee = normalizeReferralAddress(params.refereeAddress);

  if (!normalizedCanonicalReferrer || !normalizedReferee) {
    return { created: false, duplicateReferrerAddresses: [] };
  }

  let created = false;
  const duplicateReferrerAddresses: string[] = [];

  for (const [referrerAddress, referrerData] of Object.entries(params.db)) {
    const referees = referrerData.referees ?? [];
    const matchingReferees = referees.filter(
      (referee) => normalizeReferralAddress(referee.address) === normalizedReferee
    );

    if (referrerAddress === normalizedCanonicalReferrer) {
      if (matchingReferees.length === 0) {
        created = true;
      } else if (matchingReferees.length > 1) {
        referrerData.referees = [
          matchingReferees[0],
          ...referees.filter(
            (referee) => normalizeReferralAddress(referee.address) !== normalizedReferee
          ),
        ];
      }
    } else if (matchingReferees.length > 0) {
      duplicateReferrerAddresses.push(referrerAddress);
      referrerData.referees = referees.filter(
        (referee) => normalizeReferralAddress(referee.address) !== normalizedReferee
      );
    }

    if (referrerData.stats) {
      referrerData.stats.friends = referrerData.referees?.length ?? 0;
    }
  }

  return { created, duplicateReferrerAddresses };
}
