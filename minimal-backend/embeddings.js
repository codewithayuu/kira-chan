let pipe = null;

async function ensurePipe() {
  if (!pipe) {
    const mod = await import('@xenova/transformers');
    pipe = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
}

async function embedText(text) {
  await ensurePipe();
  const res = await pipe(text, { pooling: 'mean', normalize: true });
  // res.data is a typed array
  return Array.from(res.data);
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { const x = a[i], y = b[i]; dot += x*y; na += x*x; nb += y*y; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { embedText, cosineSim };


