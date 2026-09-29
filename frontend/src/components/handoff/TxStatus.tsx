"use client";
import { useEffect } from 'react';
import { explainTxError } from '@/lib/handoff';

/** The subset of a generated public-function hook that describes a transaction. */
export type TxHook = {
  loading: boolean;
  error: Error | null;
  txid: string | null;
  txStatus: string | null;
  txStatusError: string | null;
  explorerUrl: string | null;
};

/** Run `onSuccess` once the hook's transaction confirms. */
export function useOnTxSuccess(tx: TxHook, onSuccess: () => void) {
  useEffect(() => {
    if (tx.txStatus === 'success') onSuccess();
    // Only re-run when the status changes, not when the callback identity does.
  }, [tx.txStatus, tx.txid]);
}

export function TxStatus({ tx, success }: { tx: TxHook; success: string }) {
  const link = tx.explorerUrl ? (
    <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline ml-2">
      View transaction
    </a>
  ) : null;

  let body: React.ReactNode = null;
  if (tx.loading) {
    body = <span className="text-[#8F8D8E]">Confirm in your wallet…</span>;
  } else if (tx.error) {
    body = <span className="text-[#F87171]">Not sent: {tx.error.message || 'request cancelled'}</span>;
  } else if (tx.txid && tx.txStatus === 'pending') {
    body = <span className="text-[#8F8D8E]">Sent. Waiting for the next block…{link}</span>;
  } else if (tx.txid && tx.txStatus === 'success') {
    body = <span className="text-[#4ADE80]">{success}{link}</span>;
  } else if (tx.txid && tx.txStatus) {
    body = <span className="text-[#F87171]">{explainTxError(tx.txStatusError)}{link}</span>;
  }

  if (!body) return null;
  return (
    <p role="status" className="text-[12px] font-mono mt-3 break-words">
      {body}
    </p>
  );
}
