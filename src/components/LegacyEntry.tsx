'use client';

import { useEffect } from 'react';

export function LegacyEntry({ redirect }: { redirect?: (destination: string) => void } = {}) {
  useEffect(() => {
    const { hash, search } = window.location;
    const params = new URLSearchParams(search);
    const legacyAuth = ['auth', 'login', 'signup', 'sign-up', 'next', 'auth_success', 'auth_error'].some((key) => params.has(key));
    const legacyProblem = /^#\d+$/.test(hash);
    if (legacyAuth || legacyProblem) {
      const destination = legacyProblem
        ? `/practice/${encodeURIComponent(hash.slice(1))}${search}`
        : `/practice${search}`;
      (redirect || ((nextDestination) => window.location.replace(nextDestination)))(destination);
    }
  }, [redirect]);
  return null;
}
