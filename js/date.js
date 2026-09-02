// date.js — une date est toujours une chaîne "AAAA-MM-JJ" en heure locale.

const MS_JOUR = 86400000;

/** Objet Date → "AAAA-MM-JJ" local. */
export function iso(d) {
  const z = new Date(d);
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
  return z.toISOString().slice(0, 10);
}

/** "AAAA-MM-JJ" → Date à minuit local. */
export function parse(s) {
  return new Date(s + 'T00:00:00');
}

/** La date du jour. */
export function today() {
  return iso(new Date());
}

/** Nombre de jours de a vers b. Négatif si b précède a. */
export function diff(a, b) {
  return Math.round((parse(b) - parse(a)) / MS_JOUR);
}

/** Décale une date de n jours. */
export function add(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Jour de la semaine : 1 = lundi … 7 = dimanche. */
export function weekday(s) {
  return parse(s).getDay() || 7;
}

/** Format attendu et date réelle. */
export function valid(s) {
  return typeof s === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !isNaN(parse(s));
}

/** "Mardi 2 septembre" */
export function libelle(s) {
  const t = parse(s).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
