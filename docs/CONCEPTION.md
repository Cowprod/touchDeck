# Conception — touchDeck

## Vision

touchDeck transforme un petit écran tactile ESP en terminal graphique générique piloté par un serveur. Le terminal n'embarque pas de logique métier propre : il affiche des pages et composants décrits par le serveur, remonte les interactions utilisateur et reçoit les changements en temps réel.

Une version Web doit offrir les mêmes capacités et reproduire la surface utile du module à sa résolution exacte afin de servir à la fois de client et de simulateur.

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

## Responsabilités du client ESP

À ce stade :
- identité matérielle ;
- configuration réseau ;
- adresse du serveur ;
- communication avec le serveur ;
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
- traitement des intentions de navigation ;
- diffusion temps réel des changements aux clients.

## Client Web

Le client Web utilise le même modèle fonctionnel que l'ESP. La surface simulée doit correspondre exactement à la résolution du module. Sur ordinateur, des commandes gauche/droite peuvent simuler les gestes de swipe.

## Matériel initial

Module acheté : https://fr.aliexpress.com/item/1005008268789940.html

Les caractéristiques exactes du module doivent être confirmées par documentation et/ou essais avant de devenir des hypothèses d'architecture.

## Hors décision à ce stade

Le protocole exact, le format de description des pages, la liste V1 des composants, le stockage serveur, la stack backend et les choix précis de bibliothèques embarquées ne sont pas encore figés.
