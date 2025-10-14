import type { Pipeline } from "@xenova/transformers";

let pipe: Pipeline | null = null;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!pipe) {
    const { pipeline } = await import("@xenova/transformers");
    pipe = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")) as Pipeline;
  }
  const outs: number[][] = [];
  for (const t of texts) {
    const res: any = await (pipe as any)(t, { pooling: "mean", normalize: true });
    outs.push(Array.from(res.data));
  }
  return outs;
}


