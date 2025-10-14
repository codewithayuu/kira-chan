# Kira chan — AI Companion (Minimal Web + Backend)

A free/trial‑first AI companion with persistent persona + learning, multi‑API hot‑swap, 3D VRM avatar, browser TTS/STT, and local embeddings.

## What’s here
- minimal-backend (Express):
  - Streaming chat with CONTROL JSON (mood), safety redaction
  - File‑based persistence: conversations.json, learning.json, autonomy.json
  - Local embeddings (Transformers.js) + hybrid retrieval
  - Learning: upload .txt/.jsonl with SSE progress; live learning on each turn
  - Autonomy: optional idle check-ins (PG‑13), quiet hours
- minimal-web (Next.js):
  - Chat UI + 3D VRM avatar (R3F) with mood‑driven expressions
  - Browser TTS, basic STT (Web Speech API)
  - Settings: Learning page (upload/progress/toggles)
  - Persists convoId; reload restores past chat

## Prereqs
- Node 18+
- A Groq API key (or change provider in backend config)

## Quick start
1) Install deps
```
cd minimal-backend && npm i
cd ../minimal-web && npm i
```
2) Backend env (minimal-backend/.env or set in shell)
```
GROQ_API_KEY=your_groq_key
```
3) Run
```
# Terminal A
cd minimal-backend && node server.js

# Terminal B
cd minimal-web && npm run dev
```
4) Open
- Web: http://localhost:3002
- Backend health: http://localhost:3001/health

## Persistence
- Conversations: minimal-backend/conversations.json
- Learning: minimal-backend/learning.json
- Autonomy: minimal-backend/autonomy.json
- These files are ignored by Git by default (.gitignore).

## GitHub push
```
git init
git add .
git commit -m "feat: minimal web+backend with learning, persistence, avatar"
# Replace with your repo
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

## Notes
- To switch providers, update backend config via /api/config or keys via /api/keys/update.
- Place a VRM at minimal-web/public/avatars/chan.vrm for the 3D face.
- This minimal stack avoids Docker and databases; you can later swap to Postgres/Redis easily.
