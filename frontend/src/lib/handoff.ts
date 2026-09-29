import { scaffoldConfig } from '@/scaffold.config';

export const STATUS = {
  funded: 1,
  delivered: 2,
  released: 3,
  claimed: 4,
  refunded: 5,
  declined: 6,
} as const;

export type Job = {
  id: number;
  client: string;
  freelancer: string;
  amount: bigint;
  brief: string;
  deliverBy: number;
  reviewWindow: number;
  deliveredAt: number | null;
  status: number;
  claimableAt: number | null;
  currentHeight: number;
  claimable: boolean;
  refundable: boolean;
};

type CvJson = { type?: string; value?: unknown };

function unwrap(raw: unknown): unknown {
  return raw && typeof raw === 'object' ? (raw as CvJson).value : undefined;
}

/**
 * The generated read-only bindings return cvToValue output, which drops the
 * (ok …)/(err …) wrapper: a job arrives as a cvToJSON tuple and ERR_NOT_FOUND
 * arrives as a bare `{ type: "uint", value: "100" }`. Anything without a
 * client field means "no such job".
 */
export function parseJob(id: number, data: unknown): Job | null {
  const tuple = unwrap(data) as Record<string, CvJson> | undefined;
  if (!tuple || typeof tuple !== 'object' || !('client' in tuple)) return null;
  const get = (key: string) => tuple[key]?.value;
  // An optional is nested twice: (some u880) becomes
  // { type: "(optional uint)", value: { type: "uint", value: "880" } }.
  const optional = (key: string) => {
    let inner = unwrap(tuple[key]);
    if (inner && typeof inner === 'object') inner = unwrap(inner);
    return inner === undefined || inner === null ? null : Number(inner);
  };
  return {
    id,
    client: String(get('client')),
    freelancer: String(get('freelancer')),
    amount: BigInt(String(get('amount'))),
    brief: String(get('brief') ?? ''),
    deliverBy: Number(get('deliver-by')),
    reviewWindow: Number(get('review-window')),
    deliveredAt: optional('delivered-at'),
    status: Number(get('status')),
    claimableAt: optional('claimable-at'),
    currentHeight: Number(get('current-height')),
    claimable: get('claimable') === true,
    refundable: get('refundable') === true,
  };
}

/** `(ok (list uint))` from get-user-jobs. */
export function parseJobIds(data: unknown): number[] {
  const list = unwrap(data);
  if (!Array.isArray(list)) return [];
  return list.map(item => Number(unwrap(item))).filter(Number.isFinite);
}

export function isValidPrincipal(addr: string | null | undefined): addr is string {
  return typeof addr === 'string' && /^(ST|SP|SN|SM)[0-9A-HJ-NP-Z]{38,41}$/.test(addr.trim());
}

const MICRO = 1_000_000n;

export function formatStx(micro: bigint): string {
  const whole = micro / MICRO;
  const fraction = (micro % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}

/** Parse a user-typed STX amount into micro-STX without float rounding. */
export function toMicroStx(input: string): bigint | null {
  const match = input.trim().match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const micro = BigInt(match[1]) * MICRO + BigInt((match[2] ?? '').padEnd(6, '0'));
  return micro > 0n ? micro : null;
}

// Bitcoin mainnet averages 10 minutes a block; the testnet burn chain runs faster.
export const MINUTES_PER_BLOCK = scaffoldConfig.isMainnet ? 10 : 4;

export function describeBlocks(blocks: number): string {
  const minutes = blocks * MINUTES_PER_BLOCK;
  if (minutes < 90) return `~${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `~${Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 60) return `~${Math.round(days)} days`;
  return `~${Math.round(days / 30)} months`;
}

const blocksFor = (minutes: number) => Math.max(1, Math.round(minutes / MINUTES_PER_BLOCK));

export const DEADLINE_PRESETS = [
  { label: 'Demo', blocks: 3 },
  { label: '3 days', blocks: blocksFor(3 * 24 * 60) },
  { label: '1 week', blocks: blocksFor(7 * 24 * 60) },
  { label: '1 month', blocks: blocksFor(30 * 24 * 60) },
];

export const REVIEW_PRESETS = [
  { label: 'Demo', blocks: 2 },
  { label: '2 days', blocks: blocksFor(2 * 24 * 60) },
  { label: '1 week', blocks: blocksFor(7 * 24 * 60) },
];

export const MAX_PERIOD = 52_560;

export function statusLabel(job: Job): { text: string; tone: 'open' | 'review' | 'done' | 'ended' } {
  switch (job.status) {
    case STATUS.funded:
      return { text: 'Funded', tone: 'open' };
    case STATUS.delivered:
      return { text: 'In review', tone: 'review' };
    case STATUS.released:
      return { text: 'Paid', tone: 'done' };
    case STATUS.claimed:
      return { text: 'Paid automatically', tone: 'done' };
    case STATUS.refunded:
      return { text: 'Refunded', tone: 'ended' };
    case STATUS.declined:
      return { text: 'Declined', tone: 'ended' };
    default:
      return { text: 'Unknown', tone: 'ended' };
  }
}

export const isSettled = (job: Job) => job.status >= STATUS.released;

const ERRORS: Record<string, string> = {
  u100: 'That job does not exist.',
  u101: 'Only the client can do that.',
  u102: 'Only the freelancer can do that.',
  u103: 'This job has already moved past that step.',
  u104: 'Invalid amount.',
  u105: 'Invalid deadline or review window.',
  u106: 'You cannot hire yourself.',
  u107: 'Too early. The deadline has not passed yet.',
  u108: 'You have reached the limit of 50 jobs.',
  u109: 'Add a short description of the work.',
};

/** Turn a tx result like "(err u107)" into a readable message. */
export function explainTxError(repr: string | null): string {
  if (!repr) return 'Transaction failed.';
  const code = repr.match(/u\d+/)?.[0];
  return (code && ERRORS[code]) || repr;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerAddressUrl(addr: string): string {
  return `https://explorer.hiro.so/address/${addr}${scaffoldConfig.explorerChainQuery}`;
}
