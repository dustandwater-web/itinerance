# itinerance.ch — version statique HTML / CSS / JSON

## Structure
```
index.html        accueil (texte d'intro + 3 dernières news)
blog.html         liste des articles (recherche + filtre par année)
post.html?id=57   un article
page.html?p=ete   n'importe quelle page (été, hiver, ailleurs, qui-suis-je, contact, via-alpina, sous-pages…)
data/posts.json   tous les articles du blog
data/pages.json   toutes les pages
media/            images et PDF du contenu (remplis par l'import)
media/originaux/  pleine résolution des photos que le site sert allégées
images/           identité reprise du site d'origine, vectorisée : logo, randonneur, frise
css/style.css     mise en page
js/app.js         menus + affichage à partir des JSON
scraper/scrape.py récupère tout le contenu de l'ancien site
scraper/raw/      archive de l'ancien site (68 pages + thème), voir son _LISEZMOI.md
404.html          redirige les anciennes adresses .php vers les nouvelles
.github/workflows importe l'ancien site depuis GitHub (bouton « Run workflow »)
```

## 1. Mettre le dépôt sur GitHub
Crée un dépôt **public** vide sur github.com (par ex. `itinerance`), puis dans ce dossier :
```
git init -b main
git add .
git commit -m "Nouveau site itinerance.ch"
git remote add origin https://github.com/TON-COMPTE/itinerance.git
git push -u origin main
```
(Évite l'upload par glisser-déposer dans le navigateur : il oublie souvent les dossiers cachés
`.github` et `.nojekyll`.)

Puis **Settings → Pages → Build and deployment** : Source « Deploy from a branch », branche `main`,
dossier `/ (root)`. Après environ une minute, le site est en ligne sur `https://TON-COMPTE.github.io/itinerance/`.

## 2. Importer le contenu de l'ancien site (à faire AVANT de changer le DNS)
Onglet **Actions → Importer l'ancien site → Run workflow**. GitHub aspire toutes les pages et
tous les articles, télécharge les images dans `media/`, remplit `data/posts.json` et
`data/pages.json`, puis enregistre le tout dans le dépôt. Le site se met à jour tout seul.

Le rapport (`scraper/rapport.txt`) indique pour chaque page le conteneur de contenu détecté
(par ex. `td#contenu`). Si des menus ou la colonne de droite apparaissent encore, regarde un
fichier de `scraper/raw/`, trouve le bon conteneur et relance l'action en le mettant dans le
champ « Sélecteur CSS » (par ex. `div#contenu`).

Variante en local : `pip install requests beautifulsoup4 && python scraper/scrape.py`, puis
`git add . && git commit -m import && git push`.

Pour tester en local : `python -m http.server` puis http://localhost:8000. Ouvrir directement
`index.html` ne marche pas, car le navigateur bloque la lecture des JSON.

**L'ancien site est archivé dans `scraper/raw/`** : ses 68 pages en HTML brut et son thème,
pris le 20 octobre 2026. Après la bascule du DNS, l'original n'est plus joignable, et c'est
donc la seule référence pour vérifier un détail de l'ancien site. Voir `scraper/raw/_LISEZMOI.md`,
qui signale notamment un piège d'aplatissement des chemins de médias.

## 3. Ajouter un article
Ajouter un objet au début de `data/posts.json` :
```json
{
  "id": 58,
  "slug": "mon-nouvel-article",
  "title": "Titre",
  "date": "2026-10-01",
  "excerpt": "Deux lignes de résumé…",
  "cover": "media/photo.jpg",
  "html": "<p>Texte de l'article</p><p><img src=\"media/photo.jpg\" alt=\"\"></p>"
}
```
Le blog est trié par date. `cover` est optionnel (null = pas d'image sur la carte).

## 4. Ajouter ou changer des photos
Une rangée de photos encadrées se déclare sur **une seule ligne**, à l'endroit voulu dans le
`html` d'une page ou d'un article :
```html
<figure class="photo-rail" data-photos="media/une.jpg, media/deux.jpg"></figure>
```
Pour ajouter une photo : déposer le fichier dans `media/`, puis ajouter son nom à la liste.
Pour en retirer une, ou changer l'ordre : modifier la liste. Rien d'autre à écrire — le cadre,
le recadrage en 4:3, la mise en colonne sur mobile et la galerie (clic pour agrandir, flèches
← →, Échap, clic sur le fond) sont construits par `rails()` dans `js/app.js`.

Une page peut contenir plusieurs rangées, chacune à sa place : voir `hiver-week-end-trappeur`,
où chaque section a la sienne. Le clic ouvre la galerie de toutes les photos de la page.
Une photo absente de `media/` est simplement masquée, sans icône d'image cassée.

> L'ancien site entourait ses photos d'un cadre découpé en tranches d'images collées au pixel
> (`media/4_haut.jpg`, `media/4_img_h_g.jpg`, `media/2_mil_1.jpg`…). L'import les convertit
> maintenant en rangées (`drop_frame_slices()` dans `scraper/scrape.py`) et ne les télécharge
> plus ; les fichiers de tranches encore présents dans `media/` ne servent plus à rien.

## 5. L'identité reprise de l'ancien site
Le logo, le petit randonneur et la frise du bas viennent du site d'origine. Les GIF ont été
vectorisés, donc ils restent nets sur tous les écrans et se recolorent depuis la CSS :

```
images/logo-itinerance.svg   le mot « itinérance » dans sa police d'origine, le randonneur
                             à la place du i — utilisé comme titre dans l'en-tête
images/randonneur.svg        le randonneur seul — pastille de niveau de difficulté
images/frise.svg             la frise du bas, posée sur le pied de page
```

La frise est prolongée à plat de chaque côté dans son `viewBox`, pour que l'horizon atteigne
les bords de la page quelle que soit sa largeur ; sous 700 px, la CSS recadre sur le
randonneur plutôt que de tout réduire.

Les pastilles de niveau de l'ancien site (`media/puce.gif`, 11×19 px crénelés) sont déjà ce
même randonneur : `photos()` dans `js/app.js` leur substitue le tracé vectoriel à l'affichage.

Les coordonnées de l'encart « Me contacter », affiché à droite des pages Contact et
Qui suis-je, sont la constante `CONTACT` en tête de `js/app.js` : c'est là qu'il faut
changer le mail ou le numéro de téléphone (l'encart en fait des liens `mailto:` et `tel:`).

Les logos de certification de la page Qui suis-je étaient servis en pleine résolution par
l'ancien site (jusqu'à 1032 px de large) ; `photos()` les ramène à une vignette de 84 px de
haut que le texte longe. Tout logo ajouté de la même façon — une image au début d'un
paragraphe qui porte aussi du texte — sera traité pareil, sans rien changer.

Deux photos de l'article 53 sortaient de l'appareil sans avoir été réduites : 3648 × 2736,
3,9 Mo à elles deux, pour un affichage sur 760 px de large au plus. Elles sont ramenées à
1200 px (198 et 154 Ko) et leurs originaux sont conservés dans `media/originaux/`. Un nouvel
import les retéléchargerait en pleine résolution, il faudrait refaire la réduction.

## 6. Brancher le domaine www.itinerance.ch
Seulement une fois l'import terminé et vérifié : après le changement de DNS, l'ancien site
n'est plus accessible.

1. **Settings → Pages → Custom domain** : `www.itinerance.ch`, puis cocher « Enforce HTTPS »
   dès que GitHub le propose.
2. Chez le registrar du domaine (zone DNS) :
   - `www`  CNAME → `TON-COMPTE.github.io`
   - `@`    A     → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. La propagation prend de quelques minutes à quelques heures.

Les anciennes adresses (`/pages/posts/…-57.php`, `/pages/ete.php`…) sont redirigées
automatiquement vers les nouvelles par `404.html`. Les liens Google et les favoris continuent
donc de marcher.
