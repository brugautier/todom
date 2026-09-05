// views/shopping.js — inventaire permanent des articles.
//
// Un article coché est un article à acheter. Au magasin, on le décoche
// une fois dans le panier : il retourne en réserve, prêt à resservir.
// On ne supprime que par le mode « Modifier ».

import * as store from '../store.js';

let edition = false;
let saisie = '';       // conservée entre deux redessins
let redonnerFocus = false;
let redessiner = () => {};

export function onRedraw(fn) { redessiner = fn; }

const parNom = (a, b) => a.n.localeCompare(b.n, 'fr', { sensitivity: 'base' });

export function render(racine) {
  const tous = [...store.courses()].sort(parNom);
  const aPrendre = tous.filter(c => c.need);
  const reserve = tous.filter(c => !c.need);

  racine.append(entete(tous.length), champAjout());

  if (!tous.length) {
    const p = document.createElement('p');
    p.className = 'vide';
    p.textContent = 'Liste vide. Ajoute tes articles habituels au fil du temps.';
    racine.appendChild(p);
    return;
  }

  if (aPrendre.length) {
    racine.appendChild(titre(`À acheter · ${aPrendre.length}`));
    for (const c of aPrendre) racine.appendChild(article(c));
  }

  if (reserve.length) {
    racine.appendChild(titre(`En réserve · ${reserve.length}`, aPrendre.length > 0));
    for (const c of reserve) racine.appendChild(article(c));
  }

  if (redonnerFocus) {
    redonnerFocus = false;
    const champ = racine.querySelector('.ajout-ligne input');
    if (champ) champ.focus();
  }
}

function entete(total) {
  const el = document.createElement('header');
  el.className = 'entete duo-entete';

  const h = document.createElement('h1');
  h.textContent = 'Courses';

  const b = document.createElement('button');
  b.className = 'court' + (edition ? ' actif' : '');
  b.textContent = edition ? 'Terminé' : 'Modifier';
  b.disabled = !total;
  b.onclick = () => { edition = !edition; redessiner(); };

  el.append(h, b);
  return el;
}

function titre(texte, espace) {
  const el = document.createElement('p');
  el.className = 'sec' + (espace ? '' : ' serre');
  el.textContent = texte;
  return el;
}

/* ---------------- Ajout ---------------- */

function champAjout() {
  const el = document.createElement('div');
  el.className = 'ajout-ligne';

  const champ = document.createElement('input');
  champ.type = 'text';
  champ.placeholder = 'Ajouter un article';
  champ.value = saisie;
  champ.autocapitalize = 'sentences';
  champ.setAttribute('aria-label', 'Nom de l’article');
  champ.oninput = () => { saisie = champ.value; };

  const bouton = document.createElement('button');
  bouton.className = 'ajout plus';
  bouton.textContent = '+';
  bouton.setAttribute('aria-label', 'Ajouter');

  const valider = () => {
    if (!saisie.trim()) { champ.focus(); return; }
    const nom = saisie;
    saisie = '';
    redonnerFocus = true;   // on enchaîne souvent plusieurs articles
    store.addCourse(nom);
  };

  bouton.onclick = valider;
  champ.onkeydown = e => { if (e.key === 'Enter') valider(); };

  el.append(champ, bouton);
  return el;
}

/* ---------------- Article ---------------- */

function article(c) {
  const el = document.createElement('article');
  el.className = 'carte article' + (c.need ? ' prise' : ' dispo');

  const marque = document.createElement('span');
  marque.className = 'marque';
  marque.setAttribute('aria-hidden', 'true');
  marque.textContent = '✓';

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = c.n;

  el.append(marque, nom);

  if (edition) {
    const retirer = document.createElement('button');
    retirer.className = 'retirer';
    retirer.textContent = '×';
    retirer.setAttribute('aria-label', `Supprimer ${c.n}`);
    retirer.onclick = e => {
      e.stopPropagation();
      store.removeCourse(c.id);
    };
    el.appendChild(retirer);
  } else {
    el.tabIndex = 0;
    el.onclick = () => store.toggleCourse(c.id);
    el.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    };
  }

  return el;
}
