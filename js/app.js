/* Itinérance alpine — rendu du site à partir de data/posts.json et data/pages.json */

const TOP_NAV = [
  ["index.html", "Accueil", "accueil"],
  ["page.html?p=qui-suis-je", "Qui suis-je ?", "qui-suis-je"],
  ["page.html?p=contact", "Contact", "contact"],
  ["page.html?p=via-alpina", "Via Alpina", "via-alpina"],
];
const SECTIONS = [
  ["page.html?p=ete", "été", "ete"],
  ["page.html?p=hiver", "hiver", "hiver"],
  ["page.html?p=ailleurs", "ailleurs", "ailleurs"],
  ["blog.html", "blog", "blog"],
];

/* coordonnées reprises de la page contact de l'ancien site ; l'encart les rend
   cliquables (mailto: et tel:), ce que le texte d'origine n'était pas. */
const CONTACT = { nom: "Vincent Tornay", mail: "vincent@itinerance.ch", tel: "+41 79 332 43 92" };
const PAGES_AVEC_CONTACT = ["contact", "qui-suis-je"];

const params = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });
}

async function load(name) {
  try {
    const r = await fetch(`data/${name}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    console.error(`Impossible de charger data/${name}.json`, e);
    return null;
  }
}

/* ---------- en-tête et pied de page communs ---------- */
function chrome(current) {
  const link = ([href, label, key]) =>
    `<a href="${href}"${key === current ? ' aria-current="page"' : ""}>${label}</a>`;
  $("#header").outerHTML = `
  <header class="site-header">
    <div class="wrap">
      <nav class="topbar" aria-label="Pages">${TOP_NAV.map(link).join("")}</nav>
      <div class="brand">
        <h1><a href="index.html"><img class="logo" src="images/logo-itinerance.svg"
          alt="Itinérance alpine" width="245" height="59"></a></h1>
      </div>
    </div>
    <svg class="ridge" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#5d7384" opacity=".55" d="M0 70 L90 44 L160 58 L250 22 L330 50 L410 30 L500 62 L590 18 L660 40 L760 12 L850 48 L930 34 L1010 60 L1100 26 L1180 46 L1270 20 L1350 52 L1440 36 V90 H0Z"/>
      <path fill="#f6f4ef" d="M0 82 L120 60 L200 74 L300 46 L380 70 L470 52 L560 78 L660 40 L720 58 L820 34 L910 66 L1000 50 L1090 76 L1180 48 L1260 64 L1350 42 L1440 60 V90 H0Z"/>
    </svg>
  </header>
  <nav class="sections" aria-label="Rubriques"><ul>${SECTIONS.map((s) => `<li>${link(s)}</li>`).join("")}</ul></nav>`;

  $("#footer").outerHTML = `
  <img class="frise" src="images/frise.svg" alt="" aria-hidden="true" width="960" height="248">
  <footer class="site-footer">
    <div class="wrap">
      <span>© Vincent Tornay — Tous droits réservés — www.itinerance.ch</span>
      <span>Contact <a href="mailto:webmaster@itinerance.ch">webmaster</a></span>
    </div>
  </footer>`;
}

function card(p) {
  const cover = p.cover ? `<a href="post.html?id=${p.id}"><img class="card-cover" src="${esc(p.cover)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></a>` : "";
  return `
  <article class="card${p.cover ? " has-cover" : ""}">
    ${cover}
    <div>
      <h3><a href="post.html?id=${p.id}">${esc(p.title)}</a></h3>
      ${p.date ? `<time datetime="${p.date}">${fmtDate(p.date)}</time>` : ""}
      <p>${esc(p.excerpt)} <a class="more" href="post.html?id=${p.id}">Voir la suite</a></p>
    </div>
  </article>`;
}

/* ---------- photos : rangées encadrées et galerie ----------
   Une rangée de photos se déclare dans le contenu sur une seule ligne :

     <figure class="photo-rail" data-photos="media/une.jpg, media/deux.jpg"></figure>

   Ajouter une photo = déposer le fichier dans media/ et ajouter son nom à la liste ;
   la retirer ou changer l'ordre se fait au même endroit. Le cadre, le recadrage et
   la galerie sont construits ici, il n'y a pas de HTML à écrire.
   (Les cadres découpés en tranches de l'ancien site sont convertis à l'import,
   voir drop_frame_slices() dans scraper/scrape.py.) */
function rails(root) {
  for (const fig of root.querySelectorAll("figure.photo-rail[data-photos]")) {
    const files = fig.dataset.photos.split(",").map((s) => s.trim()).filter(Boolean);
    if (!files.length) { fig.remove(); continue; }
    fig.replaceChildren(...files.map((src) => {
      const a = document.createElement("a");
      a.className = "shot";
      a.href = src;                    // sans JS, ou clic milieu : ouvre la photo
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      a.append(img);
      return a;
    }));
  }
}

function gallery(root) {
  const shots = [...root.querySelectorAll("a.shot")];
  if (!shots.length) return;
  let box, view, count, opener, i = 0;

  const show = (n) => {
    i = (n + shots.length) % shots.length;
    const img = shots[i].querySelector("img");
    view.src = img.getAttribute("src");
    view.alt = img.alt || "";
    count.textContent = shots.length > 1 ? `${i + 1} / ${shots.length}` : "";
  };
  const close = () => {
    box.hidden = true;
    document.documentElement.style.overflow = "";
    opener?.focus();
  };
  const build = () => {
    box = document.createElement("div");
    box.className = `lightbox${shots.length > 1 ? "" : " single"}`;
    box.hidden = true;
    box.innerHTML = `
      <button class="lb-close" type="button" aria-label="Fermer">&times;</button>
      <button class="lb-prev" type="button" aria-label="Photo précédente">&lsaquo;</button>
      <img alt="">
      <button class="lb-next" type="button" aria-label="Photo suivante">&rsaquo;</button>
      <p class="lb-count" aria-live="polite"></p>`;
    document.body.append(box);
    view = box.querySelector("img");
    count = box.querySelector(".lb-count");
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-prev").addEventListener("click", () => show(i - 1));
    box.querySelector(".lb-next").addEventListener("click", () => show(i + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(i - 1);
      else if (e.key === "ArrowRight") show(i + 1);
    });
  };

  shots.forEach((a, n) => a.addEventListener("click", (e) => {
    e.preventDefault();
    if (!box) build();
    opener = a;
    box.hidden = false;
    document.documentElement.style.overflow = "hidden";
    show(n);
    box.querySelector(".lb-close").focus();
  }));
}

/* remet d'aplomb les photos d'une page ou d'un article */
function photos(root) {
  if (!root) return;
  rails(root);
  gallery(root);
  // la puce de niveau de l'ancien site est déjà ce petit randonneur, mais en 11×19 px
  // crénelés : on lui substitue le tracé vectoriel
  for (const img of root.querySelectorAll('img[src$="puce.gif"]')) {
    img.src = "images/randonneur.svg";
    img.className = "walker";
  }
  // logos de certification posés devant leur texte : l'ancien site les servait en
  // pleine résolution (jusqu'à 1032 px de large), on les ramène à la taille d'une
  // vignette et on les fait longer le texte
  for (const par of root.querySelectorAll("p")) {
    if (par.textContent.replace(/[\s\u00a0\u200b]+/g, "")) {
      for (const img of par.querySelectorAll("img")) {
        if (img.classList.contains("walker") || img.getAttribute("src").endsWith("pdf.gif")) continue;
        img.classList.add("badge");
        par.classList.add("has-badge");
        // l'ancien site écartait le texte de l'image avec une suite d'espaces
        // insécables (8 d'affilée devant « Accompagnateur ») ; elles ne se
        // contractent pas, et le flottement du cadre s'en charge désormais
        let n = img.nextSibling;
        while (n && n.nodeType === 3 && !n.textContent.trim()) {
          const suivant = n.nextSibling;
          n.remove();
          n = suivant;
        }
        if (n && n.nodeType === 3) n.textContent = n.textContent.replace(/^[\s\u00a0]+/, "");
      }
    }
  }
  // quelques photos manquent déjà sur l'ancien site : pas d'icône cassée
  for (const img of root.querySelectorAll("img")) {
    const drop = () => (img.closest("a.shot") || img).remove();
    if (img.complete && !img.naturalWidth) drop();
    else img.addEventListener("error", drop, { once: true });
  }
}

/* ---------- accueil ---------- */
async function renderHome() {
  const posts = (await load("posts")) || [];
  $("#latest").innerHTML = posts.length
    ? posts.slice(0, 3).map(card).join("")
    : `<p class="empty">Aucune news pour le moment.</p>`;
}

/* ---------- liste du blog ---------- */
async function renderBlog() {
  const posts = (await load("posts")) || [];
  const list = $("#posts"), q = $("#q"), yearSel = $("#year");
  const years = [...new Set(posts.map((p) => (p.date || "").slice(0, 4)).filter(Boolean))];
  yearSel.innerHTML = `<option value="">Toutes les années</option>` + years.map((y) => `<option>${y}</option>`).join("");
  $("#count").textContent = `${posts.length} article${posts.length > 1 ? "s" : ""}`;

  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function draw() {
    const term = norm(q.value), y = yearSel.value;
    const shown = posts.filter((p) =>
      (!y || (p.date || "").startsWith(y)) &&
      (!term || norm(p.title + " " + p.excerpt + " " + p.html.replace(/<[^>]+>/g, " ")).includes(term)));
    if (!shown.length) { list.innerHTML = `<p class="empty">Aucun article trouvé.</p>`; return; }
    let html = "", lastYear = null;
    for (const p of shown) {
      const yy = (p.date || "").slice(0, 4) || "Sans date";
      if (yy !== lastYear) { html += `<h2 class="year">${yy}</h2>`; lastYear = yy; }
      html += card(p);
    }
    list.innerHTML = `<div class="news">${html}</div>`;
  }
  q.addEventListener("input", draw);
  yearSel.addEventListener("change", draw);
  draw();
}

/* ---------- article ---------- */
async function renderPost() {
  const posts = (await load("posts")) || [];
  const id = Number(params.get("id"));
  const i = posts.findIndex((p) => p.id === id);
  const el = $("#content");
  if (i < 0) {
    document.title = "Article introuvable ^ itinerance.ch";
    el.innerHTML = `<a class="back" href="blog.html">Tous les articles</a><h1 class="page-title">Article introuvable</h1>`;
    return;
  }
  const p = posts[i], newer = posts[i - 1], older = posts[i + 1];
  document.title = `${p.title} ^ itinerance.ch`;
  el.innerHTML = `
    <a class="back" href="blog.html">Tous les articles</a>
    <h1 class="page-title">${esc(p.title)}</h1>
    <p class="meta">${p.date ? `<time datetime="${p.date}">${fmtDate(p.date)}</time>` : ""}</p>
    <div class="prose">${p.html || `<p>${esc(p.excerpt)}</p>`}</div>
    <nav class="post-nav">
      ${older ? `<a href="post.html?id=${older.id}"><small>← Plus ancien</small>${esc(older.title)}</a>` : "<span></span>"}
      ${newer ? `<a href="post.html?id=${newer.id}" style="text-align:right"><small>Plus récent →</small>${esc(newer.title)}</a>` : "<span></span>"}
    </nav>`;
  photos(el.querySelector(".prose"));
}

/* La carte « Me contacter » affiche déjà le mail et le téléphone : on retire les
   lignes correspondantes du texte repris de l'ancien site, pour ne pas les répéter
   sous la liste des diplômes. Le numéro est comparé sur ses seuls chiffres, donc
   « +41 79 332 43 92 » et « 079.332.43.92 » se reconnaissent pareil. */
function retireCoordonnees(root) {
  const chiffres = (t) => t.replace(/\D/g, "");
  const tel = chiffres(CONTACT.tel);
  const promeneur = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const lignes = [];
  for (let n = promeneur.nextNode(); n; n = promeneur.nextNode()) {
    const c = chiffres(n.textContent);
    if (n.textContent.includes(CONTACT.mail) || (c.length > 6 && tel.endsWith(c))) lignes.push(n);
  }
  for (const n of lignes) {
    if (n.nextSibling?.nodeName === "BR") n.nextSibling.remove();
    n.remove();
  }
}

function carteContact() {
  return `
  <aside class="contact-card">
    <h2>Me contacter</h2>
    <p class="contact-nom">${esc(CONTACT.nom)}</p>
    <p><a href="mailto:${esc(CONTACT.mail)}">${esc(CONTACT.mail)}</a></p>
    <p><a href="tel:${esc(CONTACT.tel.replace(/\s/g, ""))}">${esc(CONTACT.tel)}</a></p>
  </aside>`;
}

/* ---------- page générique (été, hiver, ailleurs, tours…) ---------- */
async function renderPage() {
  const pages = (await load("pages")) || {};
  const slug = params.get("p") || "";
  const p = pages[slug];
  const el = $("#content");
  if (!p) {
    document.title = "Page introuvable ^ itinerance.ch";
    el.innerHTML = `<h1 class="page-title">Page introuvable</h1><p>Retour à l'<a href="index.html">accueil</a>.</p>`;
    return;
  }
  document.title = `${p.title} ^ itinerance.ch`;
  const prose = `<div class="prose">${p.html}</div>`;
  const avecCarte = PAGES_AVEC_CONTACT.includes(slug);
  el.innerHTML = `<h1 class="page-title">${esc(p.title)}</h1>` + (avecCarte
    ? `<div class="grid">${prose}${carteContact()}</div>`
    : prose);
  if (avecCarte) retireCoordonnees(el.querySelector(".prose"));
  photos(el.querySelector(".prose"));
}

/* ---------- démarrage ---------- */
const page = document.body.dataset.page;
const current = page === "page" ? params.get("p") : page;
chrome(SECTIONS.concat(TOP_NAV).some(([, , k]) => k === current) ? current : (page === "post" ? "blog" : current));
({ home: renderHome, blog: renderBlog, post: renderPost, page: renderPage })[page]?.();

if (location.protocol === "file:") {
  document.querySelector("main .wrap")?.insertAdjacentHTML("afterbegin",
    `<p class="notice">Ouvert directement depuis le disque : les données JSON ne se chargent pas. Lance <code>python -m http.server</code> dans le dossier du site puis ouvre <a href="http://localhost:8000">http://localhost:8000</a>.</p>`);
}
