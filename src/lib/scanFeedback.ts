// Audible + haptic feedback so a cashier can scan without looking at the screen.
export type ScanKind = 'ok' | 'warn' | 'error';

let audio: AudioContext | null = null;

function tone(freq: number, startOffset: number, duration: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(audio.destination);
  const t = audio.currentTime + startOffset;
  osc.start(t);
  osc.stop(t + duration);
}

export function scanFeedback(kind: ScanKind) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audio ??= new Ctx();
      if (audio.state === 'suspended') void audio.resume();
      if (kind === 'ok') tone(1800, 0, 0.09);
      else if (kind === 'warn') tone(900, 0, 0.16);
      else {
        tone(300, 0, 0.14);
        tone(220, 0.18, 0.2);
      }
    }
  } catch {
    /* sound is optional */
  }
  try {
    navigator.vibrate?.(kind === 'ok' ? 40 : kind === 'warn' ? [60, 40, 60] : [120, 60, 120]);
  } catch {
    /* vibration is optional */
  }
}
