import { Phone } from 'lucide-react';
import { DEVELOPER } from '../lib/brand';

/** "Developed by BG Devops · call 0784654328". */
export default function DeveloperSignature({ className = '' }: { className?: string }) {
  return (
    <div data-testid="developer-signature" className={`text-xs text-slate-500 ${className}`}>
      <div>Developed by <span className="font-semibold text-slate-300">{DEVELOPER.name}</span></div>
      <a href={DEVELOPER.phoneLink} className="inline-flex items-center gap-1.5 mt-1 text-sky-400 hover:text-sky-300">
        <Phone size={12} /> Contact: {DEVELOPER.phoneDisplay}
      </a>
    </div>
  );
}
