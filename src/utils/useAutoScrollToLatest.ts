import { useEffect, useRef } from 'react';

/**
 * Keeps a chronological ledger (oldest first) positioned at its newest row.
 * The scroll happens only when the ledger is opened or its last row changes.
 */
export function useAutoScrollToLatest<T extends HTMLElement>(
  ledgerKey: string | number | null | undefined,
  latestRowKey: string | number | null | undefined,
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [ledgerKey, latestRowKey]);

  return containerRef;
}
