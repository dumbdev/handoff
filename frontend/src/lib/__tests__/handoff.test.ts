import { describe, expect, it } from 'vitest';
import { Cl, cvToValue } from '@stacks/transactions';
import { formatStx, parseJob, parseJobIds, toMicroStx } from '../handoff';

const CLIENT = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const FREELANCER = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';

/** Exactly what the generated read-only binding hands back: cvToValue output. */
const asBinding = (cv: Parameters<typeof cvToValue>[0]) => cvToValue(cv);

const jobTuple = (over: Record<string, ReturnType<typeof Cl.uint>> = {}) =>
  Cl.ok(
    Cl.tuple({
      client: Cl.principal(CLIENT),
      freelancer: Cl.principal(FREELANCER),
      amount: Cl.uint(10_000_000),
      brief: Cl.stringUtf8('Landing page redesign'),
      'deliver-by': Cl.uint(900),
      'review-window': Cl.uint(10),
      'delivered-at': Cl.some(Cl.uint(880)),
      status: Cl.uint(2),
      'claimable-at': Cl.some(Cl.uint(890)),
      'current-height': Cl.uint(895),
      claimable: Cl.bool(false),
      refundable: Cl.bool(false),
      ...over,
    }),
  );

describe('parseJob', () => {
  it('reads a delivered job', () => {
    const job = parseJob(7, asBinding(jobTuple()));
    expect(job).toEqual({
      id: 7,
      client: CLIENT,
      freelancer: FREELANCER,
      amount: 10_000_000n,
      brief: 'Landing page redesign',
      deliverBy: 900,
      reviewWindow: 10,
      deliveredAt: 880,
      status: 2,
      claimableAt: 890,
      currentHeight: 895,
      claimable: false,
      refundable: false,
    });
  });

  it('handles a job that has not been delivered', () => {
    const job = parseJob(
      1,
      asBinding(jobTuple({ 'delivered-at': Cl.none(), 'claimable-at': Cl.none(), status: Cl.uint(1) })),
    );
    expect(job?.deliveredAt).toBeNull();
    expect(job?.claimableAt).toBeNull();
  });

  it('keeps booleans as booleans', () => {
    const job = parseJob(1, asBinding(jobTuple({ claimable: Cl.bool(true), refundable: Cl.bool(true) })));
    expect(job?.claimable).toBe(true);
    expect(job?.refundable).toBe(true);
  });

  // cvToValue drops the ok/err wrapper, so ERR_NOT_FOUND arrives looking like a plain uint.
  it('treats ERR_NOT_FOUND as no job', () => {
    expect(parseJob(1, asBinding(Cl.error(Cl.uint(100))))).toBeNull();
    expect(parseJob(1, null)).toBeNull();
    expect(parseJob(1, undefined)).toBeNull();
  });
});

describe('parseJobIds', () => {
  it('reads the id list', () => {
    expect(parseJobIds(asBinding(Cl.ok(Cl.list([Cl.uint(1), Cl.uint(4)]))))).toEqual([1, 4]);
  });

  it('returns nothing for an empty list or a bad shape', () => {
    expect(parseJobIds(asBinding(Cl.ok(Cl.list([]))))).toEqual([]);
    expect(parseJobIds(null)).toEqual([]);
  });
});

describe('amount handling', () => {
  it('parses STX without float rounding', () => {
    expect(toMicroStx('1')).toBe(1_000_000n);
    expect(toMicroStx('0.1')).toBe(100_000n);
    expect(toMicroStx('12.345678')).toBe(12_345_678n);
    expect(toMicroStx('0.0000001')).toBeNull();
    expect(toMicroStx('0')).toBeNull();
    expect(toMicroStx('abc')).toBeNull();
    expect(toMicroStx('-5')).toBeNull();
  });

  it('formats micro-STX for display', () => {
    expect(formatStx(1_000_000n)).toBe('1');
    expect(formatStx(1_500_000n)).toBe('1.5');
    expect(formatStx(0n)).toBe('0');
  });
});
