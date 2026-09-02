// store.js — la seule porte d'entrée vers les données. Rien d'autre ne
// touche au localStorage.
//
// Forme du fichier :
// {
//   v: 1,
//   tasks: [
//     { id, n:'Ranger le bureau', t:'k', int:3 }
//     { id, n:'Aspirateur',       t:'k', j:[1] }
//     { id, n:'Marche', t:'c', u:'km', tot:600, fin:'2026-12-31' }
//   ],
//   log: { 'AAAA-MM-JJ': { idTache: 12.5 | 1 | '-' } }
// }
//
// Valeurs du journal :
//   nombre → cumul de la journée pour un compteur
//   1      → tâche à cocher validée
//   '-'    → jour écarté, « pas aujourd'hui »
//   absent → rien de fait

import { valid } from './date.js';

const CLE = 'todom.v1';
const VERSION = 1;

export const ECARTE = '-';

let data = neuf();
const abonnes = new Set();

function neuf() {
  return { v: VERSION, tasks: [], log: {} };
}

/* ---------------- Persistance ---------------- */

function relire() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? valider(JSON.parse(brut)) : neuf();
  } catch (e) {
    console.warn('Données illisibles, on repart à vide.', e);
    return neuf();
  }
}

function ecrire() {
  try {
    localStorage.setItem(CLE, JSON.stringify(data));
  } catch (e) {
    console.error('Sauvegarde impossible.', e);
  }
}

/** Garde-fou au chargement, et point d'entrée des futures migrations. */
function valider(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.tasks)) return neuf();
  return {
    v: d.v || VERSION,
    tasks: d.tasks,
    log: d.log && typeof d.log === 'object' ? d.log : {},
  };
}

function commit() {
  ecrire();
  for (const fn of abonnes) fn(data);
}

/* ---------------- Lecture ---------------- */

export function init() {
  data = relire();
  return data;
}

export function all() {
  return data;
}

export function tasks() {
  return data.tasks;
}

export function task(id) {
  return data.tasks.find(t => t.id === id) || null;
}

/** Valeur brute d'une tâche pour un jour : nombre, 1, '-' ou undefined. */
export function entry(date, id) {
  const j = data.log[date];
  return j ? j[id] : undefined;
}

/** Cumul saisi ce jour-là. 0 si rien ou si le jour est écarté. */
export function amount(date, id) {
  const v = entry(date, id);
  return typeof v === 'number' ? v : 0;
}

/** Somme des saisies sur un intervalle, bornes incluses et optionnelles. */
export function total(id, depuis, jusqu) {
  let n = 0;
  for (const [d, rec] of Object.entries(data.log)) {
    if (depuis && d < depuis) continue;
    if (jusqu && d > jusqu) continue;
    const v = rec[id];
    if (typeof v === 'number') n += v;
  }
  return n;
}

/** S'abonner aux changements. Renvoie la fonction de désabonnement. */
export function subscribe(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

/* ---------------- Écriture ---------------- */

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function addTask(t) {
  const nouvelle = { ...t, id: t.id || nouvelId() };
  data.tasks.push(nouvelle);
  commit();
  return nouvelle;
}

export function updateTask(id, patch) {
  const t = task(id);
  if (!t) return null;
  Object.assign(t, patch, { id });
  commit();
  return t;
}

/** Supprime la tâche et tout son historique, pour ne pas laisser d'orphelins. */
export function removeTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id);
  for (const d of Object.keys(data.log)) {
    delete data.log[d][id];
    if (!Object.keys(data.log[d]).length) delete data.log[d];
  }
  commit();
}

/** Écrit une valeur brute. null ou 0 efface l'entrée. */
export function setEntry(date, id, valeur) {
  if (!valid(date)) throw new Error('Date invalide : ' + date);

  if (valeur === null || valeur === undefined || valeur === 0) {
    if (data.log[date]) {
      delete data.log[date][id];
      if (!Object.keys(data.log[date]).length) delete data.log[date];
    }
  } else {
    (data.log[date] ||= {})[id] = valeur;
  }
  commit();
}

/**
 * Ajoute au cumul du jour. C'est ce qu'appelle le bouton « Ajouter ».
 * delta peut être négatif pour corriger une erreur de saisie,
 * mais le cumul d'une journée ne descend jamais sous zéro.
 * Ajouter sur un jour écarté le réactive.
 */
export function addAmount(date, id, delta) {
  const cumul = Math.max(0, amount(date, id) + delta);
  setEntry(date, id, cumul);
  return cumul;
}

/* ---------------- Sauvegarde manuelle ---------------- */

export function exportJSON() {
  return JSON.stringify(data);
}

export function importJSON(texte) {
  const d = JSON.parse(texte);
  if (!d || !Array.isArray(d.tasks)) throw new Error('Fichier non reconnu.');
  data = valider(d);
  commit();
  return data;
}
