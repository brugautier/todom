// engine.js — toutes les règles de calcul. Ne touche ni au DOM ni au stockage
// en écriture : on lit le store, on renvoie un état.

import { diff, weekday, add } from './date.js';
import * as store from './store.js';

export const COCHE = 'k';
export const COMPTEUR = 'c';

/**
 * La tâche est-elle prévue ce jour-là ?
 *   t.j   → liste de jours de semaine, 1 = lundi
 *   t.int → tous les N jours, à partir de la dernière validation
 *   ni l'un ni l'autre → tous les jours
 */
export function isDue(t, date) {
  if (t.j && t.j.length) return t.j.includes(weekday(date));
  if (t.int) {
    const derniere = dernierFait(t.id, date);
    return !derniere || diff(derniere, date) >= t.int;
  }
  return true;
}

/** Dernier jour, strictement avant `date`, où la tâche a été validée. */
function dernierFait(id, date) {
  let derniere = null;
  const log = store.all().log;
  for (const [d, rec] of Object.entries(log)) {
    const v = rec[id];
    if (d < date && v !== undefined && v !== store.ECARTE) {
      if (!derniere || d > derniere) derniere = d;
    }
  }
  return derniere;
}

/** Jours éligibles entre deux dates incluses, en tenant compte de t.j. */
function joursRestants(t, de, a) {
  const n = diff(de, a) + 1;
  if (n <= 0) return 0;
  if (!t.j || !t.j.length) return n;

  let compte = 0;
  for (let i = 0, d = de; i < n; i++, d = add(d, 1)) {
    if (t.j.includes(weekday(d))) compte++;
  }
  return compte;
}

/** Entier au-dessus de 10, dixième en dessous. Toujours arrondi au supérieur. */
export function arrondi(n) {
  return n >= 10 ? Math.ceil(n) : Math.ceil(n * 10) / 10;
}

/**
 * État d'une tâche à une date.
 *
 * Commun     : type, ecarte, du, fait
 * Compteurs  : cible, saisi, manque, cumul, reste, jours, fini, tard
 *
 * La cible du jour se calcule sur le reste au réveil, pas sur le reste courant :
 * ce que tu saisis dans la journée remplit l'objectif, il ne le déplace pas.
 */
export function state(t, date) {
  const brut = store.entry(date, t.id);
  const ecarte = brut === store.ECARTE;

  if (t.t === COCHE) {
    return { type: COCHE, ecarte, du: isDue(t, date), fait: brut === 1 };
  }

  const veille = add(date, -1);
  const acquis = store.total(t.id, null, veille);
  const saisi = store.amount(date, t.id);
  const reste = Math.max(0, (t.tot || 0) - acquis);

  const dispo = joursRestants(t, date, t.fin);
  const tard = dispo <= 0;                    // échéance atteinte ou dépassée
  const jours = Math.max(1, dispo);           // jamais de division par zéro

  let cible = reste > 0 ? arrondi(reste / jours) : 0;
  if (cible > reste) cible = reste;           // ne jamais demander plus que le reste

  return {
    type: COMPTEUR, ecarte, tard, jours, reste, cible, saisi,
    manque: Math.max(0, cible - saisi),
    cumul: acquis + saisi,
    fini: reste <= 0,
    du: isDue(t, date) && reste > 0,
    fait: reste <= 0 || (cible > 0 && saisi >= cible),
  };
}

/** Les tâches à afficher pour une date, avec leur état. */
export function agenda(date) {
  return store.tasks()
    .map(t => ({ task: t, etat: state(t, date) }))
    .filter(({ etat }) => etat.du || etat.ecarte || etat.fait);
}
