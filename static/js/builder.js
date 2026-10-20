/* ResumeKit builder */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = 'resumekit.draft.v1';
const ACCENTS = ['#0f766e', '#1d4ed8', '#111827', '#7c3aed', '#b45309', '#be123c', '#0e7490', '#4d7c0f'];

const sample = () => ({
  template: 'modern',
  font: 'sans',
  accent: '#0f766e',
  contact: {
    name: 'Maya Rodrigues',
    title: 'Product Designer',
    email: 'maya.rodrigues@email.com',
    phone: '(617) 555-0148',
    location: 'Boston, MA',
    website: 'mayarodrigues.design',
    linkedin: 'linkedin.com/in/mayarodrigues'
  },
  summary: 'Product designer with 6 years shaping consumer and B2B tools used by 2M+ people. Led design for a checkout rebuild that lifted conversion 18% and cut support tickets by a third. Comfortable owning research through shipped UI in small, fast teams.',
  experience: [
    {
      role: 'Senior Product Designer', company: 'Northwind Labs', location: 'Boston, MA',
      start: 'Mar 2022', end: '', current: true,
      bullets: [
        'Led end-to-end redesign of the checkout flow, lifting conversion 18% and reducing drop-off at payment by 24%',
        'Built a 40-component design system adopted by 5 product squads, cutting new-feature design time from 3 weeks to 8 days',
        'Ran 60+ moderated usability sessions and turned findings into a quarterly roadmap adopted by leadership'
      ]
    },
    {
      role: 'Product Designer', company: 'Fieldnote', location: 'Remote',
      start: 'Jun 2019', end: 'Feb 2022', current: false,
      bullets: [
        'Shipped the first mobile onboarding flow, taking activation from 41% to 63% within two quarters',
        'Partnered with two engineers to instrument analytics for every core screen, replacing guesswork with funnel data'
      ]
    }
  ],
  education: [
    { degree: 'B.F.A.', field: 'Graphic Design', school: 'Massachusetts College of Art', location: 'Boston, MA', start: '2013', end: '2017', gpa: '', details: '' }
  ],
  skills: [
    { category: 'Design', items: ['Figma', 'Design systems', 'Prototyping', 'Interaction design', 'Accessibility (WCAG)'] },
    { category: 'Research', items: ['Usability testing', 'Interviews', 'Survey design', 'A/B testing'] },
    { category: 'Technical', items: ['HTML/CSS', 'React basics', 'Amplitude', 'Storybook'] }
  ],
  projects: [
    { name: 'Openframe', link: 'openframe.design', description: 'Side project: a free accessibility checklist used by 4,000+ designers.' }
  ],
  certifications: [{ name: 'Human-Computer Interaction', issuer: 'Nielsen Norman Group', year: '2021' }],
  languages: [{ name: 'Portuguese', level: 'Native' }, { name: 'Spanish', level: 'Conversational' }]
});

let state = load();
let zoom = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return sample();
    const s = JSON.parse(raw);
    return Object.assign(sample(), s);
  } catch (e) { return sample(); }
}
function save() {
  clearTimeout(save._t);
  save._t = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(state)), 250);
}
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- editor ---------------- */
const SECTIONS = [
  ['contact', 'Contact details', 'Name, title, and how recruiters reach you.'],
  ['summary', 'Professional summary', 'Three sentences. Who you are, what you have done, what you want next.'],
  ['experience', 'Work experience', 'Most recent first. 3-5 bullets per role, each with a result.'],
  ['education', 'Education', 'Degree, school, dates. GPA only if it helps you.'],
  ['skills', 'Skills', 'Group them. ATS reads the words, humans read the grouping.'],
  ['projects', 'Projects', 'Optional. Strong for career changers and new grads.'],
  ['extras', 'Certifications & languages', 'Optional. Drop these if you need space.']
];

function renderTabs() {
  $('#tabs').innerHTML = SECTIONS.map(([id, name]) =>
    `<button class="tab" data-goto="${id}">${name.split(' ')[0]}</button>`).join('');
}

function field(label, path, value, opts = {}) {
  const v = esc(value || '');
  if (opts.textarea) {
    return `<div class="field"><label>${label}</label><textarea data-path="${path}" placeholder="${esc(opts.ph || '')}">${v}</textarea></div>`;
  }
  return `<div class="field"><label>${label}</label><input data-path="${path}" value="${v}" placeholder="${esc(opts.ph || '')}" ${opts.type ? `type="${opts.type}"` : ''}></div>`;
}

function renderEditor() {
  const out = [];
  out.push(`<div class="acc open" data-sec="contact">
    <div class="acc-head"><h3>Contact details</h3><span class="chev">▾</span></div>
    <div class="acc-body">
      <div class="row2">${field('Full name', 'contact.name', state.contact.name, { ph: 'Maya Rodrigues' })}${field('Target job title', 'contact.title', state.contact.title, { ph: 'Product Designer' })}</div>
      <div class="row2">${field('Email', 'contact.email', state.contact.email, { type: 'email' })}${field('Phone', 'contact.phone', state.contact.phone)}</div>
      <div class="row2">${field('Location', 'contact.location', state.contact.location, { ph: 'Boston, MA' })}${field('Website', 'contact.website', state.contact.website)}</div>
      ${field('LinkedIn', 'contact.linkedin', state.contact.linkedin)}
    </div></div>`);

  out.push(`<div class="acc" data-sec="summary">
    <div class="acc-head"><h3>Professional summary</h3><span class="chev">▾</span></div>
    <div class="acc-body">
      ${field('Summary', 'summary', state.summary, { textarea: true, ph: 'Two or three sentences on your impact.' })}
      <div class="ai-row">
        <button class="ai-chip" data-act="ai-summary">✦ Write with AI</button>
        <button class="ai-chip" data-act="tailor">⇄ Tailor to a job</button>
      </div>
    </div></div>`);

  out.push(`<div class="acc" data-sec="experience">
    <div class="acc-head"><h3>Work experience</h3><span class="chev">▾</span></div>
    <div class="acc-body"><div id="expList">${expEditor()}</div>
      <button class="btn btn-outline" style="margin-top:10px;width:100%;justify-content:center" data-act="add-exp">+ Add role</button>
    </div></div>`);

  out.push(`<div class="acc" data-sec="education">
    <div class="acc-head"><h3>Education</h3><span class="chev">▾</span></div>
    <div class="acc-body"><div id="eduList">${eduEditor()}</div>
      <button class="btn btn-outline" style="margin-top:10px;width:100%;justify-content:center" data-act="add-edu">+ Add education</button>
    </div></div>`);

  out.push(`<div class="acc" data-sec="skills">
    <div class="acc-head"><h3>Skills</h3><span class="chev">▾</span></div>
    <div class="acc-body"><div id="skillList">${skillEditor()}</div>
      <div class="ai-row">
        <button class="btn btn-outline" data-act="add-skill" style="font-size:12px">+ Add group</button>
        <button class="ai-chip" data-act="ai-skills">✦ Suggest skills for my role</button>
      </div>
    </div></div>`);

  out.push(`<div class="acc" data-sec="projects">
    <div class="acc-head"><h3>Projects</h3><span class="chev">▾</span></div>
    <div class="acc-body"><div id="projList">${projEditor()}</div>
      <button class="btn btn-outline" style="margin-top:10px;width:100%;justify-content:center" data-act="add-proj">+ Add project</button>
    </div></div>`);

  out.push(`<div class="acc" data-sec="extras">
    <div class="acc-head"><h3>Certifications & languages</h3><span class="chev">▾</span></div>
    <div class="acc-body"><div id="certList">${certEditor()}</div>
      <button class="btn btn-outline" style="margin-top:10px;width:100%;justify-content:center" data-act="add-cert">+ Add certification</button>
      <div style="height:12px"></div><div id="langList">${langEditor()}</div>
      <button class="btn btn-outline" style="margin-top:10px;width:100%;justify-content:center" data-act="add-lang">+ Add language</button>
    </div></div>`);

  $('#editor').innerHTML = out.join('');
}

function expEditor() {
  return state.experience.map((e, i) => `
  <div class="entry" data-i="${i}">
    <div class="entry-head"><b>Role ${i + 1}</b>
      <button class="mini" data-act="up" data-list="experience" data-i="${i}">↑</button>
      <button class="mini" data-act="down" data-list="experience" data-i="${i}">↓</button>
      <button class="mini danger" data-act="del" data-list="experience" data-i="${i}">Remove</button>
    </div>
    <div class="row2">${field('Job title', `experience.${i}.role`, e.role)}
      ${field('Company', `experience.${i}.company`, e.company)}</div>
    <div class="row2">${field('Location', `experience.${i}.location`, e.location)}${field('Dates', `experience.${i}.start`, e.start, { ph: 'Mar 2022' })}</div>
    <div class="row2"><div class="field"><label>Currently here?</label>
        <select data-path="experience.${i}.current"><option value="false" ${!e.current ? 'selected' : ''}>No</option><option value="true" ${e.current ? 'selected' : ''}>Yes</option></select></div>
      ${e.current ? '' : field('End date', `experience.${i}.end`, e.end, { ph: 'Feb 2024' })}</div>
    <label style="display:block;font-size:11px;font-weight:650;color:var(--muted);letter-spacing:.03em;text-transform:uppercase;margin:12px 0 5px">Bullets</label>
    <div class="bullets-list" id="bl-${i}">${bulletsEditor(e, i)}</div>
    <div class="ai-row">
      <button class="mini" data-act="add-bullet" data-i="${i}">+ bullet</button>
      <button class="ai-chip" data-act="ai-bullets" data-i="${i}">✦ Generate bullets</button>
    </div>
    <div class="field" style="margin-top:6px"><input data-ai-note="${i}" placeholder="Rough note for AI: managed front desk, cut wait times…"></div>
  </div>`).join('') || '<div class="acc-hint">No roles yet. Add one below.</div>';
}

function bulletsEditor(e, i) {
  const arr = e.bullets || [];
  return arr.map((b, j) => `<div class="bullet-row">
    <textarea data-path="experience.${i}.bullets.${j}">${esc(b)}</textarea>
    <button class="x" data-act="del-bullet" data-i="${i}" data-j="${j}" title="Delete">✕</button></div>`).join('');
}

function eduEditor() {
  return state.education.map((e, i) => `
  <div class="entry">
    <div class="entry-head"><b>Education ${i + 1}</b>
      <button class="mini" data-act="up" data-list="education" data-i="${i}">↑</button>
      <button class="mini" data-act="down" data-list="education" data-i="${i}">↓</button>
      <button class="mini danger" data-act="del" data-list="education" data-i="${i}">Remove</button></div>
    <div class="row2">${field('Degree', `education.${i}.degree`, e.degree, { ph: 'B.S.' })}${field('Field', `education.${i}.field`, e.field, { ph: 'Computer Science' })}</div>
    <div class="row2">${field('School', `education.${i}.school`, e.school)}${field('Location', `education.${i}.location`, e.location)}</div>
    <div class="row3">${field('Start', `education.${i}.start`, e.start)}${field('End', `education.${i}.end`, e.end)}${field('GPA', `education.${i}.gpa`, e.gpa)}</div>
    ${field('Details (optional)', `education.${i}.details`, e.details)}
  </div>`).join('') || '<div class="acc-hint">No education yet.</div>';
}

function skillEditor() {
  return state.skills.map((s, i) => `
  <div class="entry">
    <div class="row2">${field('Group', `skills.${i}.category`, s.category, { ph: 'Design' })}
      <div class="field"><label>&nbsp;</label><button class="mini danger" style="width:100%;padding:9px" data-act="del" data-list="skills" data-i="${i}">Remove group</button></div></div>
    <div class="field"><label>Skills (comma separated)</label>
      <input data-path="skills.${i}.items" value="${esc((s.items || []).join(', '))}"></div>
  </div>`).join('') || '<div class="acc-hint">No skill groups yet.</div>';
}

function projEditor() {
  return state.projects.map((p, i) => `
  <div class="entry">
    <div class="entry-head"><b>Project ${i + 1}</b>
      <button class="mini danger" data-act="del" data-list="projects" data-i="${i}">Remove</button></div>
    <div class="row2">${field('Name', `projects.${i}.name`, p.name)}${field('Link', `projects.${i}.link`, p.link)}</div>
    ${field('Description', `projects.${i}.description`, p.description, { textarea: true })}
  </div>`).join('') || '<div class="acc-hint">No projects yet.</div>';
}

function certEditor() {
  return state.certifications.map((c, i) => `
  <div class="entry">
    <div class="entry-head"><b>Certification ${i + 1}</b>
      <button class="mini danger" data-act="del" data-list="certifications" data-i="${i}">Remove</button></div>
    <div class="row2">${field('Name', `certifications.${i}.name`, c.name)}${field('Issuer', `certifications.${i}.issuer`, c.issuer)}</div>
    ${field('Year', `certifications.${i}.year`, c.year)}
  </div>`).join('') || '<div class="acc-hint">None added.</div>';
}

function langEditor() {
  return state.languages.map((l, i) => `
  <div class="entry"><div class="row2">${field('Language', `languages.${i}.name`, l.name)}${field('Level', `languages.${i}.level`, l.level, { ph: 'Native' })}</div>
    <button class="mini danger" data-act="del" data-list="languages" data-i="${i}">Remove</button></div>`).join('') || '<div class="acc-hint">None added.</div>';
}

function refreshLists() {
  const map = { experience: ['#expList', expEditor], education: ['#eduList', eduEditor],
    skills: ['#skillList', skillEditor], projects: ['#projList', projEditor],
    certifications: ['#certList', certEditor], languages: ['#langList', langEditor] };
  for (const k in map) {
    const el = $(map[k][0]);
    if (el) el.innerHTML = map[k][1]();
  }
}

/* ---------------- state writes ---------------- */
function setPath(path, value) {
  const parts = path.split('.');
  let o = state;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = Array.isArray(o) ? +parts[i] : parts[i];
    o = o[k];
  }
  const last = parts[parts.length - 1];
  if (path.endsWith('.items')) {
    o.items = value.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(o)) {
    o[+last] = value;
  } else {
    o[last] = value;
  }
}

$('#editor').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.path) {
    setPath(t.dataset.path, t.value);
    save(); renderPreview();
  }
  if (t.matches('select[data-path]')) {
    const p = t.dataset.path.split('.');
    if (p[0] === 'experience' && p[2] === 'current') {
      state.experience[+p[1]].current = t.value === 'true';
      refreshLists();
      renderPreview();
    }
  }
});
$('#editor').addEventListener('change', e => {
  const t = e.target;
  if (t.matches('select[data-path]')) {
    const p = t.dataset.path.split('.');
    state.experience[+p[1]].current = t.value === 'true';
    save(); refreshLists(); renderPreview();
  }
});
$('#editor').addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act, i = +btn.dataset.i, list = btn.dataset.list;
  if (act === 'add-exp') { state.experience.push({ role: '', company: '', location: '', start: '', end: '', current: false, bullets: [''] }); }
  if (act === 'add-edu') { state.education.push({ degree: '', field: '', school: '', location: '', start: '', end: '', gpa: '', details: '' }); }
  if (act === 'add-skill') { state.skills.push({ category: '', items: [] }); }
  if (act === 'add-proj') { state.projects.push({ name: '', link: '', description: '' }); }
  if (act === 'add-cert') { state.certifications.push({ name: '', issuer: '', year: '' }); }
  if (act === 'add-lang') { state.languages.push({ name: '', level: '' }); }
  if (act === 'add-bullet') { state.experience[i].bullets.push(''); }
  if (act === 'del-bullet') { state.experience[i].bullets.splice(+btn.dataset.j, 1); }
  if (act === 'del') {
    if (!confirm('Remove this entry?')) return;
    state[list].splice(i, 1);
  }
  if (act === 'up' && i > 0) { const a = state[list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }
  if (act === 'down' && i < state[list].length - 1) { const a = state[list]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; }

  if (['add-exp', 'add-edu', 'add-skill', 'add-proj', 'add-cert', 'add-lang', 'add-bullet', 'del-bullet', 'del', 'up', 'down'].includes(act)) {
    save(); refreshLists(); renderPreview();
  }

  if (act === 'ai-summary') {
    btn.disabled = true; btn.textContent = 'Writing…';
    try {
      const r = await ai('summary', { resume: state });
      state.summary = r.summary; save();
      $('[data-path="summary"]').value = r.summary;
      renderPreview(); toast('Summary written.');
    } catch (err) { toast(err.message); }
    btn.disabled = false; btn.textContent = '✦ Write with AI';
  }

  if (act === 'ai-bullets') {
    const note = $(`[data-ai-note="${i}"]`);
    const e2 = state.experience[i];
    btn.disabled = true; btn.textContent = 'Thinking…';
    try {
      const r = await ai('bullets', { role: e2.role, company: e2.company, input: note ? note.value : '', count: 4 });
      e2.bullets = [...(e2.bullets || []).filter(b => b.trim()), ...r.bullets];
      save(); refreshLists(); renderPreview();
      toast(r.bullets.length + ' bullets added.');
    } catch (err) { toast(err.message); }
    btn.disabled = false; btn.textContent = '✦ Generate bullets';
  }

  if (act === 'ai-skills') {
    btn.disabled = true; btn.textContent = 'Thinking…';
    try {
      const existing = state.skills.flatMap(s => s.items || []);
      const r = await ai('skills', { role: state.contact.title || 'professional', existing });
      if (!state.skills.length) state.skills.push({ category: 'Skills', items: [] });
      state.skills[0].items = [...new Set([...(state.skills[0].items || []), ...r.skills])];
      save(); refreshLists(); renderPreview();
      toast('Skills suggested.');
    } catch (err) { toast(err.message); }
    btn.disabled = false; btn.textContent = '✦ Suggest skills for my role';
  }

  if (act === 'tailor') { openTailor(); }
});

/* tabs */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-goto]');
  if (!b) return;
  $$('.tab').forEach(t => t.classList.toggle('active', t === b));
  const sec = $(`.acc[data-sec="${b.dataset.goto}"]`);
  if (sec) {
    $$('.acc').forEach(a => a.classList.toggle('open', a === sec));
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
document.addEventListener('click', e => {
  const h = e.target.closest('.acc-head');
  if (h) h.parentElement.classList.toggle('open');
});

/* ---------------- preview ---------------- */
function renderPreview() {
  const c = state.contact || {};
  const contactBits = [c.email, c.phone, c.location, c.website, c.linkedin].filter(Boolean);
  const body = [];

  const sections = [];
  if (state.summary && state.summary.trim()) {
    sections.push(`<div class="section"><div class="sec-title">Summary</div><p class="summary">${esc(state.summary)}</p></div>`);
  }
  if (state.experience.some(e => e.role || e.company)) {
    sections.push(`<div class="section"><div class="sec-title">Experience</div>${state.experience.map(e => {
      if (!e.role && !e.company) return '';
      const dates = [e.start, e.current ? 'Present' : e.end].filter(Boolean).join(' – ');
      const sub = [e.company, e.location].filter(Boolean).join(' · ');
      const bullets = (e.bullets || []).filter(b => b.trim());
      return `<div class="item"><div class="item-head"><span class="item-title">${esc(e.role || '')}</span><span class="item-dates">${esc(dates)}</span></div>
        ${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${bullets.length ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
    }).join('')}</div>`);
  }
  if (state.education.some(e => e.school || e.degree)) {
    sections.push(`<div class="section"><div class="sec-title">Education</div>${state.education.map(e => {
      if (!e.school && !e.degree) return '';
      const line = [e.degree, e.field].filter(Boolean).join(', ');
      const dates = [e.start, e.end].filter(Boolean).join(' – ');
      const sub = [e.school, e.location].filter(Boolean).join(' · ');
      return `<div class="item"><div class="item-head"><span class="item-title">${esc(line || e.school)}</span><span class="item-dates">${esc(dates)}</span></div>
        ${line && e.school ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${e.gpa ? `<div class="small-line">GPA: ${esc(e.gpa)}</div>` : ''}
        ${e.details ? `<div class="small-line">${esc(e.details)}</div>` : ''}</div>`;
    }).join('')}</div>`);
  }
  const skills = (state.skills || []).filter(s => (s.items || []).length);
  if (skills.length) {
    const chipped = ['modern', 'tech', 'bold'].includes(state.template);
    sections.push(`<div class="section"><div class="sec-title">Skills</div>${skills.map(s => chipped
      ? `<div class="skill-row"><b>${esc(s.category || 'Skills')}:</b><div class="chips" style="margin-top:3px">${s.items.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>`
      : `<div class="skill-row"><b>${esc(s.category || 'Skills')}:</b> ${esc(s.items.join(', '))}</div>`).join('')}</div>`);
  }
  const projects = (state.projects || []).filter(p => p.name || p.description);
  if (projects.length) {
    sections.push(`<div class="section"><div class="sec-title">Projects</div>${projects.map(p =>
      `<div class="item"><div class="item-head"><span class="item-title">${esc(p.name)}</span><span class="item-dates">${esc(p.link || '')}</span></div>
       ${p.description ? `<div class="small-line">${esc(p.description)}</div>` : ''}</div>`).join('')}</div>`);
  }
  const certs = (state.certifications || []).filter(c => c.name);
  if (certs.length) {
    sections.push(`<div class="section"><div class="sec-title">Certifications</div>${certs.map(c =>
      `<div class="small-line">${esc([c.name, c.issuer, c.year].filter(Boolean).join(' · '))}</div>`).join('')}</div>`);
  }
  const langs = (state.languages || []).filter(l => l.name);
  if (langs.length) {
    sections.push(`<div class="section"><div class="sec-title">Languages</div><div class="small-line">${esc(langs.map(l => l.level ? `${l.name} (${l.level})` : l.name).join(', '))}</div></div>`);
  }

  const header = `<div class="hd"><h1 class="name">${esc(c.name || 'Your Name')}</h1>
    ${c.title ? `<div class="title">${esc(c.title)}</div>` : ''}
    <div class="contact">${contactBits.map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`;

  const inner = state.template === 'bold'
    ? header + `<div class="body">${sections.join('')}</div>`
    : header + sections.join('');

  const el = $('#resume');
  el.className = `resume tpl-${state.template} ${state.font}`;
  el.style.setProperty('--accent-c', state.accent);
  el.innerHTML = inner;
  document.documentElement.style.setProperty('--accent', state.accent);
  applyZoom();
}

function applyZoom() {
  const wrap = $('#previewWrap');
  const avail = wrap.clientWidth - 56;
  const mm = 793.7; // 210mm at 96dpi
  const fit = Math.min(1, avail / mm);
  const scale = zoom == null ? fit : zoom;
  $('#sheetOuter').style.transform = `scale(${scale})`;
  $('#sheetOuter').style.height = `${$('.page').offsetHeight * scale}px`;
  $('#zoomLabel').textContent = Math.round(scale * 100) + '%';
}

$('#zoomIn').onclick = () => { zoom = Math.min(1.4, (zoom || 0.62) + 0.1); applyZoom(); };
$('#zoomOut').onclick = () => { zoom = Math.max(0.3, (zoom || 0.62) - 0.1); applyZoom(); };
$('#zoomFit').onclick = () => { zoom = null; applyZoom(); };
window.addEventListener('resize', applyZoom);

/* ---------------- toolbar ---------------- */
$('#swatches').innerHTML = ACCENTS.map(c =>
  `<button class="sw ${c === state.accent ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
$('#swatches').addEventListener('click', e => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  state.accent = b.dataset.color; save();
  $$('.sw').forEach(s => s.classList.toggle('active', s === b));
  renderPreview();
});
$('#tplSelect').value = state.template;
$('#tplSelect').onchange = e => { state.template = e.target.value; save(); renderPreview(); };
$$('#fontSeg button').forEach(b => {
  b.classList.toggle('active', b.dataset.font === state.font);
  b.onclick = () => { state.font = b.dataset.font; save(); $$('#fontSeg button').forEach(x => x.classList.toggle('active', x === b)); renderPreview(); };
});
const qp = new URLSearchParams(location.search).get('template');
if (qp) { state.template = qp; $('#tplSelect').value = qp; }

$('#btnPdf').onclick = () => { applyZoom(); window.print(); };
$('#btnDocx').onclick = async () => {
  const btn = $('#btnDocx'); btn.disabled = true; btn.textContent = 'Building…';
  try {
    const r = await fetch('/api/export/docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: state }) });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.contact.name || 'resume').replace(/\s+/g, '_') + '_Resume.docx';
    a.click(); URL.revokeObjectURL(a.href);
    toast('Word file downloaded.');
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = 'Word';
};
$('#btnJson').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.contact.name || 'resume').replace(/\s+/g, '_') + '_draft.json';
  a.click();
};
$('#btnImport').onclick = () => $('#fileInput').click();

/* ---------- import an existing resume (PDF / DOCX / TXT / pasted text) ---------- */
function openImport(err) {
  openModal(`<h2>Import your current resume</h2>
    <p class="sub">Upload the PDF or Word file and I'll fill in every section. Wording is copied as written, not rewritten.</p>
    <div id="dropZone" style="border:1.5px dashed #cbd5e1;border-radius:12px;padding:26px 18px;text-align:center;cursor:pointer;background:var(--soft)">
      <div style="font-size:22px;line-height:1">⬆</div>
      <div style="font-weight:650;font-size:14px;margin-top:8px">Drop a PDF, .docx or .txt here</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:3px">or click to choose a file (max 8 MB)</div>
      <input type="file" id="impFile" accept=".pdf,.docx,.doc,.txt,.md" hidden>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:16px 0 4px;color:var(--muted);font-size:12px">
      <div style="flex:1;height:1px;background:var(--line)"></div>or paste the text<div style="flex:1;height:1px;background:var(--line)"></div>
    </div>
    <div class="field"><textarea id="impText" style="min-height:120px" placeholder="Paste your resume text here…"></textarea></div>
    <button class="btn btn-primary" id="impGo" style="margin-top:12px;width:100%;justify-content:center">Fill my resume</button>
    <div id="impOut" style="margin-top:12px"></div>`);
  applyImportNotice(err);

  const dz = $('#dropZone'), fi = $('#impFile'), out = $('#impOut'), go = $('#impGo');
  let picked = null;
  dz.onclick = () => fi.click();
  fi.onchange = () => { if (fi.files[0]) { picked = fi.files[0]; dz.querySelector('div:nth-child(2)').textContent = picked.name; } };
  dz.ondragover = e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; dz.style.background = '#f0fbf8'; };
  dz.ondragleave = () => { dz.style.borderColor = '#cbd5e1'; dz.style.background = 'var(--soft)'; };
  dz.ondrop = e => {
    e.preventDefault(); dz.style.borderColor = '#cbd5e1'; dz.style.background = 'var(--soft)';
    const f = e.dataTransfer.files[0];
    if (f) { picked = f; dz.querySelector('div:nth-child(2)').textContent = f.name; }
  };
  go.onclick = async () => {
    const text = $('#impText').value.trim();
    if (!picked && !text) { out.innerHTML = '<p style="color:#b91c1c;font-size:13.5px">Pick a file or paste some text first.</p>'; return; }
    go.disabled = true; go.innerHTML = '<span class="spin"></span> Reading your resume…';
    out.innerHTML = '<p style="color:var(--muted);font-size:12.5px">Pulling out sections and dates. This takes 10-30 seconds.</p>';
    try {
      let data;
      if (picked) {
        const fd = new FormData(); fd.append('file', picked);
        const r = await fetch('/api/import', { method: 'POST', body: fd });
        data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || 'Import failed');
      } else {
        const r = await fetch('/api/import-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || 'Import failed');
      }
      const layout = { template: state.template, font: state.font, accent: state.accent };
      const imported = Object.assign(sample(), data.resume, layout);
      state = imported;
      save(); renderEditor(); renderPreview();
      $('#tplSelect').value = state.template;
      modal.classList.remove('open');
      const roles = (state.experience || []).length, edu = (state.education || []).length;
      toast(`Imported${roles ? ` · ${roles} role${roles > 1 ? 's' : ''}` : ''}${edu ? ` · ${edu} education` : ''}. Check the wording.`);
    } catch (e) {
      out.innerHTML = `<p style="color:#b91c1c;font-size:13.5px">${esc(e.message)}</p>`;
    }
    go.disabled = false; go.textContent = 'Fill my resume';
  };
}
/* Clicking the button goes straight to the OS file picker. The drop/paste dialog
   only appears if the file can't be read, as a fallback. */
async function importFile(file) {
  openModal(`<h2>Reading your resume</h2>
    <p class="sub">${esc(file.name)}</p>
    <button class="linkbtn" id="impSwitchPaste" style="float:right">paste text instead</button>
    <div id="impProgress" style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13.5px">
      <span class="spin" style="border-color:#cbd5e1;border-top-color:#0f766e"></span> Extracting sections, dates and bullets. Scans take up to a minute.
    </div>
    <div id="impOut" style="margin-top:14px"></div>`);
  $('#impSwitchPaste').onclick = () => openImport();
  try {
    const fd = new FormData();
    fd.append('file', file);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 200000);
    let r;
    try {
      r = await fetch('/api/import', { method: 'POST', body: fd, signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || 'Import failed (' + r.status + ')');
    const layout = { template: state.template, font: state.font, accent: state.accent };
    state = Object.assign(sample(), data.resume, layout);
    save(); renderEditor(); renderPreview();
    $('#tplSelect').value = state.template;
    modal.classList.remove('open');
    const roles = (state.experience || []).length, edu = (state.education || []).length;
    toast(`Imported${roles ? ` · ${roles} role${roles > 1 ? 's' : ''}` : ''}${edu ? ` · ${edu} education` : ''}. Check the wording.`);
  } catch (e) {
    openImport(e.message);
  }
}

function applyImportNotice(msg) {
  const out = $('#impOut');
  if (out && msg) out.innerHTML = `<p style="color:#b91c1c;font-size:13.5px">${esc(msg)}</p>`;
}

$('#btnResumeImport').onclick = () => {
  const inp = $('#resumeFile');
  inp.value = '';
  inp.click();               // straight to the file dialog
};
$('#resumeFile').onchange = e => {
  const f = e.target.files && e.target.files[0];
  if (f) importFile(f);
};
$('#btnPasteImport').onclick = () => openImport();

$('#fileInput').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    state = Object.assign(sample(), s);
    localStorage.setItem(KEY, JSON.stringify(state));
    location.reload();
  } catch { toast('That file is not a ResumeKit draft.'); }
};

/* ---------------- AI + modals ---------------- */
async function ai(task, payload) {
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, payload }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || 'AI request failed');
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}
const modal = $('#modal'), modalBody = $('#modalBody');
$('#modalClose').onclick = () => modal.classList.remove('open');
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
function openModal(html) { modalBody.innerHTML = html; modal.classList.add('open'); }

$('#btnReview').onclick = async () => {
  openModal('<h2>ATS review</h2><p class="sub">Reading your resume the way a parser and a recruiter would.</p><div id="revOut"><span class="spin" style="border-color:#cbd5e1;border-top-color:#0f766e"></span> Analyzing…</div>');
  try {
    const r = await ai('review', { resume: state });
    const score = Math.max(0, Math.min(100, Number(r.score) || 0));
    modalBody.innerHTML = `<h2>ATS review</h2><p class="sub">${esc(r.verdict || '')}</p>
      <div class="score-ring"><div class="ring" style="--p:${score}%"><i>${score}</i></div>
        <div><b style="font-size:14px">${score >= 80 ? 'Strong draft' : score >= 60 ? 'Fixable gaps' : 'Needs work'}</b>
        <div style="font-size:13px;color:var(--muted)">Score out of 100</div></div></div>
      ${(r.strengths || []).map(s => `<div class="rev-item"><span class="rev-tag" style="background:#dcfce7;color:#15803d">Working</span><p>${esc(s)}</p></div>`).join('')}
      ${(r.fixes || []).map(f => `<div class="rev-item"><span class="rev-tag">Fix</span><b>${esc(f.issue)}</b><p>${esc(f.fix)}</p></div>`).join('')}
      ${r.rewrite && r.rewrite.after ? `<div class="rev-item"><span class="rev-tag" style="background:#e0f2fe;color:#0369a1">Rewrite</span>
        <p style="color:#9ca3af;text-decoration:line-through">${esc(r.rewrite.before || '')}</p>
        <p style="margin-top:6px">${esc(r.rewrite.after)}</p></div>` : ''}`;
  } catch (e) {
    modalBody.innerHTML = `<h2>ATS review</h2><p class="sub">${esc(e.message)}</p>`;
  }
};

$('#btnCover').onclick = () => {
  openModal(`<h2>Cover letter</h2><p class="sub">Paste the job post. The letter uses your resume, so keep the draft current.</p>
    <div class="field"><label>Company</label><input id="clCompany" placeholder="Northwind Labs"></div>
    <div class="field"><label>Role</label><input id="clRole" placeholder="Senior Product Designer" value="${esc(state.contact.title || '')}"></div>
    <div class="field"><label>Job description</label><textarea id="clJd" style="min-height:140px" placeholder="Paste the posting here…"></textarea></div>
    <button class="btn btn-primary" id="clGo" style="margin-top:14px;width:100%;justify-content:center">Write the letter</button>
    <div id="clOut" style="margin-top:16px"></div>`);
  $('#clGo').onclick = async () => {
    const btn = $('#clGo'); btn.disabled = true; btn.textContent = 'Writing…';
    try {
      const r = await ai('cover', { resume: state, company: $('#clCompany').value, role: $('#clRole').value, jobDescription: $('#clJd').value });
      $('#clOut').innerHTML = `<div class="letter">${esc(r.letter)}</div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-outline" id="clCopy">Copy</button>
        <button class="btn btn-outline" id="clDl">Download .txt</button></div>`;
      $('#clCopy').onclick = () => { navigator.clipboard.writeText(r.letter); toast('Copied.'); };
      $('#clDl').onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([r.letter], { type: 'text/plain' }));
        a.download = 'cover_letter.txt'; a.click();
      };
    } catch (e) { $('#clOut').innerHTML = `<p style="color:#b91c1c;font-size:14px">${esc(e.message)}</p>`; }
    btn.disabled = false; btn.textContent = 'Write the letter';
  };
};

function openTailor() {
  openModal(`<h2>Tailor to the job</h2><p class="sub">Paste the posting. You'll get a rewritten summary and fresh bullets for your latest role.</p>
    <div class="field"><label>Job description</label><textarea id="tlJd" style="min-height:160px" placeholder="Paste the posting…"></textarea></div>
    <button class="btn btn-primary" id="tlGo" style="margin-top:14px;width:100%;justify-content:center">Rewrite my summary and bullets</button>
    <div id="tlOut" style="margin-top:16px"></div>`);
  $('#tlGo').onclick = async () => {
    const btn = $('#tlGo'); btn.disabled = true; btn.textContent = 'Working…';
    try {
      const r = await ai('tailor', { resume: state, jobDescription: $('#tlJd').value });
      $('#tlOut').innerHTML = `<div class="rev-item" style="border-top:0"><span class="rev-tag" style="background:#e0f2fe;color:#0369a1">New summary</span>
          <p>${esc(r.summary || '')}</p></div>
        ${(r.bullets || []).map(b => `<div class="rev-item"><p>→ ${esc(b)}</p></div>`).join('')}
        ${(r.keywords || []).length ? `<div class="rev-item"><span class="rev-tag" style="background:#f3f4f6;color:#374151">Keywords</span><p>${esc(r.keywords.join(' · '))}</p></div>` : ''}
        <button class="btn btn-primary" id="tlApply" style="width:100%;justify-content:center;margin-top:12px">Apply summary</button>`;
      $('#tlApply').onclick = () => {
        state.summary = r.summary;
        if (r.bullets && r.bullets.length && state.experience[0]) {
          state.experience[0].bullets = [...new Set([...r.bullets, ...(state.experience[0].bullets || [])])];
        }
        save(); renderEditor(); renderPreview();
        toast('Applied. Review the wording before you send it.');
        modal.classList.remove('open');
      };
    } catch (e) { $('#tlOut').innerHTML = `<p style="color:#b91c1c;font-size:14px">${esc(e.message)}</p>`; }
    btn.disabled = false; btn.textContent = 'Rewrite my summary and bullets';
  };
}

/* ---------------- boot ---------------- */
renderTabs(); renderEditor(); renderPreview();
$$('.tab')[0]?.classList.add('active');
setTimeout(applyZoom, 60);
