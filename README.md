# ResumeKit

Self-hosted AI resume builder — the capability set of resume-now.com, rebuilt from scratch.

**Live:** https://resume.kavilabs.dev

## What it does

- 8 ATS-friendly templates, live A4 preview, accent + font controls, autosave to localStorage
- AI writing: summary, experience bullets, skills, job tailoring, cover letters, ATS review with score
- Export: print-perfect PDF (browser print) and a real `.docx` built with python-docx
- JSON draft import/export so a resume moves between devices
- Nothing is stored server-side; only text sent to AI features leaves the browser

## Stack

Vanilla JS SPA + FastAPI. AI requests proxy through the server to **free OpenRouter
models**, so the API key never reaches the client. Requests try a chain and fall
through on 429/5xx/empty:

1. `nvidia/nemotron-3-ultra-550b-a55b:free` (strongest, ~10-18s)
2. `minimax/minimax-m3.1-flash:free` (faster fallback)
3. `openrouter/free` (router picks whatever is up)

Rate limits: 60 AI calls/hour/IP plus a global daily cap.

Note: opencode's `deepseek-v4.1-flash-free` cannot be used here — that tier is
gated to calls made from inside the OpenCode client itself (`FreeTierError`
for every API request, key or no key).

## Run locally

```bash
python3 -m venv venv && . venv/bin/activate
pip install -r requirements.txt
export OPENCODE_GO_API_KEY=...
uvicorn app:app --port 8801
```

## Deploy

```bash
./deploy.sh
```

Server side: `/opt/resumekit`, systemd unit `resumekit.service`, secrets in
`/etc/resumekit.env` (600), Caddy vhost `resume.kavilabs.dev` -> `127.0.0.1:8801`.

## Env vars

| var | default | purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | required for the free models |
| `AI_MODELS` | nemotron → minimax → openrouter/free | comma-separated fallback chain |
| `OPENCODE_GO_API_KEY` | — | optional, only for non-`:free` model ids |
| `GLOBAL_DAILY_AI` | `1500` | global daily AI call cap |

## API

- `POST /api/ai` `{task, payload}` — tasks: `bullets`, `summary`, `skills`, `review`, `cover`, `tailor`
- `POST /api/export/docx` `{resume}` — returns a .docx
- `GET /api/health`

## Note on free models

The free OpenRouter models are reasoning models. Reasoning tokens count against
`max_tokens`, so a short budget returns empty content; `call_ai` retries once at
double the budget before moving to the next model in the chain. Free tier also
rate-limits hard (429), which is why the chain exists instead of a single model.
