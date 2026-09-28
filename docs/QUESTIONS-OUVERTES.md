# Questions ouvertes — touchDeck

## Bloquantes avant développement

À compléter au fil de la phase 0. Aucun jalon d'implémentation ne sera lancé tant que ses questions bloquantes ne seront pas levées.

## Produit / UX

- Finaliser la liste minimale des composants graphiques V1 : Label, Button, Toggle, Icon, IconBar, Gauge/Progress sont candidats ; Slider reste sous qualification.
- Règles exactes de navigation : ordre des pages, extrémités, boucle éventuelle.
- Comportement attendu d'un client « non affecté ».
- Niveau d'identité visuelle exigé entre rendu ESP et rendu Web : mêmes coordonnées et comportement ou exigence pixel-perfect incluant polices/rasterisation.
- Comportement des interactions lorsqu'un composant tactile entre en concurrence avec un swipe.
- Règle exacte de dérivation de la grille pour des devices de résolutions et ratios différents.
- Définition d'une éventuelle safe area pour les écrans ronds ou autres formes non rectangulaires.

## Device profile

- Schéma JSON exact du profil device.
- Quelles capacités sont nécessaires en V1 au-delà de résolution, forme, tactile et orientation ?
- Le profil device est-il embarqué dans le firmware, fourni par le serveur, ou les deux avec un identifiant de modèle ?
- Comment un client Web choisit-il le profil device à simuler ?

## Serveur / exploitation

- Mode d'administration des clients, groupes, jeux de pages et pages.
- Mécanisme de configuration initiale de l'adresse serveur sur l'ESP.
- Authentification, sécurité réseau et éventuel TLS.
- Comportement en cas de perte du serveur ou du réseau.

## À qualifier techniquement plutôt qu'à arbitrer théoriquement

Voir `QUALIFICATION-TECHNIQUE.md` pour le swipe, la stabilité de la MAC, la latence de navigation et les capacités exactes du module.
