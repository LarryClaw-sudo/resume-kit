"""
ResumeKit backend: static SPA + AI proxy (opencode go / deepseek-v4.1-flash) + DOCX export.
"""
import io
import json
import os
import re
import time
import uuid
from collections import defaultdict
from datetime import date
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT

BASE_DIR = Path(__file__).resolve().parent
STATIC = BASE_DIR / "static"

API_KEY = os.environ.get("OPENCODE_GO_API_KEY", "")
API_BASE = os.environ.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/go/v1")
MODEL = os.environ.get("RESUME_MODEL", "deepseek-v4.1-flash")

WINDOW = 3600
PER_IP_HOURLY = 60
GLOBAL_DAILY = int(os.environ.get("GLOBAL_DAILY_AI", "1500"))

app = FastAPI(title="ResumeKit", docs_url=None, redoc_url=None)

_ip_hits = defaultdict(list)
_daily = {"day": date.today().isoformat(), "count": 0}
client = httpx.AsyncClient(timeout=90.0)

# ---------------------------------------------------------------- rate limiting
def check_limit(request: Request):
    global _daily
    today = date.today().isoformat()
    if _daily["day"] != today:
        _daily = {"day": today, "count": 0}
    if _daily["count"] >= GLOBAL_DAILY:
        raise HTTPException(429, "Daily AI quota reached on this demo instance. Try again tomorrow.")
    ip = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
    now = time.time()
    hits = [t for t in _ip_hits[ip] if now - t < WINDOW]
    if len(hits) >= PER_IP_HOURLY:
        raise HTTPException(429, "You've hit the hourly AI limit. Give it a few minutes.")
    hits.append(now)
    _ip_hits[ip] = hits
    _daily["count"] += 1

# ---------------------------------------------------------------- AI plumbing
def strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json|markdown|md|text)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()

def parse_json(text: str):
    text = strip_fences(text)
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None

async def call_ai(messages, max_tokens=900, temperature=0.5, effort="minimal"):
    if not API_KEY:
        raise HTTPException(500, "AI backend is not configured.")
    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        # deepseek-v4.1-flash is a reasoning model: without this, reasoning tokens
        # eat the whole budget and content comes back empty.
        "reasoning_effort": effort,
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "x-opencode-session": str(uuid.uuid4()),
    }
    for attempt in range(2):
        try:
            r = await client.post(f"{API_BASE}/chat/completions", json=payload, headers=headers)
            if r.status_code >= 500 and attempt == 0:
                continue
            if r.status_code != 200:
                raise HTTPException(502, f"AI provider returned {r.status_code}")
            data = r.json()
            content = (data["choices"][0]["message"].get("content") or "").strip()
            if not content and attempt == 0:
                payload["max_tokens"] = max_tokens * 2
                continue
            return content
        except httpx.TimeoutException:
            if attempt == 1:
                raise HTTPException(504, "AI timed out. Try again.")
    raise HTTPException(502, "AI request failed.")

SYSTEM = (
    "You are a senior resume writer and ATS specialist with 15 years of recruiting experience. "
    "You write tight, concrete, metric-driven resume language. No fluff, no first person, no cliches. "
    "Never invent employers or credentials the candidate did not provide. "
    "Follow the requested output format exactly."
)

def resume_digest(resume: dict, limit=3500) -> str:
    parts = []
    c = resume.get("contact", {})
    parts.append(f"Name: {c.get('name','')} | Target title: {c.get('title','')}")
    if resume.get("summary"):
        parts.append(f"Summary: {resume['summary'][:400]}")
    for e in resume.get("experience", [])[:6]:
        parts.append(
            f"EXPERIENCE {e.get('role','')} at {e.get('company','')} ({e.get('start','')}-{e.get('end','')}): "
            + " ".join(e.get("bullets", []))[:600]
        )
    for ed in resume.get("education", [])[:3]:
        parts.append(f"EDUCATION {ed.get('degree','')} {ed.get('field','')} {ed.get('school','')} {ed.get('end','')}")
    skills = resume.get("skills", [])
    flat = []
    for s in skills:
        flat.extend(s.get("items", []) if isinstance(s, dict) else [str(s)])
    if flat:
        parts.append("SKILLS: " + ", ".join(flat)[:400])
    for p in resume.get("projects", [])[:3]:
        parts.append(f"PROJECT {p.get('name','')}: {p.get('description','')}")
    return "\n".join(parts)[:limit]


async def handle_task(task: str, p: dict):
    if task == "bullets":
        role = (p.get("role") or "professional")[:120]
        company = (p.get("company") or "")[:120]
        seed = (p.get("input") or "").strip()[:600]
        n = max(1, min(int(p.get("count") or 4), 5))
        msg = (
            f"Job title: {role}. Company: {company}.\n"
            f"Candidate's rough note: {seed or '(none, infer typical responsibilities)'}\n\n"
            f"Write {n} resume bullet points. Rules: start with a strong past-tense verb, "
            f"include a plausible metric placeholder only if it is clearly derived from the note, "
            f"12-24 words each, no periods at the end, no personal pronouns. "
            f'Return JSON only: {{"bullets": ["...", "..."]}}'
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 1000)
        data = parse_json(out)
        if isinstance(data, dict) and isinstance(data.get("bullets"), list):
            return {"bullets": [str(b).strip(" -•") for b in data["bullets"]][:n]}
        lines = [l.strip(" -•0123456789.") for l in strip_fences(out).splitlines() if len(l.strip()) > 12]
        return {"bullets": lines[:n]}

    if task == "summary":
        digest = resume_digest(p.get("resume", {}))
        jd = (p.get("jobDescription") or "")[:1500]
        msg = (
            f"Candidate:\n{digest}\n\n" + (f"Target job description:\n{jd}\n\n" if jd else "")
            + "Write a 3-sentence professional summary (45-65 words) in third person without pronouns, "
              "mirroring the target job's keywords where honest. Plain text, no label, no quotes."
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 800, 0.55)
        return {"summary": strip_fences(out).strip('"').strip()}

    if task == "skills":
        role = (p.get("role") or "professional")[:120]
        existing = ", ".join(p.get("existing", []) or [])[:400]
        msg = (
            f"Role: {role}. Existing skills: {existing or 'none'}.\n"
            "List 12 hard and soft skills that belong on this resume, ATS-recognizable wording, 1-3 words each. "
            'Return JSON only: {"skills": ["...", "..."]}'
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 700)
        data = parse_json(out)
        if isinstance(data, dict) and isinstance(data.get("skills"), list):
            return {"skills": [str(s) for s in data["skills"]][:14]}
        return {"skills": [l.strip(" -•").strip() for l in strip_fences(out).splitlines() if l.strip()][:14]}

    if task == "review":
        digest = resume_digest(p.get("resume", {}))
        msg = (
            f"Review this resume:\n{digest}\n\n"
            "Score it 0-100 for ATS readiness and recruiter impact. Identify up to 5 concrete problems "
            "(weak verbs, missing metrics, length, keyword gaps, formatting risks) and one rewrite for the "
            "single weakest bullet.\n"
            'Return JSON only: {"score": 0, "verdict": "one sentence", "strengths": ["..."], '
            '"fixes": [{"issue": "...", "fix": "..."}], "rewrite": {"before": "...", "after": "..."}}'
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 1800, 0.35, effort="low")
        data = parse_json(out)
        if not isinstance(data, dict):
            raise HTTPException(502, "Could not parse the review. Try again.")
        return data

    if task == "cover":
        digest = resume_digest(p.get("resume", {}))
        jd = (p.get("jobDescription") or "")[:2000]
        company = (p.get("company") or "the company")[:100]
        role = (p.get("role") or "the role")[:100]
        msg = (
            f"Candidate:\n{digest}\n\nCompany: {company}\nRole: {role}\nJob description:\n{jd or '(not provided)'}\n\n"
            "Write a cover letter: 3 paragraphs, under 260 words, specific to the role, no cliches "
            "('I am writing to apply'), no invented facts. Start with the hook. Plain text with a greeting "
            "and sign-off using the candidate's name."
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 1500, 0.6)
        return {"letter": strip_fences(out)}

    if task == "tailor":
        digest = resume_digest(p.get("resume", {}))
        jd = (p.get("jobDescription") or "")[:2000]
        msg = (
            f"Candidate:\n{digest}\n\nJob description:\n{jd}\n\n"
            "Rewrite the summary for this job and propose 3 replacement bullets for the most recent role, "
            "using the JD's exact keywords honestly.\n"
            'Return JSON only: {"summary": "...", "bullets": ["...", "...", "..."], '
            '"keywords": ["..."]}'
        )
        out = await call_ai([{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}], 1600, 0.45)
        data = parse_json(out)
        if not isinstance(data, dict):
            raise HTTPException(502, "Could not parse tailoring output. Try again.")
        return data

    raise HTTPException(400, "Unknown task")

@app.post("/api/ai")
async def ai_endpoint(request: Request):
    check_limit(request)
    body = await request.json()
    task = body.get("task")
    payload = body.get("payload") or {}
    return JSONResponse(await handle_task(task, payload))

@app.get("/api/health")
async def health():
    return {"ok": True, "model": MODEL, "has_key": bool(API_KEY)}

# ---------------------------------------------------------------- DOCX export
def _p(doc, text="", size=10.5, bold=False, italic=False, space_after=2, space_before=0,
       align=None, color=None, upper=False):
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    pf.line_spacing = 1.06
    if align:
        par.alignment = align
    run = par.add_run(text.upper() if upper else text)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.name = "Calibri"
    if color:
        run.font.color.rgb = RGBColor(*color)
    return par

def build_docx(r: dict) -> io.BytesIO:
    doc = Document()
    for s in doc.sections:
        s.top_margin = Inches(0.55)
        s.bottom_margin = Inches(0.55)
        s.left_margin = Inches(0.65)
        s.right_margin = Inches(0.65)
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)

    c = r.get("contact", {})
    if c.get("name"):
        _p(doc, c["name"], 20, True, space_after=1)
    if c.get("title"):
        _p(doc, c["title"], 11.5, False, italic=True, space_after=3, color=(0x33, 0x33, 0x33))
    contact = " | ".join(x for x in [c.get("email"), c.get("phone"), c.get("location"),
                                     c.get("website"), c.get("linkedin")] if x)
    if contact:
        _p(doc, contact, 9.5, space_after=6, color=(0x44, 0x44, 0x44))

    def heading(t):
        par = _p(doc, t, 11, True, space_before=8, space_after=3, upper=True, color=(0x11, 0x11, 0x11))
        pr = par._p.get_or_add_pPr()
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement
        bdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), "999999")
        bdr.append(bottom)
        pr.append(bdr)

    if r.get("summary"):
        heading("Summary")
        _p(doc, r["summary"], 10.5, space_after=2)

    if r.get("experience"):
        heading("Experience")
        for e in r["experience"]:
            par = doc.add_paragraph()
            pf = par.paragraph_format
            pf.space_before = Pt(4); pf.space_after = Pt(0)
            pf.tab_stops.add_tab_stop(Inches(7.0), WD_TAB_ALIGNMENT.RIGHT)
            run = par.add_run(e.get("role", ""))
            run.bold = True; run.font.size = Pt(10.5); run.font.name = "Calibri"
            dates = " – ".join(x for x in [e.get("start"), "Present" if e.get("current") else e.get("end")] if x)
            if dates:
                par.add_run("\t" + dates).font.size = Pt(9.5)
            sub = " — ".join(x for x in [e.get("company"), e.get("location")] if x)
            if sub:
                _p(doc, sub, 10, italic=True, space_after=1, color=(0x33, 0x33, 0x33))
            for b in e.get("bullets", []):
                if b.strip():
                    bp = doc.add_paragraph(style="List Bullet")
                    bp.paragraph_format.space_after = Pt(1)
                    bp.paragraph_format.line_spacing = 1.04
                    bp.add_run(b.strip()).font.size = Pt(10.5)

    if r.get("education"):
        heading("Education")
        for ed in r["education"]:
            par = doc.add_paragraph()
            par.paragraph_format.space_before = Pt(3); par.paragraph_format.space_after = Pt(0)
            par.paragraph_format.tab_stops.add_tab_stop(Inches(7.0), WD_TAB_ALIGNMENT.RIGHT)
            line = ", ".join(x for x in [ed.get("degree"), ed.get("field")] if x) or "Degree"
            run = par.add_run(line); run.bold = True; run.font.size = Pt(10.5)
            dates = " – ".join(x for x in [ed.get("start"), ed.get("end")] if x)
            if dates:
                par.add_run("\t" + dates).font.size = Pt(9.5)
            sub = " — ".join(x for x in [ed.get("school"), ed.get("location")] if x)
            if sub:
                _p(doc, sub, 10, italic=True, space_after=1, color=(0x33, 0x33, 0x33))
            if ed.get("details"):
                _p(doc, ed["details"], 10, space_after=1)

    if r.get("projects"):
        heading("Projects")
        for pr in r["projects"]:
            par = doc.add_paragraph()
            par.paragraph_format.space_before = Pt(3); par.paragraph_format.space_after = Pt(0)
            run = par.add_run(pr.get("name", "")); run.bold = True; run.font.size = Pt(10.5)
            if pr.get("link"):
                par.add_run("  " + pr["link"]).font.size = Pt(9.5)
            if pr.get("description"):
                _p(doc, pr["description"], 10, space_after=1)

    skills = r.get("skills", [])
    if skills:
        heading("Skills")
        for s in skills:
            items = s.get("items", []) if isinstance(s, dict) else [s]
            if not items:
                continue
            label = (s.get("category") or "").strip() if isinstance(s, dict) else ""
            par = doc.add_paragraph()
            par.paragraph_format.space_after = Pt(1)
            if label:
                run = par.add_run(label + ": "); run.bold = True; run.font.size = Pt(10.5)
            par.add_run(", ".join(items)).font.size = Pt(10.5)

    if r.get("certifications"):
        heading("Certifications")
        for cert in r["certifications"]:
            line = " — ".join(x for x in [cert.get("name"), cert.get("issuer"), cert.get("year")] if x)
            _p(doc, line, 10, space_after=1)

    if r.get("languages"):
        heading("Languages")
        _p(doc, ", ".join(f"{l.get('name','')} ({l.get('level','')})" if l.get("level") else l.get("name", "")
                          for l in r["languages"]), 10)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf

@app.post("/api/export/docx")
async def export_docx(request: Request):
    body = await request.json()
    resume = body.get("resume") or {}
    buf = build_docx(resume)
    name = re.sub(r"[^A-Za-z0-9]+", "_", (resume.get("contact", {}).get("name") or "resume")).strip("_") or "resume"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{name}_Resume.docx"'},
    )

# ---------------------------------------------------------------- static
@app.get("/build")
async def build_page():
    return FileResponse(STATIC / "build.html")

@app.get("/")
async def index():
    return FileResponse(STATIC / "index.html")

app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
