// app.js — démarrage et routage.
// Une route = un module exposant render(racine), et parfois prepare(param).

import * as store from './store.js';
import * as today from './views/today.js';
import * as tasks from './views/tasks.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';
import * as editor from './views/editor.js';
import { today as maintenant } from './date.js';

const vue = document.getElementById('vue');
let jourAffiche = maintenant();
let derniereRoute = null;

function route() {
  return (location.hash.slice(1) || '/').replace(/\/+$/, '') || '/';
}

/** Renvoie le module à afficher, ou null. */
function resoudre(r) {
  if (r === '/') return today;
  if (r === '/taches') return tasks;
  if (r === '/progression') return progress;
  if (r === '/reglages') return settings;

  if (r.startsWith('/taches/')) {
    const id = r.slice('/taches/'.length);
    // On ne prépare le brouillon qu'en arrivant sur la route, pas à chaque
    // redessin, sinon la saisie en cours serait écrasée.
    if (r !== derniereRoute && !editor.prepare(id)) {
      location.hash = '#/taches';
      return null;
    }
    return editor;
  }
  return null;
}

function dessiner() {
  const r = route();
  vue.replaceChildren();

  const module = resoudre(r);
  derniereRoute = r;

  if (module) {
    module.render(vue);
  } else {
    const p = document.createElement('p');
    p.className = 'vide';
    p.textContent = 'Écran à venir.';
    vue.appendChild(p);
  }

  const onglet = r.startsWith('/taches') ? '/taches' : r;
  for (const a of document.querySelectorAll('#nav a')) {
    a.classList.toggle('on', a.dataset.r === onglet);
  }
  scrollTo(0, 0);
}

// L'appli peut rester ouverte plusieurs jours en arrière-plan : au retour,
// on vérifie qu'on affiche toujours la bonne date.
function verifierJour() {
  const j = maintenant();
  if (j !== jourAffiche) { jourAffiche = j; dessiner(); }
}

store.init();
today.onRedraw(dessiner);
editor.onRedraw(dessiner);
settings.onRedraw(dessiner);
store.subscribe(dessiner);
addEventListener('hashchange', dessiner);
addEventListener('visibilitychange', () => { if (!document.hidden) verifierJour(); });

dessiner();
