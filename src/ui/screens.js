// All screen renderers. Each returns an HTML string; actions are wired via
// data-action attributes handled in main.js.
import { badgeImg } from './badge.js';
import { trophyTile } from './trophies.js';
import { computeLegacy, assembleCabinet } from '../engine/legacy.js';
import { fmtWage, currentEvent } from '../engine/career.js';
import { POSITIONS, effectivePosition } from '../engine/player.js';
import { ordinal } from '../engine/season.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function homeScreen(hasSave, hall) {
  return `<div class="fade-in">
    <div class="season-banner"><div style="font-size:3rem">⚽</div>
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
    <div class="row" style="flex-wrap:wrap">
      ${POSITIONS.map((p) => `<button class="compact ${sel.position === p.key ? 'primary' : ''}" data-action="pick-pos" data-pos="${p.key}">${p.name}</button>`).join('')}
    </div>
    <label>Nationality — all 211 FIFA associations</label>
    <input type="text" id="natsearch" value="${esc(sel.natFilter || '')}" placeholder="Search countries…" autocomplete="off">
    ${sel.nationality ? `<p style="margin:6px 0"><span class="flag">${assocs.find((a) => a.code === sel.nationality)?.flag || ''}</span><b>${esc(assocs.find((a) => a.code === sel.nationality)?.name || '')}</b> selected</p>` : ''}
    <div class="natlist">
      ${list.slice(0, 240).map((a) => `<button data-action="pick-nat" data-code="${a.code}"><span class="flag">${a.flag}</span>${esc(a.name)} <span class="muted small">${a.code} · ${a.confederation}</span></button>`).join('')}
    </div>
    <button class="primary" style="margin-top:14px" data-action="begin-career" ${sel.nationality && sel.position ? '' : 'disabled'}>Begin career</button>
  </div>`;
}

function statusBar(career) {
  const p = career.player;
  return `<div class="card" style="padding:10px 12px">
    <div class="row">
      ${career.club ? badgeImg({ name: career.club.name, tsdbTeamId: career.club.tsdbTeamId, colors: career.club.colors }, 'badge-img') : ''}
      <div class="grow">
        <b>${esc(p.name)}</b> <span class="muted small">${effectivePosition(p)}${p.captain ? ' · Captain' : ''} · Age ${p.age}</span><br>
        <span class="muted small">${career.club ? `${esc(career.club.name)} · ${esc(career.club.leagueName)}` : 'Free agent'} · ${career.year}–${(career.year + 1) % 100}</span>
      </div>
    </div>
    <div class="statgrid" style="margin:8px 0 0">
      <div class="stat"><span class="v">${Math.round(p.ability)}</span><span class="k">Ability</span></div>
      <div class="stat"><span class="v">${Math.round(p.form)}</span><span class="k">Form</span></div>
      <div class="stat"><span class="v">${Math.round(p.reputation)}</span><span class="k">Reputation</span></div>
    </div>
  </div>`;
}

export function offersScreen(career) {
  const p = career.player;
  const isStart = !career.club;
  return `<div class="fade-in">
    <h1>${isStart ? 'Where does it all begin?' : `Transfer window ${career.year}`}</h1>
    <p class="muted">${isStart
      ? `Scouts have watched you in ${esc(career.nation.name)} youth football. Three academies want you.`
      : `Offers are on the table. Your contract: ${p.contractYears} year${p.contractYears === 1 ? '' : 's'} left at ${fmtWage(p.wage)}/wk.`}</p>
    ${career.offers.map((o, i) => `
      <button data-action="accept-offer" data-i="${i}">
        <span class="row">${badgeImg({ name: o.clubName, tsdbTeamId: o.tsdbTeamId, colors: o.colors })}
        <span class="grow"><b>${esc(o.clubName)}</b>${o.loan ? ' <span class="pill">Loan</span>' : ''}
        <span class="choice-sub">${esc(o.leagueName)} · Tier ${o.tier} · ${esc(o.countryName)}</span>
        <span class="choice-sub">${fmtWage(o.wage)}/wk · ${o.years} years</span></span></span>
      </button>`).join('')}
    ${!isStart ? `<button data-action="stay-put"><b>Stay at ${esc(career.club.name)}</b><span class="choice-sub">${p.contractYears === 0 ? 'Negotiate a renewal' : 'See out your contract'}</span></button>` : ''}
  </div>`;
}

export function eventScreen(career) {
  const ev = currentEvent(career);
  if (!ev) return '';
  return `<div class="fade-in">
    ${statusBar(career)}
    <div class="card">
      <p class="muted small">Season ${career.year}–${(career.year + 1) % 100} · Decision ${career.eventIdx + 1} of ${career.pendingEvents.length}</p>
      <h2>${esc(ev.title)}</h2>
      <p>${esc(ev.text)}</p>
    </div>
    ${ev.choices.map((c) => `<button data-action="choose" data-i="${c.i}"><b>${esc(c.label)}</b>${c.sub ? `<span class="choice-sub">${esc(c.sub)}</span>` : ''}</button>`).join('')}
  </div>`;
}

export function outcomeScreen(career) {
  const o = career.lastOutcome;
  const toneClass = o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : o.tone === 'gold' ? 'gold' : '';
  return `<div class="fade-in">
    ${statusBar(career)}
    <div class="card">
      <h2>${esc(o.title)}</h2>
      <div class="news ${toneClass}">${esc(o.text)}</div>
    </div>
    <button class="primary" data-action="after-outcome">${career.phase === 'review' ? 'Play the season' : 'Continue'}</button>
  </div>`;
}

export function reportScreen(career) {
  const r = career.report;
  const p = career.player;
  if (r.cut) {
    return `<div class="fade-in"><div class="season-banner"><div class="yr">${r.year}</div><p class="red">Your career has been cut short.</p></div>
      <button class="primary" data-action="advance">Face what comes next</button></div>`;
  }
  const s = r.stats;
  const isGK = effectivePosition(p) === 'GK';
  return `<div class="fade-in">
    <div class="season-banner"><div class="yr">${r.year}–${(r.year + 1) % 100}</div>
      <p><b>${esc(career.club.name)}</b> finish <b>${ordinal(r.position)}</b> in the ${esc(career.club.leagueName)}</p></div>
    <div class="statgrid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><span class="v">${s.apps}</span><span class="k">Apps</span></div>
      ${isGK ? `<div class="stat"><span class="v">${s.cleanSheets}</span><span class="k">Clean sheets</span></div>`
             : `<div class="stat"><span class="v">${s.goals}</span><span class="k">Goals</span></div>`}
      <div class="stat"><span class="v">${s.assists}</span><span class="k">Assists</span></div>
      <div class="stat"><span class="v">${s.rating.toFixed(2)}</span><span class="k">Rating</span></div>
    </div>
    ${(r.news || []).map((n) => `<div class="news ${n.tone === 'good' ? 'good' : n.tone === 'bad' ? 'bad' : n.tone === 'gold' ? 'gold' : ''}">${esc(n.text)}</div>`).join('')}
    ${(r.awards || []).length ? `<div class="card"><h3>Individual honours</h3>${r.awards.map((a) => `<span class="pill gold">🏅 ${esc(a)}</span>`).join('')}</div>` : ''}
    <div class="card" style="max-height:300px;overflow-y:auto">
      <h3>Final table</h3>
      <table class="league"><tr><th>#</th><th>Club</th><th class="num">Pts</th></tr>
      ${r.table.map((row, i) => `<tr class="${row.name === career.club.name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(row.name)}</td><td class="num">${row.pts}</td></tr>`).join('')}
      </table>
    </div>
    <button class="primary" data-action="advance">Continue to ${r.year + 1}</button>
  </div>`;
}

export function preseasonScreen(career) {
  return `<div class="fade-in">
    ${statusBar(career)}
    <div class="card"><h2>Pre-season ${career.year}–${(career.year + 1) % 100}</h2>
      <p class="muted">The squad reports back for duty at ${esc(career.club.name)}. A new campaign awaits.</p></div>
    <button class="primary" data-action="start-season">Into the season</button>
  </div>`;
}

export function retiredScreen(career) {
  const legacy = computeLegacy(career);
  const p = career.player;
  return `<div class="fade-in">
    <div class="season-banner"><div style="font-size:2.6rem">🌅</div>
      <h1>The final whistle</h1>
      <p class="muted">${esc(p.name)} retires at ${p.age}, after ${p.seasonsPlayed} seasons.</p></div>
    <div class="card center">
      <p class="muted small" style="text-transform:uppercase;letter-spacing:0.08em">Legacy</p>
      <div style="font-size:1.5rem;font-weight:800" class="gold">${legacy.grade}</div>
      <div style="font-size:2.2rem;font-weight:800;margin:6px 0">${legacy.points} <span class="muted" style="font-size:1rem">pts</span></div>
      <p class="muted">${legacy.blurb}</p>
    </div>
    <div class="statgrid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><span class="v">${legacy.totalApps}</span><span class="k">Apps</span></div>
      <div class="stat"><span class="v">${legacy.totalGoals}</span><span class="k">Goals</span></div>
      <div class="stat"><span class="v">${p.caps}</span><span class="k">Caps</span></div>
      <div class="stat"><span class="v">${career.trophies.length}</span><span class="k">Trophies</span></div>
    </div>
    ${career.testimonial ? `<div class="news gold">A testimonial match is held in your honour at ${esc(career.testimonial)}. The old songs ring around the ground one last time.</div>` : ''}
    <button class="primary" data-action="cabinet">🏆 Open the trophy cabinet</button>
    <button data-action="history">Career history</button>
    <button data-action="finish-retire">Start a new career</button>
  </div>`;
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
    <div class="card" style="overflow-x:auto">
      <table class="league">
        <tr><th>Season</th><th>Club</th><th class="num">Pos</th><th class="num">Apps</th><th class="num">G</th><th class="num">Rating</th></tr>
        ${career.history.map((h) => `<tr><td>${h.year}</td><td>${esc(h.club)}<br><span class="muted small">${esc(h.league)}</span></td><td class="num">${h.position ? ordinal(h.position) : '—'}</td><td class="num">${h.apps}</td><td class="num">${h.goals}</td><td class="num">${h.rating ? h.rating.toFixed(2) : '—'}</td></tr>`).join('')}
      </table>
    </div>
    ${career.history.some((h) => h.trophies.length || h.awards.length)
      ? `<div class="card"><h3>Honours by season</h3>${career.history.filter((h) => h.trophies.length || h.awards.length).map((h) => `<p class="small"><b>${h.year}</b> — ${[...h.trophies, ...h.awards].map(esc).join(', ')}</p>`).join('')}</div>` : ''}
  </div>`;
}

export function hallScreen(hall) {
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="go-home">←</button><h1>Hall of Fame</h1></div>
    ${hall.map((h, i) => `<button data-action="hall-view" data-i="${i}"><b>${esc(h.name)}</b>
      <span class="choice-sub">Retired ${h.retiredYear} · ${h.seasons} seasons · ${h.trophies} trophies</span></button>`).join('')}
  </div>`;
}
