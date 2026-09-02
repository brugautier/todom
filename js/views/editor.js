// views/editor.js — création et modification d'une tâche, en écran plein.
//
// Le brouillon vit en mémoire tant qu'on n'a pas enregistré : rien n'est écrit
// dans le store avant l'appui sur « Enregistrer ».

import * as store from '../store.js';
import * as engine from '../engine.js';
import { today } from '../date.js';

let brouillon = null;
let cible = null;        // id en cours d'édition, null si création
let confirmation = false; // second appui sur Supprimer
let redessiner = () => {};

export function onRedraw(fn) { redessiner = fn; }

function neuf() {
  return {
    n: '', t: engine.COMPTEUR,
    u: '', tot: '', fin: new Date().getFullYear() + '-12-31',
    deja: '', deb: today(),
    mode: 'int', int: 1, j: [],
  };
}

function depuis(t) {
  return {
    n: t.n || '',
    t: t.t,
    u: t.u || '', tot: t.tot ?? '', fin: t.fin || '',
    deja: '', deb: t.deb || today(),
    mode: t.j && t.j.length ? 'j' : 'int',
    int: t.int || 1,
    j: t.j ? [...t.j] : [],
  };
}

/** Appelée par le routeur. id vaut 'nouveau' ou l'identifiant d'une tâche. */
export function prepare(id) {
  confirmation = false;
  if (id === 'nouveau') { cible = null; brouillon = neuf(); return true; }

  const t = store.task(id);
  if (!t) return false;
  cible = id;
  brouillon = depuis(t);
  return true;
}

export function render(racine) {
  if (!brouillon) { location.hash = '#/taches'; return; }
  const b = brouillon;

  racine.appendChild(barre());

  racine.appendChild(champ('Nom', texte('n', b.n, 'Marche')));

  racine.appendChild(champ('Type', segments([
    ['À cocher', engine.COCHE],
    ['Compteur', engine.COMPTEUR],
  ], b.t, v => { relire(); b.t = v; redessiner(); })));

  if (b.t === engine.COMPTEUR) rendreCompteur(racine, b);
  else rendreCoche(racine, b);

  if (cible) racine.appendChild(suppression());
}

/* ---------------- Blocs de champs ---------------- */

function rendreCompteur(racine, b) {
  const duo = document.createElement('div');
  duo.className = 'duo';
  duo.append(
    champ('Total visé', nombre('tot', b.tot, '600')),
    champ('Unité', texte('u', b.u, 'km')),
  );
  racine.appendChild(duo);

  racine.appendChild(champ('Échéance', date('fin', b.fin)));

  if (!cible) {
    const bloc = champ('Déjà fait avant aujourd’hui', nombre('deja', b.deja, '0'));
    bloc.querySelector('input').onchange = () => { relire(); redessiner(); };
    racine.appendChild(bloc);

    // La date de départ n'a de sens que s'il y a un acquis à situer dans le temps.
    if (parseFloat(String(b.deja).replace(',', '.')) > 0) {
      const depuis = champ('Depuis le', date('deb', b.deb));
      const aide = document.createElement('p');
      aide.className = 'aide';
      aide.textContent = 'Sert de référence pour calculer ton avance ou ton retard.';
      depuis.appendChild(aide);
      racine.appendChild(depuis);
    }
  }
}

function rendreCoche(racine, b) {
  racine.appendChild(champ('Récurrence', segments([
    ['Tous les N jours', 'int'],
    ['Jours de semaine', 'j'],
  ], b.mode, v => { relire(); b.mode = v; redessiner(); })));

  if (b.mode === 'int') {
    const bloc = champ('Intervalle en jours', nombre('int', b.int, '3'));
    const aide = document.createElement('p');
    aide.className = 'aide';
    aide.textContent = 'Compté depuis la dernière fois où tu l’as faite.';
    bloc.appendChild(aide);
    racine.appendChild(bloc);
  } else {
    racine.appendChild(champ('Jours', pastilles(b)));
  }
}

/* ---------------- Briques ---------------- */

function champ(libelle, controle) {
  const el = document.createElement('div');
  el.className = 'champ';
  const l = document.createElement('label');
  l.textContent = libelle;
  if (controle.id) l.htmlFor = controle.id;
  el.append(l, controle);
  return el;
}

function base(type, cle, valeur, exemple) {
  const i = document.createElement('input');
  i.type = type;
  i.id = 'f-' + cle;
  i.dataset.cle = cle;
  i.value = valeur;
  if (exemple) i.placeholder = exemple;
  return i;
}

const texte = (c, v, e) => base('text', c, v, e);
const date = (c, v) => base('date', c, v);

function nombre(cle, valeur, exemple) {
  const i = base('number', cle, valeur, exemple);
  i.step = 'any';
  i.inputMode = 'decimal';
  return i;
}

function segments(options, actif, choisir) {
  const el = document.createElement('div');
  el.className = 'segments';
  for (const [libelle, valeur] of options) {
    const b = document.createElement('button');
    b.className = 'seg' + (valeur === actif ? ' on' : '');
    b.textContent = libelle;
    b.onclick = () => choisir(valeur);
    el.appendChild(b);
  }
  return el;
}

function pastilles(b) {
  const el = document.createElement('div');
  el.className = 'jours';
  const noms = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  for (let n = 1; n <= 7; n++) {
    const bouton = document.createElement('button');
    bouton.className = 'jour' + (b.j.includes(n) ? ' on' : '');
    bouton.textContent = noms[n - 1];
    bouton.setAttribute('aria-pressed', b.j.includes(n));
    bouton.onclick = () => {
      relire();
      b.j = b.j.includes(n) ? b.j.filter(x => x !== n) : [...b.j, n].sort();
      redessiner();
    };
    el.appendChild(bouton);
  }
  return el;
}

/* ---------------- Barre du haut ---------------- */

function barre() {
  const el = document.createElement('div');
  el.className = 'topbar';

  const annuler = document.createElement('button');
  annuler.textContent = 'Annuler';
  annuler.onclick = () => { location.hash = '#/taches'; };

  const titre = document.createElement('span');
  titre.className = 'titre';
  titre.textContent = cible ? 'Modifier' : 'Nouvelle tâche';

  const valider = document.createElement('button');
  valider.className = 'ajout court';
  valider.textContent = 'Enregistrer';
  valider.onclick = enregistrer;

  el.append(annuler, titre, valider);
  return el;
}

function suppression() {
  const b = document.createElement('button');
  b.className = 'danger';
  b.textContent = confirmation ? 'Confirmer la suppression' : 'Supprimer la tâche';
  b.onclick = () => {
    if (!confirmation) { confirmation = true; redessiner(); return; }
    const id = cible;
    cible = null; brouillon = null;
    store.removeTask(id);
    location.hash = '#/taches';
  };
  return b;
}

/* ---------------- Lecture et écriture ---------------- */

/** Recopie les champs affichés dans le brouillon avant tout redessin. */
function relire() {
  for (const i of document.querySelectorAll('#vue input[data-cle]')) {
    brouillon[i.dataset.cle] = i.value;
  }
}

function erreur(message) {
  let el = document.querySelector('.erreur');
  if (!el) {
    el = document.createElement('p');
    el.className = 'erreur';
    document.querySelector('.topbar').after(el);
  }
  el.textContent = message;
}

function enregistrer() {
  relire();
  const b = brouillon;

  const nom = b.n.trim();
  if (!nom) return erreur('Donne un nom à la tâche.');

  let tache;
  if (b.t === engine.COMPTEUR) {
    const tot = parseFloat(String(b.tot).replace(',', '.'));
    if (!(tot > 0)) return erreur('Le total visé doit être supérieur à zéro.');
    if (!b.fin) return erreur('Choisis une échéance.');
    tache = { n: nom, t: engine.COMPTEUR, u: b.u.trim(), tot, fin: b.fin };
    if (b.deb) tache.deb = b.deb;
  } else {
    tache = { n: nom, t: engine.COCHE };
    if (b.mode === 'j') {
      if (!b.j.length) return erreur('Choisis au moins un jour.');
      tache.j = b.j;
    } else {
      const int = parseInt(b.int, 10);
      if (!(int >= 1)) return erreur('L’intervalle doit valoir au moins 1 jour.');
      tache.int = int;
    }
  }

  if (cible) {
    store.updateTask(cible, { ...tache, j: tache.j || null, int: tache.int || null });
  } else {
    const creee = store.addTask(tache);
    const deja = parseFloat(String(b.deja).replace(',', '.'));
    if (b.t === engine.COMPTEUR && deja > 0) {
      // L'acquis est daté du jour de départ, pas d'aujourd'hui : la progression
      // et le calcul de rythme partent ainsi du bon point.
      store.setEntry(b.deb || today(), creee.id, deja);
    }
  }

  brouillon = null; cible = null;
  location.hash = '#/taches';
}
