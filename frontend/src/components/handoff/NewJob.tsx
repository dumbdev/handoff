"use client";
import { useState } from 'react';
import { Cl } from '@stacks/transactions';
import { useHandoff_CreateJob } from '@/generated/hooks';
import {
  DEADLINE_PRESETS,
  describeBlocks,
  formatStx,
  isValidPrincipal,
  MAX_PERIOD,
  REVIEW_PRESETS,
  toMicroStx,
} from '@/lib/handoff';
import { TxStatus, useOnTxSuccess } from './TxStatus';
import { input, label, muted, primaryButton, secondaryButton } from './ui';

function BlockPicker({
  id,
  presets,
  value,
  onChange,
}: {
  id: string;
  presets: { label: string; blocks: number }[];
  value: number;
  onChange: (blocks: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.blocks)}
            aria-pressed={value === p.blocks}
            className={`${secondaryButton} ${value === p.blocks ? '!bg-[#34D399] !text-[#131416]' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        id={id}
        type="number"
        min={1}
        max={MAX_PERIOD}
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        className={input}
      />
      <p className={`text-[11px] font-mono ${muted} mt-1`}>
        {value >= 1 && value <= MAX_PERIOD
          ? `${value.toLocaleString()} Bitcoin blocks, ${describeBlocks(value)}`
          : `Enter 1 to ${MAX_PERIOD.toLocaleString()} blocks`}
      </p>
    </div>
  );
}

export function NewJob({ address, onCreated }: { address: string; onCreated: () => void }) {
  const create = useHandoff_CreateJob();
  const [open, setOpen] = useState(false);
  const [freelancer, setFreelancer] = useState('');
  const [amount, setAmount] = useState('');
  const [brief, setBrief] = useState('');
  const [deliverIn, setDeliverIn] = useState(DEADLINE_PRESETS[0].blocks);
  const [review, setReview] = useState(REVIEW_PRESETS[0].blocks);

  useOnTxSuccess(create, () => {
    setFreelancer('');
    setAmount('');
    setBrief('');
    setOpen(false);
    onCreated();
  });

  const micro = toMicroStx(amount);
  const target = freelancer.trim();
  const targetError =
    target && !isValidPrincipal(target)
      ? 'Not a valid Stacks address'
      : target === address
        ? 'You cannot hire yourself'
        : null;
  const ready =
    isValidPrincipal(target) &&
    !targetError &&
    micro !== null &&
    brief.trim().length > 0 &&
    deliverIn >= 1 &&
    deliverIn <= MAX_PERIOD &&
    review >= 1 &&
    review <= MAX_PERIOD;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${primaryButton} w-full`}>
        Escrow a new job
      </button>
    );
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!ready || micro === null) return;
        void create
          .call([
            Cl.principal(target),
            Cl.uint(micro),
            Cl.uint(deliverIn),
            Cl.uint(review),
            Cl.stringUtf8(brief.trim().slice(0, 200)),
          ])
          .catch(() => {});
      }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-instrument font-medium">Escrow a new job</h2>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          Cancel
        </button>
      </div>

      <div>
        <label htmlFor="brief" className={label}>
          What is the work? ({brief.trim().length}/200)
        </label>
        <input
          id="brief"
          value={brief}
          onChange={e => setBrief(e.target.value.slice(0, 200))}
          placeholder="Landing page redesign"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="freelancer" className={label}>
          Freelancer&apos;s Stacks address
        </label>
        <input
          id="freelancer"
          value={freelancer}
          onChange={e => setFreelancer(e.target.value)}
          placeholder="ST…"
          className={input}
          autoComplete="off"
        />
        {targetError && <p className="text-[11px] font-mono text-[#F87171] mt-1">{targetError}</p>}
      </div>

      <div>
        <label htmlFor="amount" className={label}>
          Amount to escrow (STX)
        </label>
        <input
          id="amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="50"
          inputMode="decimal"
          className={input}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <p className={label}>Deliver within</p>
          <BlockPicker id="deliver-in" presets={DEADLINE_PRESETS} value={deliverIn} onChange={setDeliverIn} />
        </div>
        <div>
          <p className={label}>Then I have this long to review</p>
          <BlockPicker id="review" presets={REVIEW_PRESETS} value={review} onChange={setReview} />
        </div>
      </div>

      <p className={`text-[11px] font-mono ${muted} leading-relaxed`}>
        If you say nothing before the review window closes, the freelancer is paid automatically. If nothing
        is delivered by the deadline, you can take your money back.
      </p>

      <button type="submit" disabled={!ready || create.loading} className={primaryButton}>
        Escrow {micro ? formatStx(micro) : ''} STX
      </button>
      <TxStatus tx={create} success="Job created and funded." />
    </form>
  );
}
