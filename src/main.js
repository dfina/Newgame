import './style.css';
import { loadAssociations } from './engine/data.js';
import {
  startCareer, loadCareer, clearCareer, saveCareer, loadHall, acceptOffer,
  stayAtClub, chooseEventOption, runSeason, advanceToNextSeason, currentEvent, loadIndex
} from './engine/career.js';
import * as S from './ui/screens.js';

const app = document.getElementById('app');
const state = {
  screen: 'home',       // home | new | hall | hall-cabinet | cabinet | history | play
  career: null,
  hallView: null,
  sel: { name: '', position: null, nationality: null, natFilter: '' }
};

async function boot() {
  await loadAssociations();
  state.assocs = await loadAssociations();
  state.career = loadCareer();
  render();
}

function render() {
  const c = state.career;
  let html = '';
  switch (state.screen) {
    case 'home':
      html = S.homeScreen(!!c && !c.retired, loadHall()); break;
    case 'new':
      html = S.newCareerScreen(state.assocs, state.sel); break;
    case 'hall':
      html = S.hallScreen(loadHall()); break;
    case 'hall-cabinet':
      html = S.cabinetScreen(state.hallView, 'hall'); break;
    case 'cabinet':
      html = S.cabinetScreen(c, 'back-retired'); break;
    case 'history':
      html = S.historyScreen(c, 'back-retired'); break;
    case 'play':
      html = playScreen(c); break;
  }
  app.innerHTML = html;
  wireInputs();
  window.scrollTo(0, 0);
}

function playScreen(c) {
  if (!c) { state.screen = 'home'; return S.homeScreen(false, loadHall()); }
  if (c.retired) return S.retiredScreen(c);
  if (c.lastOutcome) return S.outcomeScreen(c);
  switch (c.phase) {
    case 'offers': return S.offersScreen(c);
    case 'event': return S.eventScreen(c);
    case 'review': return S.outcomeScreen(c); // safety: outcome pending
    case 'postseason': return S.reportScreen(c);
    case 'preseason': return S.preseasonScreen(c);
    case 'retired': return S.retiredScreen(c);
    default: return S.offersScreen(c);
  }
}

function wireInputs() {
  const pname = document.getElementById('pname');
  if (pname) pname.oninput = () => { state.sel.name = pname.value; };
  const nats = document.getElementById('natsearch');
  if (nats) {
    nats.oninput = () => {
      state.sel.natFilter = nats.value;
      const listEl = document.querySelector('.natlist');
      if (listEl) {
        const f = nats.value.toLowerCase();
        const list = state.assocs.filter((a) => a.name.toLowerCase().includes(f) || a.code.toLowerCase().includes(f));
        listEl.innerHTML = list.slice(0, 240).map((a) => `<button data-action="pick-nat" data-code="${a.code}"><span class="flag">${a.flag}</span>${a.name} <span class="muted small">${a.code} · ${a.confederation}</span></button>`).join('');
      }
    };
  }
}

app.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;
  const c = state.career;
  try {
    switch (a) {
      case 'go-home': state.screen = 'home'; break;
      case 'new-career':
        state.sel = { name: '', position: null, nationality: null, natFilter: '' };
        state.screen = 'new'; break;
      case 'pick-pos': state.sel.position = btn.dataset.pos; break;
      case 'pick-nat': state.sel.nationality = btn.dataset.code; break;
      case 'begin-career': {
        const name = (state.sel.name || '').trim() || 'Alex Fletcher';
        btn.disabled = true;
        state.career = await startCareer({ name, nationality: state.sel.nationality, position: state.sel.position });
        state.screen = 'play';
        break;
      }
      case 'continue-career': state.screen = 'play'; break;
      case 'accept-offer': {
        const offer = c.offers[Number(btn.dataset.i)];
        btn.disabled = true;
        await acceptOffer(c, offer);
        break;
      }
      case 'stay-put': stayAtClub(c); break;
      case 'choose': chooseEventOption(c, Number(btn.dataset.i)); break;
      case 'after-outcome':
        c.lastOutcome = null;
        if (c.phase === 'review') runSeason(c);
        saveCareer(c);
        break;
      case 'start-season':
        // preseason phase: events were queued by beginSeason already
        c.phase = 'event';
        saveCareer(c);
        break;
      case 'advance':
        btn.disabled = true;
        await advanceToNextSeason(c);
        break;
      case 'cabinet': state.screen = 'cabinet'; break;
      case 'history': state.screen = 'history'; break;
      case 'back-retired': state.screen = 'play'; break;
      case 'finish-retire':
        clearCareer();
        state.career = null;
        state.screen = 'home';
        break;
      case 'hall': state.screen = 'hall'; break;
      case 'hall-view': {
        const h = loadHall()[Number(btn.dataset.i)];
        if (h) { state.hallView = h.career; state.screen = 'hall-cabinet'; }
        break;
      }
    }
  } catch (err) {
    console.error(err);
    app.insertAdjacentHTML('afterbegin', `<div class="news bad">Something went wrong: ${err.message}</div>`);
    return;
  }
  render();
});

boot();
