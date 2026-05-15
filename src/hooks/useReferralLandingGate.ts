import { useEffect, useState } from "react";

type UseReferralLandingGateResult = {
  referrerId: string | null;
  shouldShowReferralLanding: boolean;
  dismissReferralLanding: () => void;
};

export function useReferralLandingGate(
  connected: boolean
): UseReferralLandingGateResult {
  const [showReferralLanding, setShowReferralLanding] = useState(false);
  const [referrerId, setReferrerId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");

    setReferrerId(refParam);

    if (refParam && !connected) {
      setShowReferralLanding(true);
    }
  }, [connected]);

  return {
    referrerId,
    shouldShowReferralLanding: showReferralLanding && !!referrerId && !connected,
    dismissReferralLanding: () => setShowReferralLanding(false),
  };
}
