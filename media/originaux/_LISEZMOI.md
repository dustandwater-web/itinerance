# Images d'origine, pleine résolution

Ce dossier garde la version non réduite des photos que le site sert allégées.
Rien ici n'est affiché par le site : ce sont des copies de sauvegarde.

| fichier | ici | servi par le site |
|---|---|---|
| `Islande1.JPG` | 3648 × 2736, 2397 Ko | 1200 × 900, 198 Ko |
| `Islande2.JPG` | 3648 × 2736, 1520 Ko | 1200 × 900, 154 Ko |

Ces deux photos sont sur l'article 53, « Islande du 3 au 11 avril 2015 ». L'ancien
site les servait telles qu'elles sortaient de l'appareil (Canon PowerShot G11), soit
3,9 Mo à elles deux, pour un affichage sur 760 px de large au plus. Elles sont
désormais réduites à 1200 px — le double de la largeur d'affichage, pour rester
nettes sur les écrans à haute densité — en JPEG qualité 85. À la taille réelle
d'affichage, la différence ne se voit pas.

Les fichiers de ce dossier sont identiques à l'octet près à ceux que servait
l'ancien site, empreintes MD5 vérifiées :

```
Islande1.JPG  b179ec4d2cd3…
Islande2.JPG  798226a8f99c…
```

**Attention** : un nouvel import (`scraper/scrape.py`) retéléchargerait ces photos en
pleine résolution dans `media/`, annulant la réduction. Il faudrait la refaire.
