// All screen renderers. Each returns an HTML string; actions are wired via
// data-action attributes handled in main.js.
import { badgeImg, initialsBadge, leagueBadgeImg } from './badge.js';
import { trophySvg, trophyTile } from './trophies.js';
import { computeLegacy, assembleCabinet } from '../engine/legacy.js';
import { fmtWage, currentEvent } from '../engine/career.js';
import { POSITIONS, effectivePosition, marketValue, formatValue } from '../engine/player.js';
import { ordinal } from '../engine/season.js';
import { getAssociation } from '../engine/data.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const START_AGE = 17;
const END_AGE = 40;

function ovrTier(v) {
  if (v >= 85) return 'tier-elite';
  if (v >= 75) return 'tier-gold';
  if (v >= 65) return 'tier-silver';
  return 'tier-bronze';
}

function flagOf(code) {
  return getAssociation(code)?.flag || '';
}

// ---------------- profile card ----------------

function profileCard(career) {
  const p = career.player;
  const ovr = Math.round(p.ability);
  const club = career.club;
  const clubObj = club ? { name: club.name, tsdbTeamId: club.tsdbTeamId, colors: club.colors } : null;
  const watermark = clubObj ? initialsBadge(clubObj.name, clubObj.colors) : '';
  return `<div class="profile">
    <div class="ovr-badge ${ovrTier(ovr)}"><span class="lbl">OVR</span><span class="val">${ovr}</span></div>
    <div class="club-head">
      ${clubObj ? `<img class="watermark" src="${watermark}" alt="">` : ''}
      <div class="info">
        <div class="chips">
          <span class="chip"><span class="flag">${flagOf(p.nationality)}</span>${p.nationality}</span>
          <span class="chip pos">#${p.shirt ?? 10} ${effectivePosition(p)}</span>
          ${p.captain ? '<span class="chip">CAPTAIN</span>' : ''}
        </div>
        <div class="cname">${clubObj ? badgeImg(clubObj, '') : ''}<span>${esc(club ? club.name : 'Free agent')}</span></div>
      </div>
      <div class="meta-right">
        <div class="row2"><span class="k">AGE</span><span class="v">${p.age}</span></div>
        <div class="row2"><span class="k">VALUE</span><span class="v">${formatValue(marketValue(p))}</span></div>
      </div>
    </div>
  </div>`;
}

function totals(career) {
  return career.history.reduce((a, h) => {
    a.apps += h.apps; a.goals += h.goals; a.assists += h.assists;
    return a;
  }, { apps: 0, goals: 0, assists: 0 });
}

function statStrip(career) {
  const t = totals(career);
  return `<div class="statstrip">
    <div class="cell"><div class="k">APPS</div><div class="v"><span class="ic">📋</span>${t.apps}</div></div>
    <div class="cell"><div class="k">GOALS</div><div class="v"><span class="ic">⚽</span>${t.goals}</div></div>
    <div class="cell"><div class="k">AST</div><div class="v"><span class="ic">👟</span>${t.assists}</div></div>
  </div>`;
}

function trophyRow(career) {
  const items = assembleCabinet(career);
  if (!items.length) {
    return `<div class="trophy-row"><div class="empty">${trophySvg({ type: 'cup', name: 'none' })}Empty trophy case</div></div>`;
  }
  const shown = items.slice(0, 7);
  return `<div class="trophy-row">${shown.map((t) => trophySvg(t)).join('')}
    ${items.length > shown.length ? `<span class="muted small">+${items.length - shown.length}</span>` : ''}</div>`;
}

function leftPanel(career, actionHtml) {
  return `${profileCard(career)}${statStrip(career)}${trophyRow(career)}<hr class="divider">
    <div class="action">${actionHtml}</div>`;
}

// ---------------- career timeline ----------------

function timeline(career) {
  const byAge = new Map();
  for (const h of career.history) byAge.set(h.age ?? 0, h);
  const rows = [];
  const currentAge = career.player.age;

  for (let age = START_AGE; age <= END_AGE; age++) {
    const h = byAge.get(age);
    if (h) {
      const trophyMarks = (h.trophies || []).length
        ? (h.trophies || []).slice(0, 3).map(() => `<span class="tiny-tr">${trophySvg({ type: 'cup', name: 'x' })}</span>`).join('')
        : '';
      rows.push(`<tr>
        <td class="age">${age}</td>
        <td><span class="club-cell">${badgeImg({ name: h.club, tsdbTeamId: h.clubTsdbTeamId, colors: h.clubColors }, '')}<span class="nm">${esc(h.club)}</span>${trophyMarks}</span></td>
        <td class="n"><span class="ovr-pill ${ovrTier(h.ovr ?? 50)}">${h.ovr ?? '–'}</span></td>
        <td class="n">${h.apps}</td>
        <td class="n">${h.goals}</td>
        <td class="n">${h.assists}</td>
      </tr>`);
    } else if (age === currentAge && !career.retired) {
      const club = career.club;
      rows.push(`<tr class="current">
        <td class="age">${age}</td>
        <td><span class="club-cell">${club ? badgeImg({ name: club.name, tsdbTeamId: club.tsdbTeamId, colors: club.colors }, '') : '<span style="width:17px">❓</span>'}<span class="nm">${club ? esc(club.name) : 'Choosing club…'}</span></span></td>
        <td class="n"><span class="ovr-pill ${ovrTier(Math.round(career.player.ability))}">${Math.round(career.player.ability)}</span></td>
        <td class="n"></td><td class="n"></td><td class="n"></td>
      </tr>`);
    } else {
      rows.push(`<tr class="empty"><td class="age">${age}</td><td></td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n"></td></tr>`);
    }
  }

  const p = career.player;
  const nat = career.nation;
  const intlRow = `<tr class="intl">
    <td class="age"><span class="flag">${flagOf(nat.code)}</span></td>
    <td><span class="club-cell"><span class="nm">${esc(nat.name)}</span></span></td>
    <td class="n"></td>
    <td class="n">${p.caps}</td>
    <td class="n">${p.intlGoals}</td>
    <td class="n"></td>
  </tr>`;

  return `<div class="timeline">
    <table>
      <thead><tr><th>AGE</th><th>CLUB</th><th class="n">OVR</th><th class="n">APPS</th><th class="n">GOALS</th><th class="n">AST</th></tr></thead>
      <tbody>${rows.join('')}${intlRow}</tbody>
    </table>
  </div>`;
}

function layout(career, actionHtml) {
  return `<div class="layout fade-in">
    <div class="col-left">${leftPanel(career, actionHtml)}</div>
    <div class="col-right">${timeline(career)}</div>
  </div>`;
}

// ---------------- screens ----------------

export function homeScreen(hasSave, hall) {
  return `<div class="fade-in">
    <div class="season-banner"><div style="font-size:2.8rem">⚽</div>
      <h1>Career: Football</h1>
      <p class="muted">One life. One career. Every decision counts.</p></div>
    ${hasSave ? `<button class="primary" data-action="continue-career">Continue career</button>` : ''}
    <button ${hasSave ? '' : 'class="primary"'} data-action="new-career">Start a new career</button>
    ${hall.length ? `<button data-action="hall">Hall of Fame <span class="choice-sub">${hall.length} retired legend${hall.length > 1 ? 's' : ''}</span></button>` : ''}
  </div>`;
}

export function newCareerScreen(assocs, sel) {
  const filter = (sel.natFilter || '').toLowerCase();
  const list = assocs.filter((a) => a.name.toLowerCase().includes(filter) || a.code.toLowerCase().includes(filter));
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="go-home">←</button><h1>New career</h1></div>
    <label>Player name</label>
    <input type="text" id="pname" value="${esc(sel.name || '')}" placeholder="e.g. Danny Ings-Morata" autocomplete="off">
    <label>Position</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${POSITIONS.map((p) => `<button class="compact ${sel.position === p.key ? 'primary' : ''}" data-action="pick-pos" data-pos="${p.key}">${p.name}</button>`).join('')}
    </div>
    <label>Nationality — all 211 FIFA associations</label>
    <input type="text" id="natsearch" value="${esc(sel.natFilter || '')}" placeholder="Search countries…" autocomplete="off">
    ${sel.nationality ? `<p style="margin:6px 0"><span class="flag">${assocs.find((a) => a.code === sel.nationality)?.flag || ''}</span> <b>${esc(assocs.find((a) => a.code === sel.nationality)?.name || '')}</b> selected</p>` : ''}
    <div class="natlist">
      ${list.slice(0, 240).map((a) => `<button data-action="pick-nat" data-code="${a.code}"><span class="flag">${a.flag}</span> ${esc(a.name)} <span class="muted small">${a.code} · ${a.confederation}</span></button>`).join('')}
    </div>
    <button class="primary" style="margin-top:14px" data-action="begin-career" ${sel.nationality && sel.position ? '' : 'disabled'}>Begin career</button>
  </div>`;
}

function offerCard(o, i) {
  const crest = initialsBadge(o.clubName, o.colors);
  const imgId = 'oc' + i + Math.random().toString(36).slice(2, 6);
  queueMicrotask(async () => {
    const { resolveBadge } = await import('./badge.js');
    const url = await resolveBadge({ name: o.clubName, tsdbTeamId: o.tsdbTeamId });
    const el = document.getElementById(imgId);
    if (el && url) { el.onerror = () => { el.src = crest; }; el.src = url; }
  });
  return `<button class="offer" data-action="accept-offer" data-i="${i}">
    <span class="kicker">Sign for</span>
    <span class="club">${esc(o.clubName)}</span>
    <img id="${imgId}" class="crest" src="${crest}" alt="">
    <span class="league">${leagueBadgeImg(o.leagueName, o.tsdbLeagueId)}${esc(o.leagueName)}</span>
    <span class="terms">${o.loan ? 'Season loan' : `${fmtWage(o.wage)}/wk · ${o.years}y`}</span>
  </button>`;
}

export function offersScreen(career) {
  const isStart = !career.club;
  const cards = career.offers.map((o, i) => offerCard(o, i)).join('');
  let stay = '';
  if (!isStart) {
    const c = career.club;
    const crest = initialsBadge(c.name, c.colors);
    const imgId = 'sc' + Math.random().toString(36).slice(2, 6);
    queueMicrotask(async () => {
      const { resolveBadge } = await import('./badge.js');
      const url = await resolveBadge({ name: c.name, tsdbTeamId: c.tsdbTeamId });
      const el = document.getElementById(imgId);
      if (el && url) { el.onerror = () => { el.src = crest; }; el.src = url; }
    });
    stay = `<div class="wide"><button class="offer" data-action="stay-put">
      <span class="kicker">Stay at</span>
      <span class="club">${esc(c.name)}</span>
      <img id="${imgId}" class="crest" src="${crest}" alt="">
      <span class="league">${leagueBadgeImg(c.leagueName, c.tsdbLeagueId)}${esc(c.leagueName)}</span>
      <span class="terms">${career.player.contractYears === 0 ? 'Negotiate renewal' : `${career.player.contractYears}y remaining`}</span>
    </button></div>`;
  }
  const action = `<h2>${isStart ? 'Where it begins' : 'Transfer window'}</h2>
    <p class="lead">${isStart
      ? `Scouts have watched you in ${esc(career.nation.name)} youth football. Choose the club that starts your story.`
      : 'Offers arrived after your latest season. You can accept one or stay at your club.'}</p>
    <div class="offer-grid">${cards}${stay}</div>`;

  if (isStart) {
    return `<div class="layout fade-in"><div class="col-left">
      ${profileCard(career)}${statStrip(career)}<hr class="divider">
      <div class="action">${action}</div></div>
      <div class="col-right">${timeline(career)}</div></div>`;
  }
  return layout(career, action);
}

export function eventScreen(career) {
  const ev = currentEvent(career);
  if (!ev) return '';
  const action = `<h2>${esc(ev.title)}</h2>
    <div class="decision-body"><p>${esc(ev.text)}</p></div>
    ${ev.choices.map((c) => `<button data-action="choose" data-i="${c.i}"><b>${esc(c.label)}</b>${c.sub ? `<span class="choice-sub">${esc(c.sub)}</span>` : ''}</button>`).join('')}`;
  return layout(career, action);
}

export function outcomeScreen(career) {
  const o = career.lastOutcome;
  const tone = o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : o.tone === 'gold' ? 'gold' : '';
  const action = `<h2>${esc(o.title)}</h2>
    <div class="news ${tone}">${esc(o.text)}</div>
    <button class="primary" data-action="after-outcome">Play the season</button>`;
  return layout(career, action);
}

export function reportScreen(career) {
  const r = career.report;
  const p = career.player;
  if (r.cut) {
    const action = `<h2>${r.year}</h2><div class="news bad">Your career has been cut short.</div>
      <button class="primary" data-action="advance">Face what comes next</button>`;
    return layout(career, action);
  }
  const s = r.stats;
  const isGK = effectivePosition(p) === 'GK';
  const action = `<h2>${r.year}–${String((r.year + 1) % 100).padStart(2, '0')}</h2>
    <p class="lead"><b>${esc(career.club.name)}</b> finish <b>${ordinal(r.position)}</b> in the ${esc(career.club.leagueName)}</p>
    <div class="statstrip" style="margin-top:0">
      <div class="cell"><div class="k">APPS</div><div class="v">${s.apps}</div></div>
      <div class="cell"><div class="k">${isGK ? 'CLEAN SHEETS' : 'GOALS'}</div><div class="v">${isGK ? s.cleanSheets : s.goals}</div></div>
      <div class="cell"><div class="k">RATING</div><div class="v">${s.rating.toFixed(2)}</div></div>
    </div>
    ${(r.news || []).map((n) => `<div class="news ${n.tone === 'good' ? 'good' : n.tone === 'bad' ? 'bad' : n.tone === 'gold' ? 'gold' : ''}">${esc(n.text)}</div>`).join('')}
    ${(r.awards || []).length ? `<div class="card"><b class="gold">🏅 ${r.awards.map(esc).join(' · ')}</b></div>` : ''}
    <details class="card"><summary class="muted small">Final table</summary>
      <table class="league" style="margin-top:8px">
      ${r.table.map((row, i) => `<tr class="${row.name === career.club.name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(row.name)}</td><td class="num">${row.pts}</td></tr>`).join('')}
      </table></details>
    <button class="primary" data-action="advance">Continue to ${r.year + 1}</button>`;
  return layout(career, action);
}

export function preseasonScreen(career) {
  const action = `<h2>Pre-season ${career.year}–${String((career.year + 1) % 100).padStart(2, '0')}</h2>
    <p class="lead">The squad reports back for duty at ${esc(career.club.name)}. A new campaign awaits.</p>
    <button class="primary" data-action="start-season">Into the season</button>`;
  return layout(career, action);
}

export function retiredScreen(career) {
  const legacy = computeLegacy(career);
  const p = career.player;
  const action = `<h2>The final whistle</h2>
    <p class="lead">${esc(p.name)} retires at ${p.age}, after ${p.seasonsPlayed} seasons.</p>
    <div class="card center">
      <p class="muted small" style="letter-spacing:.1em">LEGACY</p>
      <div style="font-size:1.4rem;font-weight:800" class="gold">${legacy.grade}</div>
      <div style="font-size:2rem;font-weight:800;margin:4px 0">${legacy.points}<span class="muted" style="font-size:.9rem"> pts</span></div>
      <p class="muted">${legacy.blurb}</p>
    </div>
    ${career.testimonial ? `<div class="news gold">A testimonial match is held in your honour at ${esc(career.testimonial)}. The old songs ring around the ground one last time.</div>` : ''}
    <button class="primary" data-action="cabinet">🏆 Open the trophy cabinet</button>
    <button data-action="history">Season-by-season history</button>
    <button data-action="finish-retire">Start a new career</button>`;
  return layout(career, action);
}

export function cabinetScreen(career, backAction = 'back-retired') {
  const items = assembleCabinet(career);
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="${backAction}">←</button><h1>Trophy cabinet</h1></div>
    ${items.length
      ? `<p class="muted">${esc(career.player.name)} — every honour of a career.</p><div class="trophy-grid">${items.map((t) => trophyTile(t)).join('')}</div>`
      : `<div class="card center"><p style="font-size:2rem">🕸️</p><p class="muted">An empty cabinet. Not every career ends in silverware — but it was yours.</p></div>`}
  </div>`;
}

export function historyScreen(career, backAction = 'back-retired') {
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="${backAction}">←</button><h1>Career history</h1></div>
    ${timeline(career)}
    ${career.history.some((h) => h.trophies.length || h.awards.length)
      ? `<div class="card"><h2>Honours by season</h2>${career.history.filter((h) => h.trophies.length || h.awards.length).map((h) => `<p class="small" style="margin-top:6px"><b>${h.year}</b> — ${[...h.trophies, ...h.awards].map(esc).join(', ')}</p>`).join('')}</div>` : ''}
  </div>`;
}

export function hallScreen(hall) {
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="go-home">←</button><h1>Hall of Fame</h1></div>
    ${hall.map((h, i) => `<button data-action="hall-view" data-i="${i}"><b>${esc(h.name)}</b>
      <span class="choice-sub">Retired ${h.retiredYear} · ${h.seasons} seasons · ${h.trophies} trophies</span></button>`).join('')}
  </div>`;
}
