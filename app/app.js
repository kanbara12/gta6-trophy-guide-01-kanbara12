// Leonida 55 — GTA VI trophy guide and tracker. Plain ES module, no libraries,
// no network at runtime: the only fetch is the app's own data/trophies.json.
const STORE_KEY = 'leonida55-v1';
const DATA_URL = 'data/trophies.json';

// PSN progress counters the tracker keeps numbers for (name, target, trophy id).
const COUNTERS = [
  { key: 'stunts', label: 'Stunts', target: 250, trophy: 15 },
  { key: 'range', label: 'Shooting Range gold medals', target: 42, trophy: 17 },
  { key: 'waink', label: 'WAiNK It locations', target: 100, trophy: 31 },
  { key: 'vehicles', label: 'Vehicles discovered', target: 100, trophy: 35 },
  { key: 'challenges', label: 'Challenges completed', target: 50, trophy: 32 },
];

const KINDS = [
  ['all', 'All kinds'],
  ['story', 'Story'],
  ['activity', 'Activities'],
  ['collectible', 'Collectibles'],
  ['crime', 'Crime'],
  ['exploration', 'Exploration'],
  ['money', 'Money'],
  ['misc', 'Misc'],
  ['completion', 'Completion'],
  ['platinum', 'Platinum'],
];

const STAGES = {
  1: { title: 'Stage 1 — Story first', hours: 'About 50–60 hours', note: 'Play the story through. Chapter trophies, named missions and the five side-character strands all land here.' },
  2: { title: 'Stage 2 — Open-world sweep', hours: 'About 60–80 hours', note: 'Activities, races, exploration, crime and the one possibly-missable trophy. Do the meditation spots as you find them.' },
  3: { title: 'Stage 3 — Collectibles', hours: 'About 20–30 hours', note: 'Cards, WAiNK It check-ins and vehicle discovery. Slow, steady, best done while sweeping the map.' },
  4: { title: 'Stage 4 — Money and 100%', hours: 'About 20–30 hours', note: 'Launder the marked bills, spend across the shops, buy the garages, then close out the 100% checklist.' },
  5: { title: 'Stage 5 — Cryptic and platinum', hours: 'A few hours, plus waiting on guides', note: 'The cryptic hidden trophies, whose methods launch-day guides had not confirmed yet, and the platinum itself.' },
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let trophies = [];
let state = loadState();

function loadState() {
  const fallback = { earned: [], notes: {}, counters: {}, spoiler: true, selected: 15, view: 'checklist', kind: 'all', grade: 'all', query: '', missableOnly: false };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed, notes: parsed.notes ?? {}, counters: parsed.counters ?? {} };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function trophyById(id) {
  return trophies.find((t) => t.id === id);
}

function earnedSet() {
  return new Set(state.earned);
}

function isMasked(t) {
  return t.hidden && state.spoiler && !earnedSet().has(t.id);
}

function counterFor(trophyId) {
  return COUNTERS.find((c) => c.trophy === trophyId) ?? null;
}

function gradeWord(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function kindWord(kind) {
  return kind === 'platinum' ? 'Platinum' : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function trophyMatches(t) {
  if (state.kind !== 'all' && t.kind !== state.kind) return false;
  if (state.grade !== 'all' && t.grade !== state.grade) return false;
  if (state.missableOnly && !t.missable) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = `${t.name} ${t.description} ${t.guide}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderProgress() {
  const earned = earnedSet();
  $('earnedCount').textContent = String(earned.size);
  $('progressFill').style.width = `${(earned.size / trophies.length) * 100}%`;
  const counts = {};
  for (const t of trophies) counts[t.grade] = (counts[t.grade] ?? 0) + (earned.has(t.id) ? 1 : 0);
  $('gradeChips').innerHTML = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `<span>${gradeWord(g)} ${counts[g] ?? 0}/${trophies.filter((t) => t.grade === g).length}</span>`)
    .join('');
  const left = trophies.length - earned.size;
  $('platinumLine').textContent = left === 0
    ? 'Platinum earned — Vice Got a Price! is yours.'
    : `${left} ${left === 1 ? 'trophy' : 'trophies'} to go until the platinum.`;
}

function renderKindChips() {
  $('kindChips').innerHTML = KINDS.map(([key, label]) =>
    `<button type="button" data-kind="${key}" class="${state.kind === key ? 'active' : ''}">${label}</button>`).join('');
  $('kindChips').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { state.kind = b.dataset.kind; saveState(); renderKindChips(); renderList(); }));
}

function renderNextUp() {
  const earned = earnedSet();
  const rest = trophies
    .filter((t) => !earned.has(t.id) && t.id !== 1)
    .sort((a, b) => a.stage - b.stage || a.id - b.id)
    .slice(0, 5);
  if (rest.length === 0) {
    $('nextUp').innerHTML = '<b>Next up:</b> nothing left — the platinum is yours.';
    return;
  }
  $('nextUp').innerHTML = `<b>Next up:</b> ${rest.map((t) =>
    `<span class="up"><button type="button" data-next="${t.id}" title="Mark earned">#${t.id} ${escapeHtml(isMasked(t) ? 'Hidden trophy' : t.name)}</button></span>`).join('')} <span class="up">— tap one to tick it off.</span>`;
  $('nextUp').querySelectorAll('[data-next]').forEach((b) =>
    b.addEventListener('click', () => toggleEarned(Number(b.dataset.next))));
}

function renderList() {
  const earned = earnedSet();
  const list = $('trophyList');
  list.innerHTML = '';
  const shown = trophies.filter(trophyMatches);
  $('listMeta').textContent = `Showing ${shown.length} of ${trophies.length} trophies — ${earned.size} earned. Tick a box to save your progress in this browser.`;
  $('emptyNote').hidden = shown.length !== 0;
  for (const t of shown) {
    const li = document.createElement('li');
    if (earned.has(t.id)) li.classList.add('earned');
    if (state.selected === t.id) li.classList.add('selected');
    const masked = isMasked(t);
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', `Earned: ${masked ? 'hidden trophy' : t.name}`);
    box.addEventListener('change', (e) => { e.stopPropagation(); toggleEarned(t.id); });
    const mid = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'trophyname';
    name.innerHTML = `<span class="num">#${t.id}</span>${masked ? '<span class="masked">Hidden trophy — earn it to reveal</span>' : escapeHtml(t.name)}`;
    const desc = document.createElement('div');
    desc.className = 'trophydesc';
    desc.textContent = masked ? 'Hidden on PlayStation until earned.' : t.description;
    const tags = document.createElement('div');
    tags.className = 'trophytags';
    tags.innerHTML = `<span class="tag">${kindWord(t.kind)}</span>`
      + (t.hidden ? '<span class="tag hiddenflag">Hidden</span>' : '')
      + (t.missable ? '<span class="tag missable">Possibly missable</span>' : '')
      + (t.count != null ? `<span class="tag count">PSN count: ${t.count.toLocaleString('en-US')}</span>` : '')
      + `<span class="tag">Stage ${t.stage}</span>`;
    mid.append(name, desc, tags);
    const grade = document.createElement('div');
    grade.className = `grade ${t.grade}`;
    grade.textContent = gradeWord(t.grade);
    li.append(box, mid, grade);
    li.addEventListener('click', (e) => {
      if (e.target === box) return;
      state.selected = t.id;
      saveState();
      renderList();
      renderGuide();
    });
    list.append(li);
  }
}

function toggleEarned(id) {
  const earned = new Set(state.earned);
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  state.earned = [...earned].sort((a, b) => a - b);
  saveState();
  renderProgress();
  renderNextUp();
  renderList();
  renderGuide();
  if (state.view !== 'checklist') showView(state.view);
}

function renderGuide() {
  const pane = $('guidePane');
  const t = trophyById(state.selected) ?? trophies[0];
  if (!t) { pane.innerHTML = ''; return; }
  const earned = earnedSet();
  if (isMasked(t)) {
    pane.innerHTML = `
      <span class="tag hiddenflag">Hidden trophy #${t.id}</span>
      <h2>Hidden trophy</h2>
      <p class="officialdesc">Hidden on PlayStation until earned.</p>
      <p>Spoiler-safe mode is on, so this trophy stays masked until you earn it. Its name, description and guide are hidden on purpose.</p>
      <div class="rowbtns">
        <button type="button" id="revealEarned">I earned it — reveal</button>
        <button type="button" class="ghost" id="revealOff">Turn spoiler-safe off</button>
      </div>`;
    $('revealEarned').addEventListener('click', () => toggleEarned(t.id));
    $('revealOff').addEventListener('click', () => {
      state.spoiler = false; $('spoilerToggle').checked = false; saveState(); renderList(); renderGuide();
    });
    return;
  }
  const counter = counterFor(t.id);
  const counterHtml = counter
    ? `<h3>Your progress</h3><p class="countline"><input type="number" id="counterInput" min="0" max="${counter.target}" value="${state.counters[counter.key] ?? 0}"> of ${counter.target} ${escapeHtml(counter.label.toLowerCase())} — ${Math.min(100, Math.round(((state.counters[counter.key] ?? 0) / counter.target) * 100))}%</p>`
    : (t.count != null ? `<h3>Your progress</h3><p class="countline">PSN tracks this one to ${t.count.toLocaleString('en-US')}. Tick the box above when it pops.</p>` : '');
  const note = state.notes[t.id] ?? '';
  pane.innerHTML = `
    <span class="grade ${t.grade}">${gradeWord(t.grade)}</span>
    <span class="tag">${kindWord(t.kind)}</span>
    ${t.hidden ? '<span class="tag hiddenflag">Hidden</span>' : ''}
    ${t.missable ? '<span class="tag missable">Possibly missable</span>' : ''}
    <h2>#${t.id} ${escapeHtml(t.name)}</h2>
    <p class="officialdesc">Official description: “${escapeHtml(t.description)}”</p>
    <h3>Guide</h3>
    <p>${escapeHtml(t.guide)}</p>
    ${t.missable ? '<p class="warnbox"><b>Missable watch:</b> the only trophy any guide flags as possibly missable (PowerPyx / GTABase, unconfirmed). Meditate at each spot as you find it and keep a manual save before big missions.</p>' : ''}
    <h3>Sources</h3>
    <p class="sources">${escapeHtml(t.sources)}</p>
    ${counterHtml}
    <h3>Your note</h3>
    <textarea id="noteInput" placeholder="Your own note for this trophy — where you are up to, what to try next…">${escapeHtml(note)}</textarea>
    <div class="rowbtns">
      <button type="button" id="markBtn">${earned.has(t.id) ? 'Mark as not earned' : 'Mark as earned'}</button>
      <button type="button" class="ghost" id="prevBtn">Previous trophy</button>
      <button type="button" class="ghost" id="nextBtn">Next trophy</button>
    </div>`;
  $('markBtn').addEventListener('click', () => toggleEarned(t.id));
  $('prevBtn').addEventListener('click', () => stepTrophy(-1));
  $('nextBtn').addEventListener('click', () => stepTrophy(1));
  $('noteInput').addEventListener('input', (e) => {
    state.notes[t.id] = e.target.value;
    saveState();
  });
  const input = $('counterInput');
  if (input) {
    input.addEventListener('change', () => {
      const value = Math.max(0, Math.min(counter.target, Number(input.value) || 0));
      state.counters[counter.key] = value;
      saveState();
      renderGuide();
    });
  }
}

function stepTrophy(direction) {
  const index = trophies.findIndex((t) => t.id === state.selected);
  const next = trophies[(index + direction + trophies.length) % trophies.length];
  state.selected = next.id;
  saveState();
  renderList();
  renderGuide();
}

function stageTrophies(stage) {
  return trophies.filter((t) => t.stage === stage).sort((a, b) => a.id - b.id);
}

function renderRoadmap() {
  const earned = earnedSet();
  const cards = [1, 2, 3, 4, 5].map((n) => {
    const list = stageTrophies(n);
    const done = list.filter((t) => earned.has(t.id)).length;
    const pct = Math.round((done / list.length) * 100);
    return `<div class="stage"><h3>${STAGES[n].title}</h3><p class="hours">${STAGES[n].hours} — ${done}/${list.length} earned</p>
      <div class="stagebar"><div style="width:${pct}%"></div></div>
      <p>${STAGES[n].note}</p>
      <ul>${list.map((t) => `<li class="${earned.has(t.id) ? 'earned' : ''}">${earned.has(t.id) ? '✓ ' : '○ '}#${t.id} ${escapeHtml(isMasked(t) ? 'Hidden trophy' : t.name)}</li>`).join('')}</ul></div>`;
  }).join('');
  $('pageBody').innerHTML = `
    <div class="pagecard"><h2>Roadmap to the platinum</h2>
    <p>About 200 hours in total, in five stages, built from the official descriptions: story first, then the open world, then collectibles, then money and 100%, then the cryptic trophies and the platinum. PowerPyx rates the platinum 4 out of 10 for difficulty (PowerPyx trophy guide, 19 Nov 2026). Work the stages in order and the checklist fills itself in.</p></div>
    <div class="stagegrid">${cards}</div>`;
}

function renderMissables() {
  const t = trophyById(28);
  const earned = earnedSet();
  $('pageBody').innerHTML = `
    <div class="pagecard flagcard"><h2>Missable watch — 1 trophy flagged</h2>
    <p><b>#28 ${escapeHtml(t.name)}</b> — ${escapeHtml(t.description)} <span class="grade ${t.grade}">${gradeWord(t.grade)}</span> ${earned.has(28) ? '✓ Earned' : 'Not earned yet'}</p>
    <p>${escapeHtml(t.guide)}</p>
    <p class="sources">${escapeHtml(t.sources)}</p>
    <p class="warnbox"><b>Honest hedge:</b> the possibly-missable flag comes from PowerPyx and GTABase and is unconfirmed. planetgta6 (19 Nov 2026) says there is no reliable list of missable trophies so far. Do not treat this as a confirmed missable — treat it as the one trophy worth doing early, with a manual save kept before big missions.</p></div>
    <div class="pagecard"><h2>Why the other 54 are safe</h2>
    <p>Story trophies pop from playing the chapters and named missions, which cannot be missed by playing the story. There are no online trophies at all, so nothing depends on servers or other players. Collectibles, activities and crime trophies stay available after the story ends, and the 100% checklist can be finished in free roam. The one habit that covers every unknown: keep a manual save before big missions, so a missed step costs a reload instead of a replay.</p></div>
    <div class="pagecard"><h2>How this page was built</h2>
    <p>Missable flags here come from the official descriptions plus the launch-day guides named beside each trophy. Where a guide had not confirmed a method by 19 Nov 2026, this guide says so instead of guessing. The missable page names one trophy and explains why, and leaves the rest unflagged.</p></div>`;
}

function renderSave() {
  const earned = earnedSet();
  const noteCount = Object.values(state.notes).filter((n) => n && n.trim()).length;
  $('pageBody').innerHTML = `
    <div class="pagecard"><h2>Save &amp; counters</h2>
    <p>Progress saves in this browser (localStorage) the moment you tick a box. Export downloads a file with your earned trophies, notes and counters; import reads one back. Nothing leaves your browser unless you export it.</p>
    <p><b>${earned.size} of ${trophies.length} earned</b> — ${noteCount} ${noteCount === 1 ? 'note' : 'notes'} written.</p>
    <div class="rowbtns" style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" id="exportBtn2">Export progress</button>
      <button type="button" id="resetBtn" class="ghost">Reset all progress</button>
    </div></div>
    <div class="pagecard"><h2>PSN progress counters</h2>
    <p>Five trophies track a number on PlayStation. Enter your numbers here and the guide pane shows them beside each trophy.</p>
    <div class="countergrid">${COUNTERS.map((c) => {
      const value = state.counters[c.key] ?? 0;
      const pct = Math.min(100, Math.round((value / c.target) * 100));
      return `<div class="counter"><h3>${c.label}</h3><p style="margin:0;font-size:12px;color:var(--muted)">Trophy #${c.trophy} — target ${c.target}</p>
        <input type="number" data-counter="${c.key}" min="0" max="${c.target}" value="${value}" aria-label="${c.label}">
        <div class="cbar"><div style="width:${pct}%"></div></div><p style="margin:4px 0 0;font-size:12px">${value} / ${c.target} — ${pct}%</p></div>`;
    }).join('')}</div></div>
    <div class="pagecard"><h2>Your notes</h2>
    <p>${noteCount === 0 ? 'No notes yet. Open any trophy in the checklist and write one in its guide pane.' : Object.entries(state.notes).filter(([, n]) => n && n.trim()).map(([id, n]) => `<b>#${id} ${escapeHtml((trophyById(Number(id)) ?? { name: '' }).name)}:</b> ${escapeHtml(n)}`).join('<br>')}</p></div>`;
  $('exportBtn2').addEventListener('click', exportProgress);
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Reset all progress, notes and counters?')) return;
    state.earned = []; state.notes = {}; state.counters = {};
    saveState(); renderAll(); showView('save');
  });
  $('pageBody').querySelectorAll('[data-counter]').forEach((input) =>
    input.addEventListener('change', () => {
      const counter = COUNTERS.find((c) => c.key === input.dataset.counter);
      state.counters[counter.key] = Math.max(0, Math.min(counter.target, Number(input.value) || 0));
      saveState(); renderSave();
    }));
}

function renderAbout() {
  $('pageBody').innerHTML = `
    <div class="pagecard"><h2>About this guide</h2>
    <p>Leonida 55 covers the 55 PlayStation 5 trophies of Grand Theft Auto VI, which launched on 19 Nov 2026. The official list has been live on PlayStation Network since 18 Nov 2026. Names, descriptions and grades are shown exactly as PlayStation publishes them. Guide steps are our own words. Where a step goes beyond the official description, the guide names its source; where it could not be verified, it says so.</p>
    <p>28 trophies are hidden on PlayStation until earned. Only one trophy is reported as possibly missable (Positive Mental Attitude); no reliable missable list exists yet, so keep manual saves before big missions.</p>
    <p>This guide works fully offline. It loads no file from the network, runs no tracker and asks for no account. Your progress stays in this browser unless you export it.</p></div>
    <div class="pagecard"><h2>Sources</h2>
    <ul class="sourcelist">
      <li>Official trophy list: Exophase, Grand Theft Auto VI trophies, 18 Nov 2026 — names, descriptions and grades.</li>
      <li>Cross-check: PSNProfiles, Grand Theft Auto VI trophies, 18 Nov 2026 — the two lists agree on every name, description and grade; PSN counts where one exists.</li>
      <li>Cross-check: TrueAchievements, 18 Nov 2026, via planetgta6.com trophy tables, crawled 19 Nov 2026.</li>
      <li>How-to detail: Push Square, GTA 6 trophy guide and roadmap, 19 Nov 2026.</li>
      <li>How-to detail: KeenGamer, GTA 6 trophy guide and platinum roadmap, 19 Nov 2026.</li>
      <li>How-to detail: PowerPyx trophy guide, 19 Nov 2026 — difficulty 4 out of 10, about 200 hours to platinum; possibly-missable flag via GTABase, unconfirmed.</li>
      <li>Missable honesty: planetgta6.com, 19 Nov 2026 — no reliable list of missable trophies so far.</li>
    </ul></div>
    <div class="pagecard"><h2>What this guide does not claim</h2>
    <p>How-to detail beyond the official descriptions is launch-day guide knowledge, not official text. For the cryptic trophies (Challenging Tank, Personal Best, Actions Speak Louder, Bad Luck I Guess, The Truth Is Out There, Ten Pin) the exact method had not been confirmed in any guide checked on 19 Nov 2026, and this guide says so beside each one instead of guessing. Check a current guide before chasing those.</p></div>`;
}

function showView(view) {
  state.view = view;
  saveState();
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view));
  $('toolbar').style.display = view === 'checklist' ? '' : 'none';
  $('view-checklist').hidden = view !== 'checklist';
  $('view-page').hidden = view === 'checklist';
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missables') renderMissables();
  if (view === 'save') renderSave();
  if (view === 'about') renderAbout();
  if (location.hash !== `#/${view}`) history.replaceState(null, '', `#/${view}`);
}

function exportProgress() {
  const payload = {
    app: 'leonida55', version: 1, exportedAt: new Date().toISOString(),
    earned: state.earned, notes: state.notes, counters: state.counters,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'leonida55-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const ids = new Set(trophies.map((t) => t.id));
    if (Array.isArray(parsed.earned)) state.earned = parsed.earned.filter((id) => ids.has(id));
    if (parsed.notes && typeof parsed.notes === 'object') state.notes = parsed.notes;
    if (parsed.counters && typeof parsed.counters === 'object') state.counters = parsed.counters;
    saveState();
    renderAll();
    showView(state.view);
  } catch {
    window.alert('That file could not be read as Leonida 55 progress.');
  }
}

function renderAll() {
  renderProgress();
  renderKindChips();
  renderNextUp();
  renderList();
  renderGuide();
}

async function boot() {
  const doc = await (await fetch(DATA_URL)).json();
  trophies = doc.trophies;
  $('search').value = state.query;
  $('gradeFilter').value = state.grade;
  $('missableOnly').checked = state.missableOnly;
  $('spoilerToggle').checked = state.spoiler;
  $('search').addEventListener('input', (e) => { state.query = e.target.value; saveState(); renderList(); });
  $('gradeFilter').addEventListener('change', (e) => { state.grade = e.target.value; saveState(); renderList(); });
  $('missableOnly').addEventListener('change', (e) => { state.missableOnly = e.target.checked; saveState(); renderList(); });
  $('spoilerToggle').addEventListener('change', (e) => { state.spoiler = e.target.checked; saveState(); renderList(); renderGuide(); });
  $('exportBtn').addEventListener('click', exportProgress);
  $('importFile').addEventListener('change', (e) => importProgress(e.target.files[0]));
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.addEventListener('click', () => showView(b.dataset.view)));
  const hashView = (location.hash.replace('#/', '') || 'checklist');
  renderAll();
  showView(['checklist', 'roadmap', 'missables', 'save', 'about'].includes(hashView) ? hashView : 'checklist');
  window.addEventListener('hashchange', () => {
    const view = location.hash.replace('#/', '') || 'checklist';
    if (['checklist', 'roadmap', 'missables', 'save', 'about'].includes(view)) showView(view);
  });
}

boot();
