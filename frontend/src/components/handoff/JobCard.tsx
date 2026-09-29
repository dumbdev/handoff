"use client";
import { Cl } from '@stacks/transactions';
import {
  useHandoff_Claim,
  useHandoff_Decline,
  useHandoff_MarkDelivered,
  useHandoff_Refund,
  useHandoff_Release,
} from '@/generated/hooks';
import {
  describeBlocks,
  explorerAddressUrl,
  formatStx,
  isSettled,
  shortAddress,
  statusLabel,
  STATUS,
  type Job,
} from '@/lib/handoff';
import { TxStatus, useOnTxSuccess, type TxHook } from './TxStatus';
import { inset, muted, primaryButton, secondaryButton, toneColor } from './ui';

type Action = {
  key: string;
  label: string;
  success: string;
  hook: TxHook & { call: (args: ReturnType<typeof Cl.uint>[]) => Promise<unknown> };
  primary?: boolean;
};

/** One line explaining what happens next, written for whoever is looking. */
function nextStep(job: Job, role: 'client' | 'freelancer'): string {
  if (job.status === STATUS.funded) {
    const left = job.deliverBy - job.currentHeight;
    if (job.refundable) {
      return role === 'client'
        ? 'The deadline passed with nothing delivered. You can take your money back.'
        : 'You missed the deadline. The client can take their money back.';
    }
    return role === 'client'
      ? `Waiting on delivery. ${left.toLocaleString()} blocks left (${describeBlocks(left)}).`
      : `Deliver within ${left.toLocaleString()} blocks (${describeBlocks(left)}) or the client can refund.`;
  }
  if (job.status === STATUS.delivered) {
    const left = (job.claimableAt ?? 0) - job.currentHeight;
    if (job.claimable) {
      return role === 'freelancer'
        ? 'The review window closed with no response. You can take the payment now.'
        : 'Your review window closed. The freelancer can take the payment at any moment.';
    }
    return role === 'client'
      ? `Delivered. You have ${left.toLocaleString()} blocks (${describeBlocks(left)}) to review before it pays out automatically.`
      : `Delivered. If the client says nothing for ${left.toLocaleString()} more blocks (${describeBlocks(left)}), you can take the payment.`;
  }
  if (job.status === STATUS.claimed) return 'The client never responded, so the payment released automatically.';
  if (job.status === STATUS.released) return 'The client approved and paid.';
  if (job.status === STATUS.refunded) return 'Nothing was delivered by the deadline, so the client was refunded.';
  return 'The freelancer handed the job back and the client was refunded.';
}

export function JobCard({ job, address, onChange }: { job: Job; address: string; onChange: () => void }) {
  const release = useHandoff_Release();
  const refund = useHandoff_Refund();
  const markDelivered = useHandoff_MarkDelivered();
  const decline = useHandoff_Decline();
  const claim = useHandoff_Claim();

  const role: 'client' | 'freelancer' = job.client === address ? 'client' : 'freelancer';
  const other = role === 'client' ? job.freelancer : job.client;
  const status = statusLabel(job);

  const actions: Action[] = [];
  if (role === 'client') {
    if (job.status === STATUS.funded || job.status === STATUS.delivered) {
      actions.push({ key: 'release', label: 'Approve and pay', success: 'Paid.', hook: release, primary: true });
    }
    if (job.refundable) {
      actions.push({ key: 'refund', label: 'Refund me', success: 'Refunded.', hook: refund });
    }
  } else {
    if (job.status === STATUS.funded) {
      actions.push({
        key: 'deliver',
        label: 'Mark delivered',
        success: 'Marked delivered. The review window has started.',
        hook: markDelivered,
        primary: true,
      });
      actions.push({ key: 'decline', label: 'Decline job', success: 'Declined.', hook: decline });
    }
    if (job.status === STATUS.delivered && job.claimable) {
      actions.push({ key: 'claim', label: 'Take payment', success: 'Paid out.', hook: claim, primary: true });
    }
  }

  return (
    <li className={inset}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[16px] font-instrument text-[#F4F3EF] break-words">{job.brief}</p>
          <p className={`text-[11px] font-mono ${muted} mt-1`}>
            #{job.id} · you are the {role} ·{' '}
            <a href={explorerAddressUrl(other)} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {role === 'client' ? 'hired' : 'hired by'} {shortAddress(other)}
            </a>
          </p>
        </div>
        <span
          className={`shrink-0 text-[11px] font-mono border rounded-full px-2.5 py-1 ${toneColor[status.tone]}`}
        >
          {status.text}
        </span>
      </div>

      <p className="text-[20px] font-instrument text-[#F4F3EF] mb-2">{formatStx(job.amount)} STX</p>
      <p className={`text-[12px] font-mono ${muted} leading-relaxed`}>{nextStep(job, role)}</p>

      {!isSettled(job) && (
        <ProgressBar
          from={job.status === STATUS.delivered ? (job.deliveredAt ?? 0) : job.deliverBy - job.reviewWindow}
          to={job.status === STATUS.delivered ? (job.claimableAt ?? 0) : job.deliverBy}
          now={job.currentHeight}
          urgent={job.claimable || job.refundable}
        />
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {actions.map(action => (
            <ActionButton key={action.key} action={action} jobId={job.id} onDone={onChange} />
          ))}
        </div>
      )}
      {actions.map(action => (
        <TxStatus key={`${action.key}-status`} tx={action.hook} success={action.success} />
      ))}
    </li>
  );
}

function ActionButton({ action, jobId, onDone }: { action: Action; jobId: number; onDone: () => void }) {
  useOnTxSuccess(action.hook, onDone);
  return (
    <button
      onClick={() => void action.hook.call([Cl.uint(jobId)]).catch(() => {})}
      disabled={action.hook.loading}
      className={action.primary ? primaryButton : secondaryButton}
    >
      {action.label}
    </button>
  );
}

function ProgressBar({
  from,
  to,
  now,
  urgent,
}: {
  from: number;
  to: number;
  now: number;
  urgent: boolean;
}) {
  const span = Math.max(1, to - from);
  const pct = Math.max(0, Math.min(100, ((now - from) / span) * 100));
  return (
    <div
      className="h-1.5 bg-[#131416] rounded-full mt-3 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Time elapsed"
    >
      <div
        className={`h-full rounded-full transition-all ${urgent ? 'bg-[#FBBF24]' : 'bg-[#34D399]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
