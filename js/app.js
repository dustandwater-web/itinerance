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
        <a href="index.html"><h1>Itinérance alpine</h1></a>
        <p>à la découverte des territoires alpins</p>
      </div>
    </div>
    <svg class="ridge" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#5d7384" opacity=".55" d="M0 70 L90 44 L160 58 L250 22 L330 50 L410 30 L500 62 L590 18 L660 40 L760 12 L850 48 L930 34 L1010 60 L1100 26 L1180 46 L1270 20 L1350 52 L1440 36 V90 H0Z"/>
      <path fill="#f6f4ef" d="M0 82 L120 60 L200 74 L300 46 L380 70 L470 52 L560 78 L660 40 L720 58 L820 34 L910 66 L1000 50 L1090 76 L1180 48 L1260 64 L1350 42 L1440 60 V90 H0Z"/>
    </svg>
  </header>
  <nav class="sections" aria-label="Rubriques"><ul>${SECTIONS.map((s) => `<li>${link(s)}</li>`).join("")}</ul></nav>`;

  $("#footer").outerHTML = `
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
  el.innerHTML = `<h1 class="page-title">${esc(p.title)}</h1><div class="prose">${p.html}</div>`;
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
