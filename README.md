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

Vanilla JS SPA + FastAPI. AI requests proxy through the server to opencode zen
(`deepseek-v4.1-flash`), so the API key never reaches the client.
Rate limits: 60 AI calls/hour/IP plus a global daily cap.

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
| `OPENCODE_GO_API_KEY` | — | required, opencode zen key |
| `OPENCODE_BASE_URL` | `https://opencode.ai/zen/go/v1` | provider base |
| `RESUME_MODEL` | `deepseek-v4.1-flash` | model id |
| `GLOBAL_DAILY_AI` | `1500` | global daily AI call cap |

## API

- `POST /api/ai` `{task, payload}` — tasks: `bullets`, `summary`, `skills`, `review`, `cover`, `tailor`
- `POST /api/export/docx` `{resume}` — returns a .docx
- `GET /api/health`

## Note on the model

`deepseek-v4.1-flash` is a reasoning model. Requests send `reasoning_effort: "minimal"`;
without it the reasoning tokens consume the whole `max_tokens` budget and content comes
back empty.
