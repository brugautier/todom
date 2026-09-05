// views/progress.js — avancement annuel des compteurs et séries de chaque tâche.

import * as store from '../store.js';
import * as engine from '../engine.js';
import { today, diff } from '../date.js';

const nb = n => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function render(racine) {
  const jour = today();
  const taches = store.tasks().filter(t => t.t !== engine.PONCTUELLE);

  racine.appendChild(entete(taches, jour));

  if (!taches.length) {
    const p = document.createElement('p');
    p.className = 'vide';
    p.textContent = 'Rien à suivre pour l’instant.';
    racine.appendChild(p);
    return;
  }

  for (const t of taches) {
    racine.appendChild(
      t.t === engine.COMPTEUR ? carteCompteur(t, jour) : carteCoche(t, jour)
    );
  }
}

function entete(taches, jour) {
  const el = document.createElement('header');
  el.className = 'entete';

  const h = document.createElement('h1');
  h.textContent = 'Progression';

  const p = document.createElement('p');
  p.className = 'sub';
  p.textContent = echeanceProche(taches, jour);

  el.append(h, p);
  return el;
}

/** Résumé du haut : l'échéance la plus proche parmi les compteurs. */
function echeanceProche(taches, jour) {
  const restants = taches
    .filter(t => t.t === engine.COMPTEUR && t.fin)
    .map(t => diff(jour, t.fin))
    .filter(n => n >= 0);

  if (!restants.length) return 'Aucune échéance en cours.';
  const n = Math.min(...restants);
  return n === 0 ? 'Dernier jour d’une échéance.'
    : `${n} jour${n > 1 ? 's' : ''} avant la prochaine échéance.`;
}

/* ---------------- Cartes ---------------- */

function carteCompteur(t, jour) {
  const el = document.createElement('article');
  el.className = 'carte';

  const cumul = store.total(t.id, null, jour);
  const part = t.tot ? Math.min(100, cumul / t.tot * 100) : 0;
  const u = t.u ? ' ' + t.u : '';

  const ligne = document.createElement('div');
  ligne.className = 'ligne';

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = t.n;

  const chiffres = document.createElement('span');
  chiffres.className = 'chiffres';
  chiffres.textContent = `${nb(cumul)} / ${nb(t.tot)}${u}`;

  ligne.append(nom, chiffres);

  const barre = document.createElement('div');
  barre.className = 'barre epaisse';
  const jauge = document.createElement('i');
  jauge.style.width = part.toFixed(1) + '%';
  barre.appendChild(jauge);

  const bas = document.createElement('div');
  bas.className = 'bas';
  bas.append(indicateurRythme(t, jour, u), badgeSerie(t, jour));

  el.append(ligne, barre, bas);
  return el;
}

function carteCoche(t, jour) {
  const el = document.createElement('article');
  el.className = 'carte rangee';

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = t.n;

  el.append(nom, badgeSerie(t, jour));
  return el;
}

/* ---------------- Fragments ---------------- */

function indicateurRythme(t, jour, u) {
  const el = document.createElement('span');
  el.className = 'rythme';

  const r = engine.rythme(t, jour);
  if (!r) { el.textContent = ''; return el; }

  const ecart = Math.round(r.ecart * 10) / 10;
  if (Math.abs(ecart) < 0.05) {
    el.textContent = 'Pile dans le rythme';
    return el;
  }
  if (ecart > 0) {
    el.classList.add('avance');
    el.textContent = `${nb(ecart)}${u} d’avance`;
  } else {
    el.classList.add('retard');
    el.textContent = `${nb(-ecart)}${u} de retard`;
  }
  return el;
}

function badgeSerie(t, jour) {
  const { encours, record } = engine.series(t, jour);

  const el = document.createElement('span');
  el.className = 'serie';
  el.appendChild(flamme(encours > 0));

  const texte = document.createElement('span');
  texte.textContent = `${encours} jour${encours > 1 ? 's' : ''} · record ${record}`;
  el.appendChild(texte);

  return el;
}

/** Flamme dessinée à la main : une centaine d'octets, aucune police à charger. */
function flamme(active) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'flamme' + (active ? ' on' : ''));
  svg.setAttribute('aria-hidden', 'true');

  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.5a6 6 0 0 1-12 0C6 9 12 8 12 2z');
  p.setAttribute('fill', 'currentColor');

  svg.appendChild(p);
  return svg;
}
