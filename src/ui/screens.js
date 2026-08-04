// All screen renderers. Each returns an HTML string; actions are wired via
// data-action attributes handled in main.js.
import { badgeImg, initialsBadge, leagueBadgeImg } from './badge.js';
import { cardArt } from './cardart.js';
import { trophySvg, trophyTile } from './trophies.js';
import { computeLegacy, assembleCabinet } from '../engine/legacy.js';
import { fmtWage, currentEvent } from '../engine/career.js';
import { effectivePosition, positionGroup, marketValue, formatValue } from '../engine/player.js';
import { ROLES, getRole } from '../engine/positions.js';
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

// Everything the crest lookup needs: the club's own division is what makes a
// name like "Hamburger SV" or "La Louvière" resolvable without ambiguity.
function clubRef(club) {
  return {
    name: club.name,
    tsdbTeamId: club.tsdbTeamId ?? null,
    colors: club.colors || null,
    country: club.countryName || getAssociation(club.country)?.name || null,
    countryCode: club.country || null,
    tier: club.tier ?? null
  };
}

function leagueRef(o) {
  return {
    name: o.leagueName,
    tsdbLeagueId: o.tsdbLeagueId ?? null,
    countryName: o.countryName || getAssociation(o.country)?.name || null,
    countryCode: o.country || null,
    tier: o.tier ?? null
  };
}

// Step the club-name type size down as the name gets longer, so even
// "Borussia Mönchengladbach" fits without being cut off.
function nameSizeClass(name) {
  const n = name.length;
  if (n <= 14) return 'len-s';
  if (n <= 20) return 'len-m';
  if (n <= 28) return 'len-l';
  return 'len-xl';
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

// What a decision is actually gambling with, shown before you commit: the very
// probability the outcome is rolled against, and the OVR each side carries.
function ovrLabel(n) {
  return n ? `${signed(n)} OVR` : 'No change';
}

function riskChips(risk) {
  if (!risk || risk.p >= 1) {
    return `<span class="odds-chips"><span class="chip-odd none"><i>\u2192</i><b>${risk?.up ? ovrLabel(risk.up) : 'No changes'}</b></span></span>`;
  }
  const pct = Math.round(risk.p * 100);
  return `<span class="odds-chips">
    <span class="chip-odd win"><i>\u2197</i><b>${ovrLabel(risk.up)}</b><em>${pct}%</em></span>
    <span class="chip-odd lose"><i>\u2198</i><b>${ovrLabel(risk.down)}</b><em>${100 - pct}%</em></span>
  </span>`;
}

// ---------------- profile card ----------------

function profileCard(career) {
  const p = career.player;
  const ovr = Math.round(p.ability);
  const club = career.club;
  const clubObj = club ? clubRef(club) : null;
  const watermark = clubObj ? initialsBadge(clubObj.name, clubObj.colors) : '';
  // Tint the header with the club's primary colour, as a kit does.
  const tint = /^#[0-9a-f]{6}$/i.test(club?.colors?.[0] || '')
    ? ` style="background:linear-gradient(100deg, ${club.colors[0]}3d 0%, ${club.colors[0]}14 45%, var(--panel2) 85%)"`
    : '';
  return `<div class="profile">
    <div class="ovr-badge ${ovrTier(ovr)}"><span class="lbl">OVR</span><span class="val">${ovr}</span></div>
    <div class="club-head"${tint}>
      ${clubObj ? `<img class="watermark" src="${watermark}" alt="">` : ''}
      <div class="info">
        <div class="chips">
          <span class="chip"><span class="flag">${flagOf(p.nationality)}</span>${p.nationality}</span>
          <span class="chip pos">#${p.shirt ?? 10} ${effectivePosition(p)}</span>
          ${p.captain ? '<span class="chip">CAPTAIN</span>' : ''}
        </div>
        <div class="cname ${nameSizeClass(club ? club.name : 'Free agent')}">${clubObj ? badgeImg(clubObj, '') : ''}<span>${esc(club ? club.name : 'Free agent')}</span></div>
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
    a.cleanSheets += h.cleanSheets || 0; a.saves += h.saves || 0;
    return a;
  }, { apps: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0 });
}

// A goalkeeper's career reads in clean sheets and saves, not goals and assists.
function statStrip(career) {
  const t = totals(career);
  const gk = positionGroup(career.player) === 'GK';
  return `<div class="statstrip">
    <div class="cell"><div class="k">APPS</div><div class="v"><span class="ic">📋</span>${t.apps}</div></div>
    <div class="cell"><div class="k">${gk ? 'CLEAN SH.' : 'GOALS'}</div><div class="v"><span class="ic">${gk ? '🧤' : '⚽'}</span>${gk ? t.cleanSheets : t.goals}</div></div>
    <div class="cell"><div class="k">${gk ? 'SAVES' : 'AST'}</div><div class="v"><span class="ic">${gk ? '🙌' : '👟'}</span>${gk ? t.saves : t.assists}</div></div>
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
  const gk = positionGroup(career.player) === 'GK';
  const colA = (h) => (gk ? (h.cleanSheets || 0) : h.goals);
  const colB = (h) => (gk ? (h.saves || 0) : h.assists);

  for (let age = START_AGE; age <= END_AGE; age++) {
    const h = byAge.get(age);
    if (h) {
      const trophyMarks = (h.trophies || []).length
        ? (h.trophies || []).slice(0, 3).map(() => `<span class="tiny-tr">${trophySvg({ type: 'cup', name: 'x' })}</span>`).join('')
        : '';
      rows.push(`<tr>
        <td class="age">${age}</td>
        <td><span class="club-cell">${badgeImg(clubRef({ name: h.club, tsdbTeamId: h.clubTsdbTeamId, colors: h.clubColors, country: h.country, tier: h.tier }), '')}<span class="nm">${esc(h.club)}</span>${trophyMarks}</span></td>
        <td class="n"><span class="ovr-pill ${ovrTier(h.ovr ?? 50)}">${h.ovr ?? '–'}</span></td>
        <td class="n">${h.apps}</td>
        <td class="n">${colA(h)}</td>
        <td class="n">${colB(h)}</td>
      </tr>`);
    } else if (age === currentAge && !career.retired) {
      const club = career.club;
      rows.push(`<tr class="current">
        <td class="age">${age}</td>
        <td><span class="club-cell">${club ? badgeImg(clubRef(club), '') : '<span style="width:17px">❓</span>'}<span class="nm">${club ? esc(club.name) : 'Choosing club…'}</span></span></td>
        <td class="n"><span class="ovr-pill ${ovrTier(Math.round(career.player.ability))}">${Math.round(career.player.ability)}</span></td>
        <td class="n"></td><td class="n"></td><td class="n"></td>
      </tr>`);
    } else {
      rows.push(`<tr class="empty"><td class="age">${age}</td><td></td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n"></td></tr>`);
    }
  }

  const p = career.player;
  const nat = career.nation;
  const intlHonours = career.trophies.filter((t) => t.type === 'international').length;
  const intlMarks = intlHonours
    ? Array.from({ length: Math.min(intlHonours, 3) }, () => `<span class="tiny-tr">${trophySvg({ type: 'international', name: 'x' })}</span>`).join('')
    : '';
  const intlRow = `<tr class="intl">
    <td class="age"><span class="flag">${flagOf(nat.code)}</span></td>
    <td><span class="club-cell"><span class="nm">${esc(nat.name)}</span>${intlMarks}</span></td>
    <td class="n"></td>
    <td class="n">${p.caps}</td>
    <td class="n">${p.intlGoals}</td>
    <td class="n"></td>
  </tr>`;

  return `<div class="timeline">
    <table>
      <colgroup><col class="c-age"><col><col class="c-ovr"><col class="c-num"><col class="c-num"><col class="c-num"></colgroup>
      <thead><tr><th>AGE</th><th>CLUB</th><th class="n">OVR</th><th class="n">APP</th><th class="n">${gk ? 'CS' : 'GLS'}</th><th class="n">${gk ? 'SAV' : 'AST'}</th></tr></thead>
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

// A football pitch with every position marked; tap one to pick the role the
// career is played in.
function pitchPicker(selected) {
  const spots = ROLES.map((r) => `<button class="spot ${selected === r.key ? 'on' : ''}"
      style="left:${r.x}%;top:${r.y}%" data-action="pick-pos" data-pos="${r.key}"
      aria-label="${esc(r.name)}">${r.key}</button>`).join('');
  const chosen = selected ? getRole(selected) : null;
  return `<div class="pitch">
    <svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="100" height="150" rx="3" class="turf"/>
      <g class="lines" fill="none">
        <rect x="3" y="3" width="94" height="144"/>
        <line x1="3" y1="75" x2="97" y2="75"/>
        <circle cx="50" cy="75" r="14"/>
        <circle cx="50" cy="75" r="1.2" class="dot"/>
        <rect x="26" y="3" width="48" height="20"/>
        <rect x="38" y="3" width="24" height="8"/>
        <rect x="26" y="127" width="48" height="20"/>
        <rect x="38" y="139" width="24" height="8"/>
      </g>
    </svg>
    ${spots}
  </div>
  <div class="pitch-caption">${chosen
    ? `<b>${esc(chosen.name)}</b> <span class="muted small">${chosen.key}</span>`
    : '<span class="muted small">Tap a position on the pitch</span>'}</div>`;
}

export function newCareerScreen(assocs, sel) {
  const filter = (sel.natFilter || '').toLowerCase();
  const list = assocs.filter((a) => a.name.toLowerCase().includes(filter) || a.code.toLowerCase().includes(filter));
  return `<div class="fade-in">
    <div class="topbar"><button class="back" data-action="go-home">←</button><h1>New career</h1></div>
    <label>Player name</label>
    <input type="text" id="pname" value="${esc(sel.name || '')}" placeholder="e.g. Danny Ings-Morata" autocomplete="off">
    <label>Position — where do you play?</label>
    ${pitchPicker(sel.position)}
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
    const url = await resolveBadge(clubRef({ name: o.clubName, tsdbTeamId: o.tsdbTeamId, colors: o.colors, country: o.country, countryName: o.countryName, tier: o.tier }));
    const el = document.getElementById(imgId);
    if (el && url) { el.onerror = () => { el.src = crest; }; el.src = url; }
  });
  return `<button class="offer" data-action="accept-offer" data-i="${i}">
    <span class="kicker">Sign for</span>
    <span class="club">${esc(o.clubName)}</span>
    <img id="${imgId}" class="crest" src="${crest}" alt="">
    <span class="league">${leagueBadgeImg(leagueRef(o))}${esc(o.leagueName)}</span>
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
      const url = await resolveBadge(clubRef(c));
      const el = document.getElementById(imgId);
      if (el && url) { el.onerror = () => { el.src = crest; }; el.src = url; }
    });
    stay = `<div class="wide"><button class="offer" data-action="stay-put">
      <span class="kicker">Stay at</span>
      <span class="club">${esc(c.name)}</span>
      <img id="${imgId}" class="crest" src="${crest}" alt="">
      <span class="league">${leagueBadgeImg(leagueRef(c))}${esc(c.leagueName)}</span>
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
  const cards = ev.choices.map((c) => `<button class="choice-card" data-action="choose" data-i="${c.i}">
      <span class="ct">${esc(c.label)}</span>
      ${cardArt(c.art)}
      ${riskChips(c.risk)}
    </button>`).join('');
  const action = `<h2>${esc(ev.title)}</h2>
    <p class="lead">${esc(ev.text)}</p>
    <div class="choice-grid">${cards}</div>`;
  return layout(career, action);
}

export function outcomeScreen(career) {
  const o = career.lastOutcome;
  const tone = o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : o.tone === 'gold' ? 'gold' : '';
  // Only shown when the decision actually moved the rating — "+0 OVR" is noise.
  const d = o.ovrDelta || 0;
  const ovrLine = d
    ? `<div class="ovr-result ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${signed(d)} OVR<span class="muted small"> — now ${Math.round(career.player.ability)}</span></div>`
    : '';
  const action = `<h2>${esc(o.title)}</h2>
    <div class="news ${tone}">${esc(o.text)}</div>
    ${ovrLine}
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
  const isGK = positionGroup(p) === 'GK';
  const parts = [
    [s.appsBy?.league, 'league'], [s.appsBy?.cup, 'cup'], [s.appsBy?.continental, 'continental']
  ].filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(' · ');
  // The season's OVR movement, which the football just earned.
  const d = r.ovrDelta || 0;
  const ovrLine = `<div class="season-ovr ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">
      <span class="k">OVR</span>
      <span class="v">${r.ovrBefore} → <b>${r.ovrAfter}</b></span>
      <span class="delta">${d === 0 ? 'no change' : `${signed(d)} from this season`}</span>
    </div>`;
  const action = `<h2>${r.year}–${String((r.year + 1) % 100).padStart(2, '0')}</h2>
    <p class="lead"><b>${esc(career.club.name)}</b> finish <b>${ordinal(r.position)}</b> in the ${esc(career.club.leagueName)}</p>
    <div class="statstrip four" style="margin-top:0">
      <div class="cell"><div class="k">APPS</div><div class="v">${s.apps}<span class="of">/${s.possible ?? '–'}</span></div></div>
      <div class="cell"><div class="k">${isGK ? 'CLEAN SH.' : 'GOALS'}</div><div class="v">${isGK ? s.cleanSheets : s.goals}</div></div>
      <div class="cell"><div class="k">${isGK ? 'SAVES' : 'ASSISTS'}</div><div class="v">${isGK ? s.saves : s.assists}</div></div>
      <div class="cell"><div class="k">RATING</div><div class="v">${s.rating.toFixed(2)}</div></div>
    </div>
    ${parts ? `<p class="muted small center" style="margin:2px 0 8px">${parts}</p>` : ''}
    ${ovrLine}
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
