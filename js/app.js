// app.js — démarrage et routage. Un écran = un module exposant render(racine).

import * as store from './store.js';
import * as today from './views/today.js';
import { today as maintenant } from './date.js';

const vues = { '/': today };
const vue = document.getElementById('vue');

let jourAffiche = maintenant();

function route() {
  return location.hash.slice(1) || '/';
}

function dessiner() {
  const r = route();
  vue.replaceChildren();

  const module = vues[r];
  if (module) {
    module.render(vue);
  } else {
    const p = document.createElement('p');
    p.className = 'vide';
    p.textContent = 'Écran à venir.';
    vue.appendChild(p);
  }

  for (const a of document.querySelectorAll('#nav a')) {
    a.classList.toggle('on', a.dataset.r === r);
  }
}

// L'appli reste ouverte en arrière-plan des jours entiers sur un téléphone :
// au retour, on vérifie qu'on n'a pas changé de date.
function verifierJour() {
  const j = maintenant();
  if (j !== jourAffiche) {
    jourAffiche = j;
    dessiner();
  }
}

store.init();
today.onRedraw(dessiner);
store.subscribe(dessiner);
addEventListener('hashchange', dessiner);
addEventListener('visibilitychange', () => { if (!document.hidden) verifierJour(); });

dessiner();
