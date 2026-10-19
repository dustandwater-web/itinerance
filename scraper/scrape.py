#!/usr/bin/env python3
"""
Aspire le contenu de www.itinerance.ch vers le nouveau site statique.

  - data/posts.json : tous les articles du blog
  - data/pages.json : toutes les pages (été, hiver, ailleurs, qui suis-je, via alpina, contact
                      et toutes les sous-pages trouvées : tours, voyages, randonnées…)
  - media/          : toutes les images et fichiers (PDF…) utilisés
  - scraper/raw/    : le HTML brut de chaque page, pour contrôle

Usage :
    pip install requests beautifulsoup4
    python scraper/scrape.py

Si le contenu extrait contient encore des menus ou une colonne latérale, inspecte un fichier
de scraper/raw/, repère le conteneur du contenu (ex. div#contenu) et relance avec :
    python scraper/scrape.py --selector "div#contenu"
"""
import argparse
import json
import re
import sys
import time
import os
from collections import Counter, deque
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import warnings

try:
    import requests
    from bs4 import BeautifulSoup, Comment, NavigableString
except ImportError:
    sys.exit("Installe d'abord les dépendances :  pip install requests beautifulsoup4")
try:
    from bs4 import XMLParsedAsHTMLWarning
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
except ImportError:
    pass

BASE = os.environ.get("ITI_BASE", "http://www.itinerance.ch/")
HOST = urlparse(BASE).netloc
ROOT = Path(__file__).resolve().parent.parent
DATA, MEDIA, RAW = ROOT / "data", ROOT / "media", Path(__file__).resolve().parent / "raw"

START_PAGES = [
    "pages/ete.php", "pages/hiver.php", "pages/ailleurs.php", "pages/blog.php",
    "pages/qui-suis-je.php", "pages/contact.php", "pages/via-alpina.php",
]
EXTRA_MEDIA = ["media/puce.gif", "media/Couverture_via_alpina.jpg", "media/DVD_petit.jpg"]
NAV_HREFS = {urljoin(BASE, p) for p in START_PAGES} | {BASE, BASE + "index.php"}
POST_RE = re.compile(r"/pages/posts/(?P<slug>.+?)-?(?P<id>\d+)\.php$")
DATE_RE = re.compile(r"\b(\d{2})[-./](\d{2})[-./](\d{4})\b")
KEEP_ATTRS = {"href", "src", "alt", "title", "colspan", "rowspan", "width", "height", "allowfullscreen"}
DOWNLOADABLE = re.compile(r"\.(jpe?g|png|gif|bmp|webp|svg|pdf|gpx|kml|kmz|zip|rar|docx?|xlsx?|pptx?|mp3|mp4|avi|wmv|mov|flv|swf)$", re.I)
# cadres décoratifs découpés en tranches : 4_haut.jpg, 4_img_h_g.jpg, 2_mil_1.jpg…
# (4_img_haut.jpg, 2_img_centre.jpg… sont les photos elles-mêmes : on les garde)
FRAME_SLICE = re.compile(
    r"^\d+_(?:haut|bas|gauche|droite|mil(?:_\d+)?|img_(?:[hbc]_)?[gd])\.(?:jpe?g|gif|png)$", re.I)
# moteur de recherche, flux RSS/Atom, administration : pas des pages du site
SKIP_RE = re.compile(r"(search|rss|atom|feed|login|admin|print)", re.I)

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (migration itinerance.ch)"
downloaded = {}


# ---------------------------------------------------------------- réseau
failures = []


def fetch(url):
    err = None
    for attempt in range(3):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 404:
                failures.append(f"404  {url}")
                return None
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            err = e
            print(f"   ! {url} ({e}), nouvel essai…")
            time.sleep(2)
    failures.append(f"ERR  {url}  ({err})")
    return None


LINK_RE = re.compile(r"""['"(]\s*((?:https?://[^'"()\s]*itinerance\.ch)?[^'"()\s<>]*\.php(?:\?[^'"()\s<>]*)?)\s*['")]""", re.I)


def is_html(resp):
    ctype = resp.headers.get("Content-Type", "").lower()
    if "html" in ctype:
        return True
    head = resp.content[:3000].lstrip().lower()
    return b"<html" in head and not head.startswith(b"<?xml")


def base_of(url, soup):
    """Les pages déclarent <base href="http://www.itinerance.ch/"> : les liens relatifs
    (media/…, documents/…) partent de la racine du site, pas du dossier de la page."""
    b = soup.find("base", href=True)
    return urljoin(url, b["href"]) if b else url


def links_in(url, soup, text):
    """Toutes les adresses internes d'une page : liens, cadres, cartes cliquables, et
    adresses .php écrites dans du JavaScript (onclick, window.open…)."""
    found = []
    for tag, attr in (("a", "href"), ("area", "href"), ("frame", "src"), ("iframe", "src")):
        for t in soup.find_all(tag):
            if t.get(attr):
                found.append((t, t[attr]))
    for m in LINK_RE.finditer(text):
        found.append((None, m.group(1).replace("&amp;", "&")))
    out = []
    for tag, href in found:
        href = href.strip()
        if href.startswith(("mailto:", "#", "tel:")):
            continue
        href = re.sub(r"^javascript:.*?['\"]([^'\"]+)['\"].*$", r"\1", href, flags=re.I)
        absu = urljoin(base_of(url, soup), href)
        if is_internal(absu) and urlparse(absu).scheme in ("http", "https") \
                and not DOWNLOADABLE.search(urlparse(absu).path) \
                and not SKIP_RE.search(urlparse(absu).path + "?" + urlparse(absu).query):
            out.append((tag, absu))
    return out


def soup_of(resp):
    # vieux site PHP : souvent en ISO-8859-1 ; BeautifulSoup lit la balise meta charset
    return BeautifulSoup(resp.content, "html.parser")


def is_internal(url):
    return urlparse(url).netloc in ("", HOST, "itinerance.ch")


def normalize(url):
    p = urlparse(url)
    return f"{urlparse(BASE).scheme}://{HOST}{p.path}" + (f"?{p.query}" if p.query else "")


def download(url):
    """Télécharge un fichier dans media/ et renvoie le chemin relatif."""
    url = normalize(url)
    if url in downloaded:
        return downloaded[url]
    name = unquote(Path(urlparse(url).path).name) or "fichier"
    name = re.sub(r"[^\w.\-]", "_", name)
    dest = MEDIA / name
    if not dest.exists():
        r = fetch(url)
        if r is None:
            print(f"   ! média introuvable : {url}")
            downloaded[url] = url  # on garde l'URL d'origine
            return url
        dest.write_bytes(r.content)
    downloaded[url] = f"media/{name}"
    return downloaded[url]


# ---------------------------------------------------------------- identifiants
def page_slug(url):
    p = urlparse(url)
    path = p.path.lstrip("/")
    path = re.sub(r"^pages/", "", path)
    path = re.sub(r"\.php$|\.html?$", "", path)
    slug = path.replace("/", "-") or "accueil"
    if p.query:
        slug += "-" + re.sub(r"[^\w]+", "-", p.query).strip("-")
    return slug.lower()


def post_match(url):
    return POST_RE.search(urlparse(url).path)


# ---------------------------------------------------------------- nettoyage
def alive(node):
    """Faux si l'élément a déjà été supprimé avec un de ses parents."""
    return hasattr(node, "parent") and not getattr(node, "decomposed", False)


def strip_chrome(soup):
    """Retire menus, en-tête et pied de page communs à toutes les pages."""
    for t in soup(["script", "style", "noscript", "link", "meta", "form", "input", "button"]):
        t.decompose()
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    # listes de navigation : toutes leurs cibles sont des pages du menu
    for ul in soup.find_all("ul"):
        if not alive(ul):
            continue
        hrefs = {normalize(urljoin(BASE, a.get("href", ""))) for a in ul.find_all("a")}
        if hrefs and hrefs <= NAV_HREFS:
            ul.decompose()
    # titre du site
    for h in soup.find_all(["h1", "h2"]):
        if not alive(h):
            continue
        t = h.get_text(" ", strip=True).lower()
        if t in ("itinérance alpine", "itinerance alpine", "à la découverte des territoires alpins"):
            h.decompose()
    # pied de page : le plus petit bloc qui contient la mention de copyright
    for s in soup.find_all(string=re.compile("Tous droits réservés|Powered by")):
        if not alive(s) or s.parent is None:
            continue  # déjà supprimé avec un autre morceau du pied de page
        el = s.parent
        while el.parent and el.parent.name not in ("body", "html") and \
                len(el.parent.get_text(strip=True)) <= len(el.get_text(strip=True)) + 5:
            el = el.parent
        el.decompose()


CONTAINERS = ["div", "td", "table", "section", "article", "main"]


def own_text(el):
    """Longueur du texte hors liens : le contenu rédigé, pas les menus."""
    total = len(el.get_text(strip=True))
    return total - sum(len(a.get_text(strip=True)) for a in el.find_all("a"))


def describe(el):
    return el.name + (f"#{el['id']}" if el.get("id") else "") + "".join(f".{c}" for c in el.get("class", []))


def css_selector(el):
    if el.get("id"):
        return f"{el.name}#{el['id']}"
    return el.name + "".join(f".{c}" for c in el.get("class", []))


def main_content(soup, selector=None):
    if selector:
        el = soup.select_one(selector)
        if el:
            return el
        print(f"   ! sélecteur {selector!r} introuvable, détection automatique")
    body = soup.body or soup
    total = own_text(body) or 1
    # le plus petit conteneur qui garde au moins 85 % du texte rédigé
    best = body
    for el in body.find_all(CONTAINERS):
        if own_text(el) >= 0.85 * total and len(el.get_text(strip=True)) < len(best.get_text(strip=True)):
            best = el
    return best


def drop_frame_slices(el):
    """L'ancien site entourait ses photos d'un cadre découpé en tranches collées au
    pixel. On jette les tranches (inutile de les télécharger) et on renvoie les
    paragraphes qui ne contiennent plus que les vraies photos : la CSS du nouveau
    site refait le cadre."""
    holders = []
    for img in el.find_all("img"):
        if not FRAME_SLICE.match((img.get("src") or "").split("/")[-1]):
            continue
        holder = img.find_parent("p") or img.parent
        if holder is not None and not any(holder is h for h in holders):
            holders.append(holder)
        img.decompose()
    return [h for h in holders
            if h.parent is not None and not h.get_text(strip=True).strip("\xa0\u200b")]


def frame_photos(holders):
    """Déclare chaque ancienne rangée de photos sur une seule ligne :

        <figure class="photo-rail" data-photos="media/une.jpg, media/deux.jpg"></figure>

    Le site construit les vignettes encadrées, le recadrage et la galerie à partir de
    cette liste (voir rails() dans js/app.js) ; ajouter une photo plus tard revient à
    ajouter son nom de fichier à l'attribut, sans écrire de HTML."""
    soup = BeautifulSoup("", "html.parser")
    for holder in holders:
        shots = [img.get("src", "") for img in holder.find_all("img")]
        if not shots:
            holder.decompose()          # un cadre qui n'entourait aucune photo
            continue
        holder.replace_with(soup.new_tag(
            "figure", attrs={"class": "photo-rail", "data-photos": ", ".join(shots)}))


def clean(el, base_url):
    """Nettoie le HTML, rapatrie les médias, réécrit les liens internes."""
    for tag in el.find_all(True):
        if not alive(tag):
            continue
        if tag.name in ("font", "center", "span") and not tag.find("img"):
            tag.unwrap()
            continue
        tag.attrs = {k: v for k, v in tag.attrs.items() if k in KEEP_ATTRS}
    framed = drop_frame_slices(el)
    for img in el.find_all("img"):
        src = img.get("src")
        if src:
            img["src"] = download(urljoin(base_url, src))
        img["loading"] = "lazy"
        if not img.get("alt"):
            img["alt"] = ""
    frame_photos(framed)   # après le téléchargement : les href pointent sur media/
    for a in el.find_all("a"):
        href = a.get("href")
        if not href or href.startswith(("mailto:", "#", "javascript:")):
            continue
        absu = urljoin(base_url, href)
        if not is_internal(absu):
            a["target"] = "_blank"
            a["rel"] = "noopener"
            continue
        m = post_match(absu)
        if SKIP_RE.search(urlparse(absu).path + "?" + urlparse(absu).query) and not m:
            a.unwrap()  # lien vers la recherche ou un flux RSS : n'existe plus
        elif m:
            a["href"] = f"post.html?id={m['id']}"
        elif DOWNLOADABLE.search(urlparse(absu).path):
            a["href"] = download(absu)
        elif normalize(absu).rstrip("/") + "/" == BASE or urlparse(absu).path in ("/index.php", "/"):
            a["href"] = "index.html"
        elif page_slug(absu) == "blog" or urlparse(absu).path.endswith("/blog.php"):
            a["href"] = "blog.html"
        else:
            a["href"] = f"page.html?p={page_slug(absu)}"
    # paragraphes vides et &nbsp; à la chaîne
    for p in el.find_all(["p", "div"]):
        if not alive(p):
            continue
        if not p.get_text(strip=True).replace("\xa0", "") and not p.find(["img", "iframe", "table"]):
            p.decompose()
    html = el.decode_contents() if el.name not in ("td",) else el.decode_contents()
    html = re.sub(r"(\s*<br\s*/?>\s*){3,}", "<br><br>", html)
    return html.strip()


def title_of(soup):
    t = soup.title.get_text(strip=True) if soup.title else ""
    return t.split("^", 1)[-1].strip() if "^" in t else t


def iso(d):
    m = DATE_RE.search(d or "")
    return f"{m[3]}-{m[2]}-{m[1]}" if m else None


# ---------------------------------------------------------------- crawl
def crawl(selector=None, delay=0.4):
    for d in (DATA, MEDIA, RAW):
        d.mkdir(parents=True, exist_ok=True)
    for m in EXTRA_MEDIA:
        download(urljoin(BASE, m))

    queue = deque([BASE] + [urljoin(BASE, p) for p in START_PAGES])
    seen = set()
    pages, posts, listing_dates = {}, {}, {}
    fetched = []

    while queue:
        url = normalize(queue.popleft())
        if url in seen:
            continue
        seen.add(url)
        resp = fetch(url)
        time.sleep(delay)
        if resp is None:
            continue
        if not is_html(resp):
            continue  # flux RSS, fichier Excel… : pas une page
        soup = soup_of(resp)
        base = base_of(url, soup)
        raw_name = page_slug(url) + ".html"
        m = post_match(url)
        (RAW / (f"post-{m['id']}.html" if m else raw_name)).write_bytes(resp.content)

        # liens à suivre (+ dates affichées dans la liste du blog)
        for a, absu in links_in(url, soup, resp.text):
            pm = post_match(absu)
            if a is not None and pm and "blog.php" in url:
                block = a.find_parent(["div", "td", "li", "p"]) or a.parent
                prev = block
                txt = ""
                for step in range(4):  # la date est souvent juste avant le lien "Voir la suite"
                    txt = prev.get_text(" ", strip=True) + " " + txt
                    if DATE_RE.search(txt):
                        break
                    prev = prev.find_previous_sibling() or prev.parent
                    if prev is None:
                        break
                d = iso(txt)
                if d:
                    # trouvée dans le bloc du lien lui-même : fiable
                    listing_dates.setdefault(pm["id"], (d, step == 0))
            queue.append(absu)

        fetched.append((url, soup, base))

    # 2e passe : toutes les pages partagent le même gabarit. On repère le conteneur
    # de contenu sur les pages où la détection est nette, puis on l'applique partout.
    if not selector:
        votes = Counter()
        for url, soup, _ in fetched:
            tmp = BeautifulSoup(str(soup), "html.parser")
            strip_chrome(tmp)
            el = main_content(tmp)
            if el.get("id") or el.get("class"):
                votes[css_selector(el)] += 1
        if votes:
            selector, n = votes.most_common(1)[0]
            print(f"\n  Conteneur de contenu détecté : {selector}  ({n}/{len(fetched)} pages)\n")

    for url, soup, base in fetched:
        m = post_match(url)
        strip_chrome(soup)
        content = main_content(soup, selector)

        if m:
            pid = int(m["id"])
            heading = content.find(["h1", "h2", "h3", "h4", "strong", "b"])
            title = heading.get_text(" ", strip=True) if heading else title_of(soup)
            if heading and heading.name.startswith("h"):
                heading.decompose()
            listed, sure = listing_dates.get(m["id"], (None, False))
            in_page = iso(content.get_text(" ", strip=True)[:300])
            date = (listed if sure else None) or in_page or listed
            # paragraphe qui ne contient que la date : déjà affichée par le site
            for p in content.find_all(["p", "div", "span", "em", "i"]):
                if alive(p) and re.fullmatch(r"\(?\s*\d{2}[-./]\d{2}[-./]\d{4}\s*\)?", p.get_text(strip=True)):
                    p.decompose()
                    break
            html = clean(content, base)
            text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
            images = re.findall(r'src="(media/[^"]+)"', html)
            posts[pid] = {
                "id": pid,
                "slug": m["slug"],
                "title": title,
                "date": date,
                "excerpt": (text[:220].rsplit(" ", 1)[0] + "…") if len(text) > 220 else text,
                "cover": next((i for i in images if not i.endswith("puce.gif")), None),
                "html": html,
                "source": url,
            }
            print(f"  article {pid:>3}  {date or '????-??-??'}  {title[:55]}  [{describe(content)}]")
        elif "blog.php" not in url and page_slug(url) not in ("accueil", "index"):
            slug = page_slug(url)
            pages[slug] = {"slug": slug, "title": title_of(soup), "html": clean(content, base), "source": url}
            print(f"  page     {slug}  [{describe(content)}]")

    # dates manquantes : on complète avec la liste du blog
    for pid, p in posts.items():
        if not p["date"]:
            p["date"] = listing_dates.get(str(pid), (None, False))[0]

    ordered = sorted(posts.values(), key=lambda p: (p["date"] or "", p["id"]), reverse=True)
    (DATA / "posts.json").write_text(json.dumps(ordered, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
    journal = [f"{len(seen)} adresses visitées, {len(fetched)} pages enregistrées dans raw/", ""]
    journal += ["Visitées :"] + sorted(seen) + ["", "Échecs :"] + (failures or ["aucun"])
    (RAW / "_journal.txt").write_text("\n".join(journal), encoding="utf-8")
    if failures:
        print(f"\n⚠ {len(failures)} adresses en échec (voir scraper/raw/_journal.txt) :")
        for f in failures[:15]:
            print("   " + f)
    print(f"\n✔ {len(ordered)} articles, {len(pages)} pages, {len(set(downloaded.values()))} médias.")
    print("  Vérifie le résultat :  python -m http.server  puis http://localhost:8000")


if __name__ == "__main__":
    # console Windows : évite les plantages sur les accents et les symboles
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selector", help="sélecteur CSS du conteneur de contenu (ex. 'div#contenu')")
    ap.add_argument("--delay", type=float, default=0.4, help="pause entre deux requêtes (s)")
    args = ap.parse_args()
    crawl(args.selector, args.delay)