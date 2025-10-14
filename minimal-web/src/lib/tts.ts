export type Affect = { speak_rate?: number; pitch?: number };

let audioQueue: HTMLAudioElement[] = [];
let isPlaying = false;

function next() {
  if (isPlaying) return;
  const el = audioQueue.shift();
  if (!el) return;
  isPlaying = true;
  el.onended = () => {
    isPlaying = false;
    next();
  };
  el.play().catch(() => {
    isPlaying = false;
    next();
  });
}

export async function speakBrowser(text: string, affect?: Affect) {
  if (!('speechSynthesis' in window)) return null;
  const utter = new SpeechSynthesisUtterance(text);
  // Map mood params
  const rate = Math.min(1.2, Math.max(0.8, affect?.speak_rate ?? 1.0));
  const pitch = Math.min(1.2, Math.max(0.8, affect?.pitch ?? 1.0));
  utter.rate = rate;
  utter.pitch = pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return utter;
}

export async function enqueueAudioUrl(url: string) {
  const el = new Audio(url);
  audioQueue.push(el);
  next();
  return el;
}


