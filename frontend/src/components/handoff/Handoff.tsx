"use client";
import { useAtomValue } from 'jotai';
import { addressAtom, isMountedAtom } from '@/store/wallet';
import { isSettled } from '@/lib/handoff';
import { JobCard } from './JobCard';
import { NewJob } from './NewJob';
import { useJobs } from './useJobs';
import { card, muted } from './ui';

export default function Handoff() {
  const address = useAtomValue(addressAtom);
  const isMounted = useAtomValue(isMountedAtom);
  const { jobs, refresh, error } = useJobs(address);

  if (!isMounted) return null;

  if (!address) {
    return (
      <section className={`${card} mb-10`} id="app">
        <p className={`font-mono text-[13px] ${muted} text-center py-8`}>
          Connect your wallet to escrow a job or see the work you have been hired for.
        </p>
      </section>
    );
  }

  const active = jobs?.filter(job => !isSettled(job)) ?? [];
  const done = jobs?.filter(isSettled) ?? [];

  return (
    <section className={`${card} mb-10 space-y-8`} id="app">
      <NewJob address={address} onCreated={refresh} />

      {jobs === undefined ? (
        <p className={`font-mono text-[13px] ${muted}`}>
          {error ? `Could not load your jobs: ${error.message}` : 'Loading your jobs…'}
        </p>
      ) : jobs.length === 0 ? (
        <p className={`font-mono text-[13px] ${muted}`}>
          No jobs yet. Escrow one above, or ask a client to hire this address.
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-[14px] font-mono text-[#8F8D8E] mb-3">Open ({active.length})</h2>
              <ul className="space-y-3">
                {active.map(job => (
                  <JobCard key={job.id} job={job} address={address} onChange={refresh} />
                ))}
              </ul>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h2 className="text-[14px] font-mono text-[#8F8D8E] mb-3">Settled ({done.length})</h2>
              <ul className="space-y-3">
                {done.map(job => (
                  <JobCard key={job.id} job={job} address={address} onChange={refresh} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
