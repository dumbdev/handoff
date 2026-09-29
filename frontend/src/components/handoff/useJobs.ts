"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Cl } from '@stacks/transactions';
import { handoff_getJob, handoff_getUserJobs } from '@/generated/contracts';
import { isValidPrincipal, parseJob, parseJobIds, type Job } from '@/lib/handoff';

const REFRESH_MS = 30_000;

/**
 * Loads every job the address is party to and keeps them fresh so deadlines
 * tick down on their own. `jobs` is undefined until the first load finishes.
 *
 * The contract keeps a list of job ids per principal because Clarity maps
 * can't be iterated, so this is one call for the ids plus one per job.
 */
export function useJobs(address: string | null) {
  const [jobs, setJobs] = useState<Job[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const current = useRef(address);
  current.current = address;

  const refresh = useCallback(async () => {
    if (!isValidPrincipal(address)) return;
    try {
      const ids = parseJobIds(await handoff_getUserJobs([Cl.principal(address)], address));
      const loaded = await Promise.all(
        ids.map(async id => parseJob(id, await handoff_getJob([Cl.uint(id)], address))),
      );
      // Ignore responses for a wallet the user has since disconnected from.
      if (current.current !== address) return;
      setJobs(loaded.filter((job): job is Job => job !== null).reverse());
      setError(null);
    } catch (e) {
      if (current.current === address) setError(e as Error);
    }
  }, [address]);

  useEffect(() => {
    setJobs(undefined);
    setError(null);
    if (!isValidPrincipal(address)) return;
    void refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [address, refresh]);

  return { jobs, refresh, error };
}
