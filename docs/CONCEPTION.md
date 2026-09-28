# Conception — touchDeck

## Vision

touchDeck transforme un petit écran tactile ESP en terminal graphique générique piloté par un serveur. Le terminal n'embarque pas de logique métier propre : il affiche des pages et composants décrits par le serveur, remonte les interactions utilisateur et reçoit les changements en temps réel.

Une version Web doit offrir les mêmes capacités et reproduire la surface utile du device afin de servir à la fois de client et de simulateur.

Le module 240×240 acheté initialement reste le **device de référence de la V1**, mais l'architecture ne doit pas être figée sur cette résolution ni sur ce matériel précis.

## Modèle fonctionnel retenu

- Le serveur est autoritaire sur la configuration fonctionnelle.
- Un client peut être un ESP ou un navigateur Web.
- Un groupe possède un jeu de pages et une page courante.
- Chaque client affecté appartient à un seul groupe.
- Plusieurs clients d'un groupe affichent donc la même page courante.
- Un client indépendant est simplement seul dans son propre groupe.
- Un client connu peut rester sans groupe : état « non affecté / à ranger ».
- Le client n'a pas besoin de connaître tout le jeu de pages. Il peut ne recevoir que la page à afficher.
- Un geste `next` / `previous` est une intention envoyée au serveur. Le serveur détermine la page résultante et la pousse aux clients concernés.
- Le serveur peut forcer l'affichage d'une page pour un groupe.
- Une modification d'affectation ou de configuration côté serveur ne nécessite ni reflash ni reconfiguration fonctionnelle de l'ESP.
- Un jeu de pages cible un profil de device précis.

## Device profile

Chaque type de device est décrit par un profil déclaratif en JSON.

Le profil décrit uniquement les capacités matérielles et de rendu nécessaires au moteur générique, par exemple :
- largeur et hauteur natives ;
- forme de l'écran : rectangulaire, ronde, etc. ;
- présence ou absence du tactile ;
- type/capacités tactiles utiles ;
- orientation ;
- nombre de colonnes et de lignes de la grille logique ;
- capacités graphiques pertinentes ;
- éventuellement les marges/safe areas nécessaires au rendu.

Le but n'est pas de déplacer la logique métier dans ce JSON mais de permettre au même moteur et au même serveur de cibler plusieurs écrans ESP.

Le device de référence initial est le module 240×240 tactile acheté pour le projet.

## Grille logique

Les pages sont composées sur une grille logique indépendante des pixels.

La grille n'est pas calculée automatiquement à partir de la résolution : elle est déclarée explicitement dans le profil JSON du device.

Base retenue pour le device 240×240 :
- grille : 8×8 ;
- unité logique : 30×30 px ;
- une icône standard peut occuper 1×1 ;
- une jauge horizontale peut occuper 1 cellule de hauteur ;
- les composants tactiles doivent respecter une taille minimale adaptée au doigt.

Chaque futur profil de device définit sa propre grille logique.

## Pages et profils

Un jeu de pages est conçu pour un profil de device donné. Il n'y a pas d'adaptation automatique d'un même jeu de pages vers une autre résolution ou une autre grille en V1.

Conséquences :
- une page 240×240 / 8×8 est conçue et validée pour ce format ;
- le client Web simule ce même profil pour garantir le rendu ;
- un autre matériel peut réutiliser les mêmes types de composants et le même protocole, mais avec son propre profil et son propre jeu de pages.

## Composants V1 candidats

- Label ;
- Button ;
- Toggle ;
- Icon ;
- IconBar ;
- Gauge / Progress ;
- Slider, sous réserve de qualification du conflit avec le swipe.

Les icônes standard doivent de préférence être embarquées dans le firmware et référencées par nom. Les images arbitraires restent à qualifier séparément.

## Responsabilités du client ESP

À ce stade :
- identité matérielle ;
- configuration réseau ;
- adresse du serveur ;
- communication avec le serveur ;
- chargement de son profil device ;
- moteur graphique générique ;
- gestion tactile et gestes ;
- affichage des composants/pages reçus.

Le client ne connaît pas la signification métier des informations affichées.

## Responsabilités du serveur

À ce stade :
- inventaire des clients ;
- clients non affectés ;
- groupes ;
- affectation client → groupe ;
- jeux de pages ;
- page courante de chaque groupe ;
- définition des pages et composants ;
- prise en compte du profil device ;
- traitement des intentions de navigation ;
- diffusion temps réel des changements aux clients.

## Client Web

Le client Web utilise le même modèle fonctionnel que l'ESP. Il doit pouvoir simuler le profil du device ciblé et afficher la surface à sa résolution logique/native afin d'éviter les écarts de rendu. Sur ordinateur, des commandes gauche/droite peuvent simuler les gestes de swipe.

## Matériel initial

Module acheté : https://fr.aliexpress.com/item/1005008268789940.html

Les caractéristiques exactes du module doivent être confirmées par documentation et/ou essais avant de devenir des hypothèses d'architecture.

## Hors décision à ce stade

Le protocole exact, le schéma JSON complet du profil device, le format de description des pages, le stockage serveur, la stack backend et les choix précis de bibliothèques embarquées ne sont pas encore figés.
