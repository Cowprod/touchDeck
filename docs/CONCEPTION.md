# Conception — touchDeck

## Vision

touchDeck transforme un petit écran tactile ESP en terminal graphique générique piloté par un serveur. Le terminal n'embarque pas de logique métier propre : il affiche des pages et composants décrits par le serveur, remonte les interactions utilisateur et reçoit les changements en temps réel.

Une version Web doit offrir les mêmes capacités et reproduire la surface utile du device afin de servir à la fois de client et de simulateur.

Le module 240×240 acheté initialement reste le **device de référence de la V1**, mais l'architecture ne doit pas être figée sur cette résolution ni sur ce matériel précis.

## Modèle fonctionnel retenu

- Le serveur est autoritaire sur la configuration fonctionnelle.
- Un client peut être un ESP ou un navigateur Web.
- Un groupe possède un jeu de pages et des paramètres collectifs, mais pas de page courante commune permanente.
- Chaque client affecté appartient à un seul groupe et possède sa propre page courante.
- Plusieurs clients d'un même groupe peuvent donc afficher des pages différentes.
- Un client indépendant est simplement seul dans son propre groupe.
- Un client connu peut rester sans groupe : état « non affecté / à ranger ».
- Le client n'a pas besoin de connaître tout le jeu de pages. Il peut ne recevoir que la page à afficher.
- Un geste `next` / `previous` est une intention envoyée au serveur pour le client émetteur. Le serveur détermine sa page résultante et la lui pousse.
- Le serveur peut forcer l'affichage d'une page pour un client précis ou pour tous les clients d'un groupe.
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

## Sources de données

Les sources sont globales à l'instance touchDeck et indépendantes des devices, groupes et jeux de pages. Les composants d'une page consomment des données via des bindings vers les propriétés exposées par ces sources.

Chaque source expose un descripteur touchDeck inspiré de W3C Web of Things, sans imposer la compatibilité WoT complète en V1. Le descripteur annonce au minimum ses propriétés, actions et événements ainsi que les métadonnées nécessaires à l'éditeur (type, unité, plage, caractère modifiable, etc.).

Une source peut alimenter touchDeck selon deux modes :
- **push** : la source appelle une API exposée par le serveur touchDeck lorsqu'une valeur change ;
- **polling** : le serveur touchDeck interroge périodiquement la source lorsque celle-ci ne sait pas pousser ses changements.

Quel que soit le mode d'acquisition, le serveur maintient l'état courant des données puis pousse par WebSocket les changements uniquement aux clients concernés. Il n'y a pas de polling entre les devices et le serveur touchDeck.

Le support direct de systèmes tels que Home Assistant est envisagé ultérieurement sous forme d'intégration/adaptateur, sans contraindre le modèle V1.

## Import et mise à jour des descripteurs de source

### Mode d'édition selon l'origine

- Une source créée manuellement peut être modifiée directement dans l'administration, y compris ses propriétés et actions.
- Une source importée depuis un descripteur JSON présente sa définition en lecture seule.
- Pour modifier une source importée, on réimporte un nouveau descripteur ; il remplace la définition précédente selon la règle annule/remplace.


Une source peut être définie manuellement ou importée depuis un descripteur JSON.

La réimportation d'un descripteur sur une source existante suit une logique annule/remplace :
- l'identité de la source est conservée ;
- sa définition est remplacée par le nouveau descripteur ;
- les bindings continuent de fonctionner si leurs identifiants existent toujours ;
- les références devenues absentes ne sont pas supprimées silencieusement : elles sont signalées comme invalides jusqu'à correction.

### Événements en V1

Les événements peuvent être déclarés dans un descripteur de source et restent connus du modèle touchDeck. En V1, ils ne disposent pas d'un éditeur manuel dédié et aucun moteur de règles n'est construit autour d'eux.

Les sources fake utilisées pour les essais fourniront elles-mêmes leur descripteur, afin de tester le chemin réel d'import et d'exploitation du modèle.

## Actions et acquittements

Les actions sont toujours routées par le serveur touchDeck vers les sources.

- Un Button entre en état `pending` jusqu’à acquittement du serveur touchDeck au minimum, puis redevient actionnable.
- Un Toggle utilise un modèle conservateur : il reste en `pending` jusqu’à confirmation de la nouvelle valeur par la source. En cas de timeout, il revient à la dernière valeur connue.
- Timeout d’action par défaut : 5 secondes.
- Une action peut annoncer des paramètres typés et contraints dans le descripteur de source afin que l’éditeur puisse proposer et valider les valeurs compatibles.

## Principe de minimalisme du device

Le serveur pré-résout autant que possible ce qui peut l'être avant transmission :
- bindings vers les sources ;
- valeurs à afficher ;
- actions à associer aux interactions ;
- conversion éventuelle de la grille logique vers les coordonnées physiques du profil device ;
- autres décisions de présentation qui n'ont pas besoin d'être recalculées localement.

Le device conserve uniquement ce qui est nécessaire pour :
- afficher les composants ;
- recevoir les mises à jour ;
- gérer le tactile et les gestes ;
- remonter des événements génériques ;
- maintenir les écrans système locaux.

L'éditeur et le modèle produit restent basés sur la grille logique, même si le protocole final serveur → device transporte des coordonnées physiques déjà calculées.

## Typographie et thème

Pour la V1, le device embarque une police principale fixe. L'objectif est d'éviter la multiplication des fontes et la logique typographique côté firmware.

Le serveur gère un thème de présentation avec :
- la typographie de référence ;
- des tailles/niveaux de texte définis côté serveur ;
- des couleurs sémantiques inspirées de Bootstrap : `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `light`, `dark` ;
- éventuellement d'autres tokens visuels si un besoin concret apparaît.

L'éditeur travaille avec ces tokens sémantiques. Ils peuvent s'appliquer au fond global d'une page ainsi qu'au fond et aux autres propriétés visuelles des composants qui le permettent (Label, Button, Toggle, etc.). Le serveur les résout en propriétés finales compatibles avec le profil device avant envoi. Le firmware ne connaît pas les thèmes et n'effectue pas de résolution de tokens.

## Contrat serveur → device

Le device est volontairement sans intelligence métier. Il ne connaît ni les sources, ni les bindings, ni les variables externes.

Le serveur :
- résout les bindings ;
- calcule les valeurs à afficher ;
- transmet une définition de page déjà exploitable par le renderer ;
- pousse ensuite les changements de valeurs nécessaires.

Le device :
- rend les composants reçus ;
- maintient seulement l'état local nécessaire au rendu et aux interactions ;
- remonte des événements génériques identifiés par composant/action ;
- ne contacte jamais directement une source et ne tente jamais d'interpréter la signification métier d'une valeur.

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

### Écrans système

Le firmware doit disposer d'écrans système internes, indépendants des pages fonctionnelles servies par le serveur. Ils couvrent notamment le démarrage, la connexion réseau/serveur, l'état non affecté et les erreurs de connexion.

Pour l'état non affecté, l'écran affiche au minimum le libellé humain du device et un identifiant technique court permettant de le retrouver facilement dans l'administration. Le libellé humain est modifiable depuis l'administration et n'altère jamais l'identité technique du client.

## Intégrité des dépendances

Les suppressions structurantes sont bloquées tant qu'une dépendance existe :
- groupe avec au moins un client affecté ;
- jeu de pages utilisé par au moins un groupe ;
- profil device utilisé par au moins un jeu de pages ;
- source référencée par au moins un binding.

L'administration doit indiquer les usages bloquants pour permettre leur réaffectation ou suppression préalable.

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
- traitement des intentions de navigation individuelles ;
- commandes collectives permettant notamment de forcer une page sur un groupe ;
- mode sentinelle piloté côté serveur, avec temporisation par client ;
- diffusion temps réel des changements aux clients.

## Éditeur et propagation en direct

L'éditeur utilise l'autosave. Toute modification enregistrée d'une page actuellement utilisée est propagée immédiatement :
- aux témoins HTML affichant cette page ;
- aux devices connectés appartenant aux groupes utilisant ce jeu de pages.

Pour éviter un trafic inutile, les opérations continues sont consolidées : envoi à la fin d'un drag/resize et après temporisation pour une saisie texte.

## Panel de simulateurs HTML

L'éditeur intègre un panel de simulateurs HTML persistants permettant d'observer plusieurs clients en parallèle.

Chaque simulateur :
- possède une identité de client distincte ;
- est un vrai client temps réel du protocole touchDeck ;
- peut être rattaché à un groupe ;
- affiche exactement la résolution et le profil device associés au jeu de pages du groupe ;
- suit les changements de page, le mode sentinelle et les mises à jour dynamiques comme un device normal.

Le panel peut contenir plusieurs simulateurs simultanément. Lorsqu'un jeu de pages ou un groupe est en cours d'édition, les simulateurs associés aux groupes concernés sont remontés en tête de liste afin de faciliter la validation visuelle.

## Client Web

Le client Web utilise le même modèle fonctionnel que l'ESP. Il doit pouvoir simuler le profil du device ciblé et afficher la surface à sa résolution logique/native afin d'éviter les écarts de rendu. Sur ordinateur, des commandes gauche/droite peuvent simuler les gestes de swipe.

## Matériel initial

Module acheté : https://fr.aliexpress.com/item/1005008268789940.html

Les caractéristiques exactes du module doivent être confirmées par documentation et/ou essais avant de devenir des hypothèses d'architecture.

## Hors décision à ce stade

Le protocole exact, le schéma JSON complet du profil device, le format de description des pages, le stockage serveur, la stack backend et les choix précis de bibliothèques embarquées ne sont pas encore figés.


## Configuration de l'instance

L'administration V1 comporte une rubrique Configuration volontairement minimale :
- libellé de l'instance ;
- fuseau horaire utilisé pour l'affichage.

Les horodatages techniques restent stockés en UTC. Des informations purement diagnostiques, telles que la version du serveur ou l'état du service WebSocket, peuvent être affichées sans devenir des paramètres configurables.
