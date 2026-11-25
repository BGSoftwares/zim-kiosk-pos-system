import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Loader2, CameraOff } from 'lucide-react';

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

// Start/stop requests are queued so React StrictMode's double mount (or quick open/close)
// can never leave two scanners fighting over the camera.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

interface Props {
  /** Called once per scan. The same code is ignored again for `cooldownMs`. */
  onScan: (code: string) => void;
  /** Stop the camera without unmounting (e.g. while a form is open). */
  paused?: boolean;
  cooldownMs?: number;
}

export default function BarcodeScanner({ onScan, paused = false, cooldownMs = 1500 }: Props) {
  const containerId = `scanner-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const onScanRef = useRef(onScan);
  const lastRef = useRef({ code: '', at: 0 });
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  });

  // html5-qrcode starts <video>.play() itself; closing the scanner mid-start rejects that promise
  // with a harmless "interrupted" error that would otherwise surface as an uncaught rejection.
  useEffect(() => {
    const swallow = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && (e.reason.message ?? e.reason)) ?? '');
      if (/play\(\) request was interrupted/i.test(msg)) e.preventDefault();
    };
    window.addEventListener('unhandledrejection', swallow);
    return () => window.removeEventListener('unhandledrejection', swallow);
  }, []);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    setStarting(true);
    setError(null);

    enqueue(async () => {
      if (cancelled) return;
      try {
        scanner = new Html5Qrcode(containerId, { verbose: false, formatsToSupport: FORMATS });
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: (w, h) => ({ width: Math.floor(w * 0.85), height: Math.floor(Math.min(h * 0.6, 170)) }) },
          text => {
            const code = text.trim();
            const now = Date.now();
            if (!code) return;
            if (code === lastRef.current.code && now - lastRef.current.at < cooldownMs) return;
            lastRef.current = { code, at: now };
            onScanRef.current(code);
          },
          () => undefined
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        scanner = null;
        if (!cancelled) {
          setStarting(false);
          const name = e instanceof Error ? e.name : '';
          setError(
            name === 'NotAllowedError' || /permission/i.test(String(e))
              ? 'Camera permission was denied. Allow the camera for this app in your phone settings, or use a barcode scanner / type the code below.'
              : 'The camera could not be started. Use a barcode scanner or type the code below.'
          );
        }
      }
    });

    return () => {
      cancelled = true;
      enqueue(async () => {
        const s = scanner;
        scanner = null;
        if (!s) return;
        try { await s.stop(); } catch { /* already stopped */ }
        try { s.clear(); } catch { /* nothing to clear */ }
      });
    };
  }, [paused, containerId, cooldownMs]);

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setManual('');
    onScanRef.current(code);
  };

  return (
    <div>
      <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video">
        <div id={containerId} className="w-full h-full [&_video]:object-cover" />
        {(starting || paused) && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm gap-2 bg-black/60">
            <Loader2 className="animate-spin" size={18} /> {paused ? 'Scanner paused' : 'Starting camera…'}
          </div>
        )}
        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-sm text-orange-300 bg-black/80">
            <CameraOff size={26} />
            {error}
          </div>
        )}
        {!starting && !error && !paused && (
          <div className="pointer-events-none absolute inset-x-[7%] top-1/2 h-px bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
        )}
      </div>

      <form onSubmit={submitManual} className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          inputMode="numeric"
          aria-label="Type barcode"
          placeholder="Or type the barcode number"
          className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100"
        />
        <button type="submit" className="px-5 rounded-2xl bg-slate-800 border border-slate-700 font-medium">Add</button>
      </form>
    </div>
  );
}
