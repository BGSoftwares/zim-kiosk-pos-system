import { useEffect, useRef } from 'react';

/**
 * Support for USB / Bluetooth barcode scanners ("keyboard wedge"): they type the
 * barcode very quickly and finish with Enter. Humans type far slower, so a burst of
 * keys ending in Enter is treated as a scan. Ignored while an input box has focus,
 * because the scanner is then simply typing into that box.
 */
export function useBarcodeWedge(onScan: (code: string) => void, enabled: boolean) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        buffer = '';
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        const code = buffer;
        buffer = '';
        if (code.length >= 4) {
          e.preventDefault();
          handler.current(code);
        }
        return;
      }
      if (e.key.length !== 1) return;

      const now = Date.now();
      if (now - last > 80) buffer = ''; // too slow to be a scanner: start over
      last = now;
      buffer += e.key;
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
