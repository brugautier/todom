import * as store from '../store.js';
import * as engine from '../engine.js';
import { today, libelle, parse } from '../date.js';

let ouvert = null;      // id de la carte dépliée
let redessiner = () => {};

export function onRedraw(fn) { redessiner = fn; }

const nb = n => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const dateCourte = s => parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export function render(racine) {
  const jour = today();
  const items = engine.agenda(jour);

  const aFaire = items.filter(i => !i.etat.fait && !i.etat.ecarte);
  const classes = items.filter(i => i.etat.fait || i.etat.ecarte);

  racine.appendChild(entete(jour, aFaire.length, items.length));

  if (!items.length) {
    racine.appendChild(accueilVide());
    return;
  }

  for (const i of aFaire) racine.appendChild(carte(i, jour));

  if (classes.length) {
    const t = document.createElement('p');
    t.className = 'sec';
    t.textContent = 'Terminé';
    racine.appendChild(t);
    for (const i of classes) racine.appendChild(carte(i, jour));
  }
}

function entete(jour, restantes, total) {
  const el = document.createElement('header');
  el.className = 'entete';

  const h = document.createElement('h1');
  h.textContent = libelle(jour);

  const p = document.createElement('p');
  p.className = 'sub';
  p.textContent = !total ? 'Aucune tâche pour l’instant.'
    : restantes ? `${restantes} ${restantes > 1 ? 'tâches' : 'tâche'} à faire`
    : 'Journée bouclée.';

  el.append(h, p);
  return el;
}

/* ---------------- Cartes ---------------- */

function carte({ task, etat }, jour) {
  const compteur = etat.type === engine.COMPTEUR;
  const deplie = compteur && ouvert === task.id && !etat.ecarte;
  const detail = ligneDetail(task, etat);

  const el = document.createElement('article');
  el.className = 'carte'
    + (detail ? '' : ' simple')
    + (etat.fait && !etat.ecarte ? ' faite' : '')
    + (etat.ecarte ? ' ecartee' : '')
    + (deplie ? ' ouverte' : '');
  el.tabIndex = 0;

  const haut = document.createElement('div');
  haut.className = 'haut';

  const marque = document.createElement('span');
  marque.className = 'marque';
  marque.setAttribute('aria-hidden', 'true');
  marque.textContent = '✓';

  const corps = document.createElement('div');
  corps.className = 'corps';

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = task.n;

  if (compteur) {
    const ligne = document.createElement('div');
    ligne.className = 'ligne';

    const cumul = document.createElement('span');
    cumul.className = 'cumul';
    cumul.textContent = `${nb(etat.cumul)} / ${nb(task.tot)}${task.u ? ' ' + task.u : ''}`;

    ligne.append(nom, cumul);
    corps.appendChild(ligne);
  } else {
    corps.appendChild(nom);
  }

  if (detail) {
    const p = document.createElement('p');
    p.className = 'detail' + (etat.tard ? ' alerte' : '');
    p.textContent = detail;
    corps.appendChild(p);
  }

  haut.append(marque, corps);
  el.appendChild(haut);

  if (deplie) el.appendChild(zoneSaisie(task, jour));

  if (compteur && !etat.ecarte && task.tot) {
    const barre = document.createElement('div');
    barre.className = 'barre';
    const jauge = document.createElement('i');
    jauge.style.width = Math.min(100, etat.cumul / task.tot * 100).toFixed(1) + '%';
    barre.appendChild(jauge);
    el.appendChild(barre);
  }

  el.onclick = () => activer(task, etat, jour);
  el.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  };

  return el;
}

function ligneDetail(task, etat) {
  if (etat.ecarte) return 'Pas aujourd’hui';

  if (etat.type === engine.PONCTUELLE) {
    if (etat.fait || !etat.limite) return null;
    return etat.tard
      ? `En retard depuis le ${dateCourte(etat.limite)}`
      : `Avant le ${dateCourte(etat.limite)}`;
  }

  if (etat.type === engine.RECURRENTE) return null;

  const u = task.u ? ' ' + task.u : '';
  if (etat.fini) return `Objectif atteint · ${nb(etat.cumul)}${u}`;
  if (etat.tard) return `Échéance dépassée · ${nb(etat.reste)}${u} à faire`;

  const base = `${nb(etat.cible)}${u} aujourd’hui`;
  if (!etat.saisi) return base;
  return etat.manque
    ? `${base} · ${nb(etat.saisi)} fait · reste ${nb(etat.manque)}`
    : `${base} · objectif atteint`;
}

/* ---------------- Interactions ---------------- */

function activer(task, etat, jour) {
  if (etat.ecarte) {                       // un appui rétablit le jour
    ouvert = null;
    return store.setEntry(jour, task.id, null);
  }
  if (etat.type === engine.RECURRENTE || etat.type === engine.PONCTUELLE) {
    const valeur = etat.fait ? null : 1;
    store.setEntry(jour, task.id, valeur);
    for (const a of engine.absorbees(task)) {
      store.setEntry(jour, a.id, valeur);
    }
    return;
  }
  ouvert = ouvert === task.id ? null : task.id;
  redessiner();
  const champ = document.querySelector('.carte.ouverte input');
  if (champ) champ.focus();
}

function zoneSaisie(task, jour) {
  const zone = document.createElement('div');
  zone.className = 'saisie';
  zone.onclick = e => e.stopPropagation();  // ne pas replier la carte

  const champ = document.createElement('input');
  champ.type = 'number';
  champ.step = 'any';
  champ.placeholder = '0';
  champ.setAttribute('aria-label', `Ajouter ${task.u || 'une quantité'} à ${task.n}`);

  const ajouter = document.createElement('button');
  ajouter.className = 'ajout';
  ajouter.textContent = 'Ajouter';

  const passer = document.createElement('button');
  passer.className = 'icone';
  passer.textContent = '⊘';
  passer.setAttribute('aria-label', 'Pas aujourd’hui');

  const valider = () => {
    const v = parseFloat(String(champ.value).replace(',', '.'));
    if (isNaN(v) || v === 0) { champ.focus(); return; }
    ouvert = null;
    store.addAmount(jour, task.id, v);
  };

  ajouter.onclick = valider;
  champ.onkeydown = e => { if (e.key === 'Enter') valider(); };
  passer.onclick = () => {
    ouvert = null;
    store.setEntry(jour, task.id, store.ECARTE);
  };

  zone.append(champ, ajouter, passer);
  return zone;
}

function accueilVide() {
  const el = document.createElement('div');
  el.className = 'vide';

  const p = document.createElement('p');
  p.textContent = 'Aucune tâche pour aujourd\'hui';

  el.append(p);
  return el;
}
