
const H0 = 8, H1 = 19;                 
const PX = 48;                         
const state = { view: 'week', date: new Date() };
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (d, o) => d.toLocaleDateString('fr-FR', o);
const weekStart = d => { const s = new Date(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); s.setHours(0, 0, 0, 0); return s; };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const DB = {
  read(k) { try { return JSON.parse(localStorage.getItem('studyflow_' + k)) || []; } catch { return []; } },
  write(k, v) { localStorage.setItem('studyflow_' + k, JSON.stringify(v)); },
  courses() { return this.read('courses'); },
  activities() { return this.read('activities'); },
  saveActivity(a) {
    const l = this.activities(), i = l.findIndex(x => x.id === a.id);
    i >= 0 ? l[i] = a : l.push(a);
    this.write('activities', l);
  }
};
const isLate = a => a.status !== 'done' && a.date < iso(new Date());   // "en retard" est calculé, jamais stocké

function dayData(d) {
  const k = iso(d), wd = (d.getDay() + 6) % 7 + 1;
  const courses = DB.courses()
    .filter(c => +c.weekday === wd && (!c.validFrom || c.validFrom <= k) && (!c.validTo || c.validTo >= k))
    .sort((a, b) => mins(a.start) - mins(b.start));
  const acts = DB.activities().filter(a => a.date === k)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  return { courses, acts };
}

/* ---- Rendu des éléments ---- */
function actChip(a, tag = 'button') {
  const late = isLate(a);
  return `<${tag} class="ev t-${esc(a.type)} ${a.status === 'done' ? 'done' : ''}" data-id="${esc(a.id)}">
    ${late ? '<span class="flag">En retard · </span>' : ''}${esc(a.title)}<small>${esc(a.subject)}</small></${tag}>`;
}
function courseBlock(c, style) {
  return `<div class="ev course" style="${style}"><b>${esc(c.subject)}</b>
    <small>${esc(c.start)}–${esc(c.end)}${c.room ? ' · ' + esc(c.room) : ''}</small></div>`;
}
const pos = (s, e) => `top:${(s - H0 * 60) * PX / 60}px;height:${Math.max((e - s) * PX / 60, 24)}px`;

/* ---- Vues jour et semaine (même grille, 1 ou 7 colonnes) ---- */
function renderGrid(days) {
  const today = iso(new Date());
  let html = `<div class="grid ${days.length === 1 ? 'one' : ''}" style="grid-template-columns:3rem repeat(${days.length},1fr)">
    <div style="grid-column:1;grid-row:1"></div><div style="grid-column:1;grid-row:2"></div>
    <div class="gutter" style="grid-column:1;grid-row:3">${
      Array.from({ length: H1 - H0 }, (_, i) => `<span style="top:${i * PX}px">${pad(H0 + i)}:00</span>`).join('')}</div>`;
  days.forEach((d, i) => {
    const { courses, acts } = dayData(d), col = i + 2;
    const timed = acts.filter(a => a.time), untimed = acts.filter(a => !a.time);
    html += `<div class="dayhead ${iso(d) === today ? 'today' : ''}" style="grid-column:${col};grid-row:1">
        <small>${fr(d, { weekday: 'short' })}</small><b>${d.getDate()}</b></div>
      <div class="allday" style="grid-column:${col};grid-row:2">${untimed.map(actChip).join('')}</div>
      <div class="slots" style="grid-column:${col};grid-row:3">
        ${courses.map(c => courseBlock(c, pos(mins(c.start), mins(c.end)))).join('')}
        ${timed.map(a => actChip(a).replace('class="ev', `style="${pos(mins(a.time), mins(a.time) + (+a.duration || 60))}" class="ev`)).join('')}
      </div>`;
  });
  return html + '</div>';
}
function freeSlots(courses) {
  let cur = H0 * 60; const out = [];
  courses.forEach(c => { const s = mins(c.start); if (s - cur >= 30) out.push([cur, s]); cur = Math.max(cur, mins(c.end)); });
  if (H1 * 60 - cur >= 30) out.push([cur, H1 * 60]);
  return out;
}
function renderDay() {
  const free = freeSlots(dayData(state.date).courses);
  return renderGrid([state.date]) + `<section class="free"><h2>Périodes libres</h2>${
    free.length ? `<ul>${free.map(([a, b]) => `<li>${hm(a)} – ${hm(b)}</li>`).join('')}</ul>` : '<p>Aucune période libre aujourd\'hui.</p>'}</section>`;
}

/* ---- Vue mensuelle ---- */
function renderMonth() {
  const first = new Date(state.date.getFullYear(), state.date.getMonth(), 1), today = iso(new Date());
  const start = weekStart(first);
  let html = '<div class="month">' + Array.from({ length: 7 }, (_, i) => `<div class="dow">${fr(addDays(start, i), { weekday: 'short' })}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), { courses, acts } = dayData(d);
    html += `<div role="button" tabindex="0" class="cell ${d.getMonth() !== first.getMonth() ? 'other' : ''} ${iso(d) === today ? 'today' : ''}" data-day="${iso(d)}" aria-label="${fr(d, { dateStyle: 'full' })}">
      <span class="num">${d.getDate()}</span>
      ${courses.length ? `<span class="more">${courses.length} cours</span>` : ''}
      ${acts.slice(0, 3).map(a => actChip(a, 'span')).join('')}
      ${acts.length > 3 ? `<span class="more">+${acts.length - 3} autres</span>` : ''}</div>`;
  }
  return html + '</div>';
}

/* ---- Rendu principal et navigation ---- */
function render() {
  const d = state.date;
  $('#title').textContent = state.view === 'month' ? fr(d, { month: 'long', year: 'numeric' })
    : state.view === 'day' ? fr(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${fr(weekStart(d), { day: 'numeric', month: 'short' })} – ${fr(addDays(weekStart(d), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));
  $('#calendar').innerHTML = state.view === 'month' ? renderMonth()
    : state.view === 'day' ? renderDay()
    : renderGrid(Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i)));
  $('#empty').hidden = DB.courses().length + DB.activities().length > 0;
}
function shift(dir) {
  const d = new Date(state.date);
  if (state.view === 'day') d.setDate(d.getDate() + dir);
  else if (state.view === 'week') d.setDate(d.getDate() + 7 * dir);
  else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  state.date = d; render();
}

/* ---- Formulaire d'activité ---- */
const form = $('#form');
function openForm(a = {}) {
  form.reset();
  $('#dlg-title').textContent = a.id ? 'Modifier l\'activité' : 'Nouvelle activité';
  $('#error').hidden = true;
  const v = { type: 'devoir', priority: 'medium', status: 'pending', date: iso(state.date), ...a };
  Object.entries(v).forEach(([k, val]) => { if (form.elements[k]) form.elements[k].value = val ?? ''; });
  $('#dlg').showModal();
}
form.addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  const err = !f.title.trim() ? 'Indique un titre.' : !f.subject.trim() ? 'Indique une matière.' : !f.date ? 'Choisis une date.'
    : f.duration && +f.duration <= 0 ? 'La durée doit être supérieure à 0.' : '';
  if (err) { $('#error').textContent = err; $('#error').hidden = false; return; }
  DB.saveActivity({ ...f, id: f.id || (crypto.randomUUID?.() ?? String(Date.now())),
    title: f.title.trim(), subject: f.subject.trim(), duration: f.duration ? +f.duration : null });
  $('#dlg').close(); render();
});
$('#cancel').onclick = () => $('#dlg').close();

/* ---- Événements ---- */
$('#prev').onclick = () => shift(-1);
$('#next').onclick = () => shift(1);
$('#today').onclick = () => { state.date = new Date(); render(); };
$('#add').onclick = () => openForm();
document.querySelectorAll('.views button').forEach(b => b.onclick = () => { state.view = b.dataset.view; render(); });
$('#calendar').addEventListener('click', e => {
  const chip = e.target.closest('.ev[data-id]');
  if (chip && !chip.closest('.cell')) return openForm(DB.activities().find(a => a.id === chip.dataset.id));
  const cell = e.target.closest('.cell');
  if (cell) { state.date = new Date(cell.dataset.day + 'T12:00'); state.view = 'day'; render(); }
});
$('#calendar').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cell')) { e.preventDefault(); e.target.click(); }
});
$('#sample').onclick = () => {
  const mon = weekStart(new Date()), day = n => iso(addDays(mon, n));
  DB.write('courses', [
    { id: 'c1', subject: 'Mathématiques', weekday: 1, start: '08:30', end: '10:30', room: 'B12' },
    { id: 'c2', subject: 'Algorithmique', weekday: 2, start: '10:00', end: '12:00', room: 'Labo 3' },
    { id: 'c3', subject: 'Anglais', weekday: 3, start: '14:00', end: '16:00', room: 'A04' },
    { id: 'c4', subject: 'Mathématiques', weekday: 4, start: '08:30', end: '10:30', room: 'B12' }]);
  DB.write('activities', [
    { id: 'a1', title: 'Exercices chapitre 4', subject: 'Mathématiques', type: 'devoir', date: day(0), priority: 'medium', status: 'pending' },
    { id: 'a2', title: 'Examen de mi-semestre', subject: 'Algorithmique', type: 'examen', date: day(3), time: '09:00', duration: 120, priority: 'high', status: 'pending' },
    { id: 'a3', title: 'Réviser les tris', subject: 'Algorithmique', type: 'revision', date: day(1), time: '14:00', duration: 90, priority: 'high', status: 'pending' },
    { id: 'a4', title: 'Projet StudyFlow', subject: 'Projet tutoré', type: 'projet', date: day(4), priority: 'medium', status: 'pending' }]);
  render();
};
render();
