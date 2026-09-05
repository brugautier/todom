import { diff, weekday, add, today } from './date.js';
import * as store from './store.js';

export const RECURRENTE = 'k';
export const COMPTEUR = 'c';
export const PONCTUELLE = 'p';   // à faire une fois, reportée jusqu'à ce qu'elle soit faite

/* ================= Récurrence ================= */

/**
 * La tâche est-elle prévue ce jour-là ?
 *   t.j   → jours de semaine, 1 = lundi
 *   t.int → tous les N jours depuis la dernière validation
 *   sinon → tous les jours
 */
export function isDue(t, date) {
  if (masquee(t, date)) return false;
  return dueBrut(t, date);
}

function dueBrut(t, date) {
  if (t.t === PONCTUELLE) return store.entry(date, t.id) !== 1;
  if (t.j && t.j.length) return t.j.includes(weekday(date));
  if (t.int) {
    const derniere = dernierFait(t.id, date);
    return !derniere || diff(derniere, date) >= t.int;
  }
  return true;
}

/**
 * Une tâche est masquée un jour donné si une tâche qui la remplace est due
 * ce jour-là.
 *
 * Le remplacement ne vaut que sur un niveau : on interroge dueBrut et non
 * isDue, ce qui interdit les chaînes et rend les boucles impossibles.
 */
export function masquee(t, date) {
  if (t.t !== RECURRENTE) return false;
  for (const a of store.tasks()) {
    if (a.id === t.id || a.t !== RECURRENTE) continue;
    if (a.abs && a.abs.includes(t.id) && dueBrut(a, date)) return true;
  }
  return false;
}

/** Les tâches que `t` remplace, dans l'ordre du store. */
export function absorbees(t) {
  if (!t.abs || !t.abs.length) return [];
  return store.tasks().filter(x => t.abs.includes(x.id));
}

function dernierFait(id, date) {
  let derniere = null;
  for (const [d, rec] of Object.entries(store.all().log)) {
    const v = rec[id];
    if (d < date && v !== undefined && v !== store.ECARTE) {
      if (!derniere || d > derniere) derniere = d;
    }
  }
  return derniere;
}

/** Jours éligibles entre deux dates incluses, en tenant compte de t.j. */
function eligibles(t, de, a) {
  const n = diff(de, a) + 1;
  if (n <= 0) return 0;
  if (!t.j || !t.j.length) return n;

  let compte = 0;
  for (let i = 0, d = de; i < n; i++, d = add(d, 1)) {
    if (t.j.includes(weekday(d))) compte++;
  }
  return compte;
}

/** Entier au-dessus de 10, dixième en dessous, toujours arrondi au supérieur. */
export function arrondi(n) {
  return n >= 10 ? Math.ceil(n) : Math.ceil(n * 10) / 10;
}

/* ================= État du jour ================= */

/**
 * État d'une tâche à une date.
 * Commun    : type, ecarte, du, fait
 * Compteurs : cible, saisi, manque, cumul, reste, jours, fini, tard
 *
 * La cible se calcule sur le reste au réveil : ce que tu saisis dans la
 * journée remplit l'objectif, il ne le déplace pas.
 */
export function state(t, date) {
  const brut = store.entry(date, t.id);
  const ecarte = brut === store.ECARTE;

  if (t.t === PONCTUELLE) {
    const fait = brut === 1;
    return {
      type: PONCTUELLE, ecarte: false, fait, du: !fait,
      limite: t.fin || null,
      tard: !!t.fin && !fait && date > t.fin,
    };
  }

  if (t.t === RECURRENTE) {
    return { type: RECURRENTE, ecarte, du: isDue(t, date), fait: brut === 1 };
  }

  const acquis = store.total(t.id, null, add(date, -1));
  const saisi = store.amount(date, t.id);
  const reste = Math.max(0, (t.tot || 0) - acquis);

  const dispo = eligibles(t, date, t.fin);
  const tard = dispo <= 0;
  const jours = Math.max(1, dispo);

  let cible = reste > 0 ? arrondi(reste / jours) : 0;
  if (cible > reste) cible = reste;

  return {
    type: COMPTEUR, ecarte, tard, jours, reste, cible, saisi,
    manque: Math.max(0, cible - saisi),
    cumul: acquis + saisi,
    fini: reste <= 0,
    du: isDue(t, date) && reste > 0,
    fait: reste <= 0 || (cible > 0 && saisi >= cible),
  };
}

export function agenda(date) {
  return store.tasks()
    .map(t => ({ task: t, etat: state(t, date) }))
    .filter(({ etat }) => etat.du || etat.ecarte || etat.fait);
}

/* ================= Historique ================= */

/** Premier jour réellement enregistré pour cette tâche, sinon null. */
export function premierJour(id) {
  let premier = null;
  for (const [d, rec] of Object.entries(store.all().log)) {
    if (rec[id] !== undefined && (!premier || d < premier)) premier = d;
  }
  return premier;
}

/** Date de référence d'un compteur : celle saisie, sinon le premier jour suivi. */
export function debut(t) {
  return t.deb || premierJour(t.id) || today();
}

/**
 * Séries. On avance jour par jour depuis le premier jour enregistré :
 * les jours antérieurs au suivi sont ignorés, pas comptés comme des échecs.
 *
 * Réussi  → série + 1
 * Échoué  → série remise à zéro
 * Neutre  → série inchangée (jour écarté, jour non dû, objectif déjà bouclé)
 *
 * La journée en cours ne peut qu'allonger la série, jamais la casser.
 */
export function series(t, jusqu = today()) {
  if (t.t === PONCTUELLE) return { encours: 0, record: 0 };

  const depart = premierJour(t.id);
  if (!depart) return { encours: 0, record: 0 };

  let encours = 0, record = 0, acquis = 0, derniere = null;

  for (let d = depart; d <= jusqu; d = add(d, 1)) {
    const brut = store.entry(d, t.id);
    const aujourdhui = d === jusqu;

    if (brut === store.ECARTE) continue;

    let reussi;

    if (t.t === RECURRENTE) {
      // Jour où une tâche remplaçante prenait le relais : neutre.
      if (brut !== 1 && masquee(t, d)) continue;

      const du = t.j && t.j.length
        ? t.j.includes(weekday(d))
        : (!derniere || diff(derniere, d) >= (t.int || 1));
      if (!du) continue;
      reussi = brut === 1;
      if (reussi) derniere = d;
    } else {
      const reste = Math.max(0, (t.tot || 0) - acquis);
      const valeur = typeof brut === 'number' ? brut : 0;
      if (reste <= 0) { acquis += valeur; continue; }
      if (t.j && t.j.length && !t.j.includes(weekday(d))) { acquis += valeur; continue; }

      const jours = Math.max(1, eligibles(t, d, t.fin));
      const cible = Math.min(reste, arrondi(reste / jours));
      reussi = valeur >= cible;
      acquis += valeur;
    }

    if (reussi) {
      encours++;
      if (encours > record) record = encours;
    } else if (!aujourdhui) {
      encours = 0;
    }
  }

  return { encours, record };
}

/**
 * Écart au rythme idéal, exprimé dans l'unité de la tâche.
 * Positif = avance. La journée en cours n'est pas encore attendue.
 */
export function rythme(t, date = today()) {
  if (t.t !== COMPTEUR) return null;

  const de = debut(t);
  const total = eligibles(t, de, t.fin);
  if (total <= 0) return null;

  const ecoules = Math.max(0, eligibles(t, de, add(date, -1)));
  const attendu = (t.tot || 0) * (ecoules / total);
  const cumul = store.total(t.id, null, date);

  return { ecart: cumul - attendu, attendu, cumul };
}

/* ================= Entretien ================= */

/**
 * Supprime les tâches ponctuelles cochées la veille.
 */
export function nettoyer(jour = today()) {
  const aSupprimer = [];

  for (const t of store.tasks()) {
    if (t.t !== PONCTUELLE) continue;
    for (const [d, rec] of Object.entries(store.all().log)) {
      if (d < jour && rec[t.id] === 1) { aSupprimer.push(t.id); break; }
    }
  }

  for (const id of aSupprimer) store.removeTask(id);
  return aSupprimer.length;
}
