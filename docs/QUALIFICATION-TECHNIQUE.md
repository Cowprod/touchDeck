# Qualification technique — touchDeck

Les points ci-dessous sont des inconnues techniques. Ils doivent être démontrés par POC sur le matériel réel avant décision structurelle.

## QT-001 — Matériel exact

Question : quelles sont exactement les caractéristiques du module AliExpress 1005008268789940 (ESP, écran, résolution, contrôleur tactile, mémoire, interfaces) ?

Preuves attendues : documentation fournisseur recoupée si possible, identification du matériel réel, logs/firmware de test.

## QT-002 — Gestes tactiles / swipe

Question : peut-on obtenir un swipe gauche/droite fiable sans dégrader les interactions avec les composants tactiles ?

À tester :
- tap ;
- swipe gauche/droite ;
- seuils de déplacement et durée ;
- annulation d'un clic lors d'un swipe ;
- comportement au départ d'un geste sur un contrôle ;
- répétabilité sur matériel réel.

## QT-003 — Identité ESP

Question : la MAC Wi-Fi choisie reste-t-elle stable et accessible de manière fiable dans tous les scénarios de connexion retenus ?

Résultat attendu : choix documenté de l'interface/MAC utilisée et preuve de stabilité sur redémarrages/reconnexions.

## QT-004 — Navigation pilotée serveur

Question : l'aller-retour client → serveur → nouvelle page est-il suffisamment rapide pour donner une navigation tactile satisfaisante ?

Mesures attendues : latence réelle sur réseau local, perception sur matériel réel, comportement en cas de délai/perte réseau.

Si nécessaire, un préchargement pourra être étudié sans changer le modèle fonctionnel autoritaire côté serveur.


## QT-005 — Distribution des variables et stratégie de rendu

**Caractère bloquant :** ce POC doit être réalisé sur le matériel réel avant de figer et développer le moteur de rendu.

Question : pour une mise à jour différentielle reçue par WebSocket, quelle stratégie est la plus adaptée sur l'ESP : distribuer la nouvelle valeur aux composants liés et ne rafraîchir que ceux-ci, ou redessiner la page complète ?

À tester :
- réception WebSocket d'une modification d'une variable ;
- distribution d'une même variable à plusieurs composants liés ;
- mise à jour différentielle minimale (`componentId` + propriété + valeur) ;
- renvoi de l'état complet du composant ;
- rafraîchissement ciblé des seuls composants concernés ;
- même scénario avec redessin complet de la page ;
- variable évoluant rapidement, avec plusieurs mises à jour par seconde et fréquences croissantes.

La comparaison doit mesurer à la fois le coût du transport/décodage et celui du rendu afin de ne pas retenir une granularité plus complexe si elle n'apporte aucun gain mesurable sur le matériel réel.

Mesures/preuves attendues :
- latence de réception et d'affichage ;
- fluidité/perception sur l'écran réel ;
- charge CPU ;
- consommation mémoire ;
- comportement à fréquence élevée et seuil d'apparition d'une dégradation ;
- complexité et robustesse comparées des deux implémentations.

La sémantique réseau reste indépendante du résultat : le serveur envoie des mises à jour différentielles de variables. Le POC détermine uniquement la stratégie de rendu locale du firmware.


## QT-006 — Ressources graphiques et icônes persistantes

Question : quel format et quel mécanisme de synchronisation offrent le meilleur compromis qualité / stockage / RAM / vitesse pour des icônes fonctionnelles provenant du serveur ?

Principe à qualifier :
- les icônes sont gérées côté serveur à partir de ressources vectorielles, notamment SVG Font Awesome ;
- le serveur ne prépare que les icônes réellement utilisées par le jeu de pages affecté au groupe ;
- le device stocke les ressources nécessaires en flash persistante ;
- les ressources devenues inutiles peuvent être supprimées ;
- le firmware conserve seulement les icônes système minimales nécessaires aux écrans locaux ;
- la couleur d'une icône fonctionnelle n'est pas intégrée dans sa ressource : elle est appliquée au rendu à partir de la propriété de couleur finale envoyée par le serveur.

À comparer sur le matériel réel :
- masque monochrome 1 bit ;
- masque alpha 8 bits ;
- taille flash occupée par un catalogue représentatif ;
- RAM nécessaire au décodage/rendu ;
- temps de transfert et de synchronisation ;
- vitesse d'affichage ;
- qualité visuelle / antialiasing ;
- comportement avec plusieurs tailles d'une même icône ;
- redimensionnement côté device d'une ressource unique vs plusieurs tailles pré-rasterisées côté serveur ;
- coût et simplicité d'un manifest de ressources permettant de détecter les fichiers manquants, modifiés ou devenus inutiles.

Preuves attendues :
- mesures brutes de tailles et temps ;
- captures/photos comparatives du rendu réel ;
- consommation mémoire ;
- inventaire des formats testés ;
- conclusion limitée au matériel réellement testé.

## Sources historiques

Des essais antérieurs réalisés avec Codex existent potentiellement. Ils doivent être récupérés et analysés avant de refaire inutilement les mêmes POC.


## QT-007 — Socket.IO sur ESP32-C3

**Objectif**  
Valider Socket.IO comme transport temps réel V1 sur le matériel cible réel.

**À tester**
- connexion initiale au serveur Node.js ;
- transport WebSocket uniquement, sans fallback polling ;
- reconnexion après coupure Wi-Fi et après redémarrage serveur ;
- émission/réception d'événements JSON ;
- ACK aller/retour ;
- stabilité sur plusieurs heures ;
- consommation RAM et flash ;
- impact sur la fluidité tactile et le rendu ;
- compatibilité avec l'identification du client et les rooms côté serveur.

**Critère de décision**  
Si la bibliothèque Socket.IO/Engine.IO choisie est stable et suffisamment légère sur l'ESP32-C3, Socket.IO est retenu. Sinon, retour à un WebSocket RFC standard via `ws`, sans modifier le modèle applicatif.


## QT-008 — Rendu graphique et tactile sur le module cible

**Objectif**  
Valider la bibliothèque graphique/tactile du firmware sur le matériel réel.

**Candidat principal**
- LovyanGFX.

**Solution de repli**
- TFT_eSPI pour l'affichage ;
- bibliothèque tactile dédiée si nécessaire.

**À tester**
- initialisation de l'écran GC9A01 ;
- compatibilité réelle avec le contrôleur tactile CST816 présent sur le module ;
- lecture fiable des pressions et gestes simples ;
- détection des swipes ;
- validation des quatre rotations 0/90/180/270° ;
- remappage correct des coordonnées tactiles selon la rotation ;
- cohérence du sens des swipes après rotation ;
- rendu d'une page complète 240x240 ;
- redraw partiel de composants ;
- fréquence d'actualisation répétée ;
- utilisation de sprites/buffers ;
- consommation RAM et flash ;
- fluidité tactile pendant les redraws ;
- stabilité sur fonctionnement prolongé.

**Critère de décision**  
LovyanGFX est retenu si l'écran, le tactile et les redraws sont stables et suffisamment légers sur le module réel. Sinon, bascule vers TFT_eSPI et une bibliothèque tactile séparée.


## Stratégie de POC matériel

Les qualifications matérielles et firmware sont regroupées dans un POC progressif unique. Le firmware de test est enrichi par étapes et sert de support commun aux QT concernées.

Ordre indicatif :
1. identification exacte du module, partitions et ressources ;
2. écran et tactile ;
3. gestes/swipes et fluidité ;
4. Wi-Fi, identité et mDNS ;
5. connexion temps réel et Socket.IO ;
6. rendu de pages et redraws différentiels ;
7. ressources graphiques, cache flash et icônes ;
8. tests de charge, stabilité, RAM et flash.

Une étape n'est considérée comme validée que si les mesures et preuves demandées par la QT correspondante sont conservées.


## QT-009 — Mise à jour OTA du firmware

**Objectif**  
Valider la mise à jour du firmware par Wi-Fi sur le module cible réel.

**À tester**
- lecture du partitionnement flash réel ;
- compatibilité avec les 4 Mo de flash annoncés ;
- taille maximale de firmware compatible avec une stratégie OTA ;
- téléchargement du nouveau firmware depuis le serveur touchDeck ;
- écriture dans la partition OTA ;
- redémarrage sur la nouvelle version ;
- conservation de la configuration locale nécessaire ;
- récupération après échec ou interruption de mise à jour ;
- possibilité de reflasher en USB en secours ;
- progression OTA fiable et coût du rafraîchissement d'un éventuel pourcentage ;
- conservation du Wi-Fi, du serveur choisi, de l'identité et du token après reboot ;
- interruption pendant téléchargement et pendant écriture ;
- retour sur un firmware amorçable après échec selon les mécanismes natifs ESP32 ;
- signalement de l'échec au serveur lorsque le firmware courant reste fonctionnel.

**Critère de décision**  
L'OTA est retenue en V1 si la taille réelle du firmware et le partitionnement permettent une mise à jour fiable sans compromettre les ressources nécessaires au fonctionnement normal.

## QT-010 — Découverte mDNS et machine d'état de connexion

**Objectif**  
Valider la découverte et la sélection du serveur sans reproduire la boucle observée dans l'ancien firmware.

**Prérequis**  
Analyser `esp32OldTest.zip` dès que son contenu est accessible afin d'identifier la cause ou, à défaut, les conditions de reproduction du problème historique.

**À tester**
- découverte d'une seule instance `_touchdeck._tcp` ;
- découverte de plusieurs instances et choix utilisateur ;
- publication et lecture du libellé et de l'identifiant stable d'instance ;
- mémorisation de l'identifiant choisi ;
- redémarrage du device et reconnexion à la même instance après changement éventuel d'IP ;
- indisponibilité du serveur mémorisé ;
- exactement trois tentatives espacées de 30 secondes ;
- retour au choix mDNS après le troisième échec ;
- absence de bascule silencieuse vers une autre instance ;
- disparition puis réapparition du serveur ;
- absence de boucle découverte → sélection → reconnexion ;
- perte du Wi-Fi sans ouverture automatique de l'AP de configuration ;
- configuration Wi-Fi par AP, y compris SSID masqué et refus de persister une configuration dont le test de connexion échoue ;
- fonctionnement DHCP uniquement.

**Preuves attendues**
- logs horodatés de la machine d'état ;
- vidéo ou observation reproductible des transitions d'écran ;
- redémarrages et coupures réseau/serveur reproduits sur matériel réel ;
- conclusion explicite sur le problème de boucle de l'ancien firmware.

## Analyse historique — esp32OldTest.zip

L'archive historique a été analysée avant le démarrage du nouveau POC. Elle constitue une source d'acquis techniques, mais son architecture applicative n'est pas reprise telle quelle.

### Acquis démontrés par l'ancien firmware

- le module a déjà été compilé et utilisé comme ESP32-C3 avec Arduino ESP32 ;
- l'écran rond GC9A01 a été piloté avec `Arduino_GFX_Library` ;
- le câblage historique utilisé était : SCLK 6, MOSI 7, DC 2, CS 10, rétroéclairage 3 ;
- le tactile a fonctionné avec `bb_captouch`, I²C SDA 4, SCL 5, INT 0, RST 1, adresse 0x15 ;
- le firmware a déjà utilisé Wi-Fi, mDNS, une liste tactile de serveurs et WebSocket ;
- une notion de révision de page existait déjà côté ancien backend/firmware ;
- le build conservé produit un firmware d'environ 1,3 Mo ;
- le partitionnement historique 4 Mo contient NVS, otadata, deux partitions OTA de 0x140000 chacune, une partition de données de 0x160000 et une partition coredump. Cela rend l'OTA plausible, mais QT-009 reste nécessaire avec le nouveau firmware.

Ces éléments réduisent les inconnues, mais doivent être revalidés dans le POC touchDeck avec la stack retenue.

### Échec historique important : sélection mDNS / reconnexion

Le code historique confirme une machine d'état de découverte et de connexion devenue complexe. Plusieurs mécanismes coexistent :
- cible courante `serverHost/serverPort` ;
- préférences `preferredServerName/preferredServerHost/preferredServerPort` ;
- scans mDNS périodiques ;
- reconnexion automatique du client WebSocket ;
- transitions explicites vers le mode discovery ;
- effacement conditionnel de la cible.

Le handler WebSocket historique renvoie notamment vers `enterDiscoveryMode()` après certaines déconnexions/erreurs survenues après réception d'une page, tandis que d'autres chemins conservent ou reconstruisent la cible. Cette architecture est une cause plausible de la boucle observée après sélection d'un serveur, sans permettre d'attribuer définitivement le défaut à une seule ligne hors reproduction matérielle.

### À ne pas refaire

- ne pas faire cohabiter plusieurs politiques concurrentes de reconnexion ;
- ne pas laisser la bibliothèque WebSocket reconnecter agressivement pendant que la machine d'état mDNS change elle-même de cible ;
- ne pas confondre découverte, serveur sélectionné et connexion active ;
- ne pas revenir immédiatement en découverte à la première déconnexion ;
- ne pas multiplier les identités d'un même serveur (nom, hostname, IP) comme références concurrentes ;
- ne pas intégrer les identifiants Wi-Fi dans le firmware ou dans le dépôt.

Le nouveau modèle doit rester conforme aux décisions V1 : identifiant stable d'instance, serveur choisi persisté, trois tentatives espacées de 30 secondes, puis retour explicite au choix mDNS.

### Inconnues restant à qualifier

- référence matérielle exacte du module et caractéristiques réelles de flash/RAM ;
- stabilité du câblage et du tactile avec les bibliothèques candidates du nouveau firmware ;
- Socket.IO sur ESP32-C3 ou nécessité du fallback WebSocket standard ;
- rotations et remappage tactile ;
- LittleFS pour le cache d'icônes ;
- comportement OTA réel du nouveau firmware et marge disponible ;
- reproduction puis disparition du problème historique de boucle mDNS avec la nouvelle machine d'état.

### Point de sécurité relevé dans l'archive

L'archive historique contient des identifiants Wi-Fi en clair dans le source du firmware. Ils ne doivent pas être repris dans touchDeck ni documentés. Les secrets du POC doivent rester hors dépôt et la configuration V1 doit passer par le mécanisme local prévu.

