export type OnResult = (text: string, isFinal: boolean) => void;

export function createBrowserSTT(lang: string = 'en-IN') {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  let running = false;
  function start(onResult: OnResult) {
    if (running) return;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        onResult(r[0].transcript, r.isFinal);
      }
    };
    rec.start();
    running = true;
  }
  function stop() {
    if (!running) return;
    rec.stop();
    running = false;
  }
  return { start, stop };
}


