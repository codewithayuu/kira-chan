"use client";

import { useEffect, useRef, useState } from "react";

export default function LearningPage() {
  const [userId] = useState<string>("user-1");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facts, setFacts] = useState<any[]>([]);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [pii, setPii] = useState(true);

  const base = "http://localhost:3001";

  const loadStatus = async () => {
    const r = await fetch(`${base}/api/learning/status?userId=${userId}`);
    const j = await r.json(); setStatus(j);
    setLearningEnabled(j.learningEnabled); setPii(j.piiStripEnabled);
  };
  const loadFacts = async () => {
    const r = await fetch(`${base}/api/learning/facts?userId=${userId}`);
    setFacts(await r.json());
  };

  useEffect(() => { loadStatus(); loadFacts(); }, []);

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file); fd.append("userId", userId);
    const r = await fetch(`${base}/api/learning/upload`, { method:"POST", body: fd });
    const j = await r.json(); setJobId(j.jobId);
    const es = new EventSource(`${base}/api/learning/jobs/${j.jobId}/events`);
    es.addEventListener("progress", (e: any) => setProgress(JSON.parse(e.data)));
    es.addEventListener("snapshot", (e: any) => setProgress(JSON.parse(e.data)));
    es.addEventListener("done", (e: any) => { setProgress(JSON.parse(e.data)); es.close(); loadStatus(); loadFacts(); });
  };

  const toggle = async (type: "learning" | "pii") => {
    const r = await fetch(`${base}/api/learning/toggle`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ userId, enabled: type==="learning" ? !learningEnabled : undefined, piiStrip: type==="pii" ? !pii : undefined })
    });
    const j = await r.json(); setLearningEnabled(j.learningEnabled); setPii(j.piiStripEnabled);
  };

  const delFact = async (id: string) => {
    await fetch(`${base}/api/learning/facts/${id}?userId=${userId}`, { method: "DELETE" });
    loadFacts();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Learning Settings</h2>
        <a href="/" className="text-sm text-gray-500">← Back</a>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => toggle("learning")} className="btn-primary px-3 py-2">{learningEnabled ? "Learning: ON" : "Learning: OFF"}</button>
        <button onClick={() => toggle("pii")} className="px-3 py-2 rounded-lg border border-gray-300">{pii ? "PII strip: ON" : "PII strip: OFF"}</button>
        <button onClick={loadStatus} className="px-3 py-2 rounded-lg border border-gray-300">Refresh</button>
      </div>

      <div className="bg-white/70 rounded-xl p-4 border">
        <h3 className="font-semibold mb-2">Upload chat logs (.txt / .jsonl)</h3>
        <input type="file" ref={fileRef} accept=".txt,.jsonl" className="mb-3" />
        <div className="flex items-center gap-2">
          <button onClick={onUpload} className="btn-primary">Upload & Learn</button>
          {jobId && <span className="text-xs text-gray-500">Job: {jobId}</span>}
        </div>
        {progress && (
          <div className="mt-3 space-y-1">
            <div className="text-sm">Status: {progress.status}</div>
            <div className="text-sm">Processed: {progress.processed}/{progress.total}</div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div className="h-2 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.round(((progress.processed||0)/(progress.total||1))*100))}%` }} />
            </div>
            {progress.notes && <div className="text-xs text-gray-600">Notes: {progress.notes}</div>}
          </div>
        )}
      </div>

      {status && (
        <div className="bg-white/70 rounded-xl p-4 border space-y-2">
          <h3 className="font-semibold">Status</h3>
          <div className="text-sm">Facts: {status.counts.facts} · Moments: {status.counts.moments} · Style tips: {status.counts.tips}</div>
          {status.style && (
            <ul className="text-sm list-disc pl-6">
              <li>Avg length: {status.style.avgLen.toFixed(1)}</li>
              <li>Emoji rate: {status.style.emojiRate.toFixed(2)}</li>
              <li>Exclam rate: {status.style.exclamRate.toFixed(2)}</li>
              <li>Question rate: {status.style.questionRate.toFixed(2)}</li>
              <li>Hinglish ratio: {(status.style.hinglishRatio*100).toFixed(0)}%</li>
              <li>Top emojis: {(status.style.topEmojis||[]).join(" ")}</li>
              <li>Greetings: {(status.style.greetingLex||[]).join(", ")}</li>
            </ul>
          )}
        </div>
      )}

      <div className="bg-white/70 rounded-xl p-4 border">
        <h3 className="font-semibold mb-2">What she learned (facts)</h3>
        <ul className="space-y-2">
          {facts.map((f) => (
            <li key={f.id} className="flex items-center justify-between">
              <span className="text-sm">• {f.content} <span className="opacity-60">(conf {Number(f.confidence||0.7).toFixed(2)})</span></span>
              <button onClick={() => delFact(f.id)} className="px-2 py-1 text-xs rounded border">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
