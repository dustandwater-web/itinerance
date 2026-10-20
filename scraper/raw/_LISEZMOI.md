# Archive de l'ancien www.itinerance.ch

Copie du site d'origine prise le **20 octobre 2026**, avant la bascule du DNS.
Une fois le domaine pointé sur le nouveau site, c'est la seule trace de l'ancien :
les adresses en `.php` ne renvoient plus l'original mais sont redirigées par
`404.html` vers les pages correspondantes du nouveau site.

## Contenu

```
*.html        les 68 pages telles que le serveur les renvoyait, sans retouche
post-57.html  les articles du blog, nommés par leur identifiant
_gabarit/     le thème : main.css, print.css, favicon, logos, frise
_journal.txt  les adresses visitées lors de l'import
```

Les images et les PDF ne sont pas ici : ils sont dans `media/`, partagé avec le
site actuel. Les 74 médias que ces pages appellent y sont tous présents.

## Lire l'archive

Les fichiers sont du HTML brut, à ouvrir tel quel dans un navigateur. La mise en
page sera cassée (le thème est dans `_gabarit/`, à un autre niveau) mais le
contenu et la structure sont intacts — c'est ce qui compte pour vérifier un
détail.

Le champ `source` de `data/pages.json` et `data/posts.json` donne l'adresse
d'origine de chaque page, ce qui permet de retrouver son fichier ici.

## Fidélité de la reprise

Vérifié depuis cette archive, page par page : **les 66 pages et articles du nouveau
site citent exactement les mêmes médias que l'original, dans le même ordre**. Aucune
photo perdue, aucune remplacée.

Ce dernier point méritait d'être contrôlé : l'ancien site range ses médias dans de
nombreux dossiers (`/media/`, `/media/hiver/`, `/blog/images/<date>/` pour les
galeries d'articles, `/images/logos/`, `/documents/`), et l'import les aplatit tous
dans `media/` au seul nom de fichier. Deux fichiers homonymes de dossiers différents
se seraient donc écrasés, en silence. Sur les **304 médias** cités par l'ancien site,
il n'y a **aucune collision de ce genre**.

Un seul élément n'est pas repris : `dock.swf`, une animation Flash de 550×200 sur la
page d'accueil (`_gabarit/dock.swf`). Flash est arrêté depuis fin 2020 et aucun
navigateur ne l'exécute plus ; il n'y a rien à en faire, le fichier est conservé ici
pour mémoire.

## Un piège à connaître

Dans ces pages, les médias sont rangés en sous-dossiers
(`/media/hiver/Islande2.JPG`, `/media/cadres/4_haut.jpg`). L'import aplatit ces
chemins au seul nom de fichier (`media/Islande2.JPG`). Deux fichiers de dossiers
différents, ou ne différant que par la casse, se retrouvent donc en concurrence.

C'est arrivé deux fois, et les deux sont corrigées :

- `Hiver.JPG` et `hiver.JPG` (deux photos distinctes du même dossier)
- `hiver/Islande2.JPG` et `hiver/islande2.JPG`

Dans les deux cas l'import n'en avait gardé qu'une, parce qu'il a tourné sur un
système insensible à la casse : le fichier semblait déjà téléchargé. Sur GitHub
Pages, qui distingue la casse, l'autre renvoyait une image cassée.

Si un nouvel import est lancé un jour, c'est le premier point à revérifier.
