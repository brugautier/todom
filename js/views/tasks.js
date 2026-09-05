// views/tasks.js — la liste de toutes les tâches. Point d'entrée vers le formulaire.

import * as store from '../store.js';
import * as engine from '../engine.js';
import { parse } from '../date.js';

const nb = n => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function render(racine) {
  racine.appendChild(entete());

  const taches = store.tasks();
  if (!taches.length) {
    const p = document.createElement('p');
    p.className = 'vide';
    p.textContent = 'Aucune tâche. Crée la première.';
    racine.appendChild(p);
    return;
  }

  for (const t of taches) racine.appendChild(rangee(t));
}

function entete() {
  const el = document.createElement('header');
  el.className = 'entete duo-entete';

  const h = document.createElement('h1');
  h.textContent = 'Tâches';

  const b = document.createElement('button');
  b.className = 'ajout court';
  b.textContent = 'Nouvelle';
  b.onclick = () => { location.hash = '#/taches/nouveau'; };

  el.append(h, b);
  return el;
}

function rangee(t) {
  const el = document.createElement('article');
  el.className = 'carte rangee';
  el.tabIndex = 0;
  el.onclick = () => { location.hash = '#/taches/' + t.id; };
  el.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  };

  const corps = document.createElement('div');
  corps.className = 'corps';

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = t.n;

  const detail = document.createElement('p');
  detail.className = 'detail';
  detail.textContent = resume(t);

  corps.append(nom, detail);

  const fleche = document.createElement('span');
  fleche.className = 'chevron';
  fleche.setAttribute('aria-hidden', 'true');
  fleche.textContent = '›';

  el.append(corps, fleche);
  return el;
}

/** Phrase qui décrit la règle de la tâche, affichée sous son nom. */
export function resume(t) {
  if (t.t === engine.PONCTUELLE) {
    return t.fin ? `Une fois, avant le ${dateCourte(t.fin)}` : 'Une seule fois';
  }
  if (t.t === engine.COMPTEUR) {
    const u = t.u ? ' ' + t.u : '';
    return `${nb(t.tot)}${u} d’ici le ${dateCourte(t.fin)}`;
  }
  if (t.j && t.j.length) {
    return t.j.length === 7 ? 'Chaque jour'
      : 'Chaque ' + t.j.map(n => JOURS[n]).join(', ');
  }
  if (t.int > 1) return `Tous les ${t.int} jours`;
  return 'Chaque jour';
}

function dateCourte(s) {
  if (!s) return '—';
  return parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
