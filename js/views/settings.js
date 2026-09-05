import * as store from '../store.js';
import { today } from '../date.js';

let enAttente = null;   // fichier lu, en attente de confirmation
let message = null;     // retour affiché après une action
let confirmation = false;
let redessiner = () => {};

export function onRedraw(fn) { redessiner = fn; }

export function render(racine) {
  const retour = document.createElement('div');
  retour.className = 'topbar retour';
  const sortie = document.createElement('button');
  sortie.textContent = '‹ Tâches';
  sortie.onclick = () => { location.hash = '#/taches'; };
  retour.appendChild(sortie);
  racine.appendChild(retour);
  const h = document.createElement('header');
  h.className = 'entete';
  const titre = document.createElement('h1');
  titre.textContent = 'Réglages';
  const sous = document.createElement('p');
  sous.className = 'sub';
  sous.textContent = resume();
  h.append(titre, sous);
  racine.append(h);

  if (message) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = message;
    racine.appendChild(p);
  }

  racine.appendChild(bloc('Sauvegarde',
    'Tes données vivent uniquement dans ce navigateur. Exporte régulièrement.',
    [
      bouton('Exporter mes données', 'ajout', exporter),
      bouton('Importer un fichier', '', choisirFichier),
    ]));

  if (enAttente) racine.appendChild(apercu());

  racine.appendChild(bloc('Zone sensible',
    'Efface les tâches et tout l’historique, sans retour possible.',
    [bouton(
      confirmation ? 'Confirmer l’effacement' : 'Tout effacer',
      'danger',
      effacer,
    )]));
}

function resume() {
  const d = store.all();
  const taches = d.tasks.length;
  const jours = Object.keys(d.log).length;
  const poids = Math.round(store.exportJSON().length / 1024 * 10) / 10;
  return `${taches} tâche${taches > 1 ? 's' : ''}, ${jours} jour${jours > 1 ? 's' : ''} enregistré${jours > 1 ? 's' : ''}, ${poids} Ko.`;
}

/* ---------------- Briques ---------------- */

function bloc(titre, texte, boutons) {
  const el = document.createElement('section');
  el.className = 'bloc';

  const t = document.createElement('h2');
  t.textContent = titre;

  const p = document.createElement('p');
  p.className = 'aide';
  p.textContent = texte;

  el.append(t, p, ...boutons);
  return el;
}

function bouton(texte, classe, action) {
  const b = document.createElement('button');
  b.className = 'large' + (classe ? ' ' + classe : '');
  b.textContent = texte;
  b.onclick = action;
  return b;
}

/* ---------------- Export ---------------- */

function exporter() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `todom-${today()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  message = 'Fichier généré. Range-le en lieu sûr.';
  redessiner();
}

/* ---------------- Import ---------------- */

function choisirFichier() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => lire(String(lecteur.result), f.name);
    lecteur.onerror = () => { message = 'Fichier illisible.'; redessiner(); };
    lecteur.readAsText(f);
  };
  input.click();
}

function lire(texte, nom) {
  try {
    const d = JSON.parse(texte);
    if (!d || !Array.isArray(d.tasks)) throw new Error();
    enAttente = {
      texte, nom,
      taches: d.tasks.length,
      jours: Object.keys(d.log || {}).length,
    };
    message = null;
  } catch (e) {
    enAttente = null;
    message = 'Ce fichier n’est pas une sauvegarde valide.';
  }
  redessiner();
}

function apercu() {
  const el = document.createElement('section');
  el.className = 'bloc attention';

  const t = document.createElement('h2');
  t.textContent = 'Fichier prêt';

  const p = document.createElement('p');
  p.className = 'aide';
  p.textContent = `${enAttente.nom} · ${enAttente.taches} tâches, ${enAttente.jours} jours. `
    + 'Il remplacera intégralement tes données actuelles.';

  const remplacer = bouton('Remplacer mes données', 'ajout', () => {
    try {
      store.importJSON(enAttente.texte);
      message = 'Données restaurées.';
    } catch (e) {
      message = 'L’import a échoué.';
    }
    enAttente = null;
    redessiner();
  });

  const annuler = bouton('Annuler', '', () => {
    enAttente = null;
    redessiner();
  });

  el.append(t, p, remplacer, annuler);
  return el;
}

/* ---------------- Effacement ---------------- */

function effacer() {
  if (!confirmation) { confirmation = true; redessiner(); return; }
  store.clear();
  confirmation = false;
  message = 'Toutes les données ont été effacées.';
  redessiner();
}
