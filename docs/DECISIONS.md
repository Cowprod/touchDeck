# Décisions — touchDeck

## D-001
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Le serveur est autoritaire sur les jeux de pages, les règles de navigation et les commandes d'affichage. La page courante appartient toutefois à chaque client.  
Conséquences: Les clients naviguent indépendamment par défaut, tandis que le serveur peut imposer explicitement une page à un client ou à tout un groupe.

## D-002
Type: PRODUIT  
Statut: VALIDÉE  
Décision: La synchronisation repose sur des groupes. Chaque client affecté appartient à un seul groupe ; un client indépendant est placé seul dans un groupe dédié.  
Conséquences: Aucun mode spécial « indépendant » n'est nécessaire.

## D-003
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un groupe possède un jeu de pages et des paramètres collectifs, mais pas de page courante commune permanente. Chaque client possède sa propre page courante.  
Conséquences: Un swipe ne modifie que le client qui l'a émis. Une synchronisation de groupe résulte d'une commande serveur explicite.

## D-004
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un client peut être connu du serveur sans être affecté à un groupe ; il est alors « non affecté / à ranger ».  
Conséquences: L'enrôlement d'un nouveau terminal est dissocié de son affectation fonctionnelle.

## D-005
Type: TECHNIQUE  
Statut: VALIDÉE SOUS QUALIFICATION  
Décision: L'identité technique d'un ESP utilisera sa MAC Wi-Fi stable, sous réserve de validation sur le matériel réel.  
Conséquences: Le serveur peut conserver l'affectation de l'ESP sans configuration fonctionnelle locale supplémentaire.

## D-006
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Un client Web utilise un UUID persistant généré à sa première utilisation et stocké dans `localStorage`.  
Conséquences: Un autre navigateur/profil ou l'effacement du stockage local crée un nouveau client à affecter.

## D-007
Type: PRODUIT  
Statut: VALIDÉE  
Décision: L'identifiant technique d'un client est distinct de son libellé humain modifiable.  
Conséquences: Une MAC ou un UUID peut être renommé côté serveur sans modifier son identité.

## D-008
Type: PRODUIT  
Statut: VALIDÉE  
Décision: `next` et `previous` sont des intentions de navigation adressées au serveur pour le client émetteur ; le serveur détermine sa page résultante et la lui renvoie. Le serveur peut imposer directement une page à un client ou à tout un groupe.  
Conséquences: ESP et Web partagent la même sémantique de navigation sans rendre les swipes collectifs.

## D-009
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Le matériel d'affichage est décrit par un profil device déclaratif, prévu en JSON, contenant au minimum les caractéristiques utiles au rendu et aux interactions (résolution, forme d'écran, tactile, orientation et capacités pertinentes).  
Conséquences: Le moteur n'est pas figé sur le module 240×240 initial et pourra cibler d'autres écrans ESP sans introduire de logique métier spécifique au matériel.

## D-010
Type: UX  
Statut: VALIDÉE  
Décision: Le profil JSON du device déclare explicitement la grille logique de composition (`gridColumns`, `gridRows`). Elle n'est pas dérivée automatiquement de la résolution. Pour le device de référence 240×240, la grille est 8×8.  
Conséquences: Chaque format maîtrise sa granularité logique tout en utilisant le même moteur de rendu.

## D-011
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un jeu de pages est associé à un profil de device précis.  
Conséquences: Il n'y a pas d'adaptation automatique d'un même jeu de pages entre formats différents en V1. Les différents profils peuvent partager les mêmes composants et le même protocole, mais disposent de jeux de pages conçus pour leur propre résolution et leur propre grille.

## D-012
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un client non affecté affiche un écran système interne du firmware permettant son identification. Cet écran affiche au minimum le libellé humain du device et un identifiant technique court.  
Conséquences: L'identification physique d'un terminal non affecté reste possible même sans jeu de pages fonctionnel.

## D-013
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Le libellé humain d'un device est modifiable depuis l'administration et peut être utilisé sur les écrans système pour faciliter son identification.  
Conséquences: Le libellé est purement fonctionnel et n'altère jamais l'identifiant technique du client.

## D-014
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Les sources de données sont globales à l'instance touchDeck. Les composants de page utilisent des bindings vers les propriétés/actions/événements annoncés par ces sources.  
Conséquences: Les données sont découplées des devices, groupes et jeux de pages ; une même source peut alimenter plusieurs interfaces.

## D-015
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Une source peut mettre à jour touchDeck en push via une API exposée par le serveur ou être interrogée périodiquement par le serveur. Dans les deux cas, les mises à jour destinées aux devices sont diffusées par WebSocket.  
Conséquences: Les connecteurs peuvent s'adapter aux capacités des systèmes externes sans introduire de polling côté ESP/Web.

## D-016
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Les actions exposées par une source peuvent déclarer des paramètres typés et contraints (par exemple type, plage, valeurs autorisées).  
Conséquences: L’éditeur de page peut construire automatiquement les contrôles nécessaires et valider les paramètres avant envoi.

## D-017
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Le firmware/device ne connaît ni les sources de données, ni les bindings, ni la logique métier. Le serveur résout les bindings et transmet uniquement des pages/composants avec des valeurs prêtes à rendre.  
Conséquences: Le protocole device reste générique et indépendant des intégrations externes ; les interactions remontées par le device sont des événements génériques identifiés par composant/action.

## D-018
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Le serveur pré-résout autant que possible la présentation destinée au device. Le device ne réalise que le travail strictement nécessaire au rendu et aux interactions.  
Conséquences: Les coordonnées de grille, bindings, règles de source et autres abstractions restent côté serveur ; le protocole device peut recevoir des coordonnées déjà traduites en pixels et des valeurs prêtes à afficher si cela simplifie le firmware.

## D-019
Type: UX  
Statut: VALIDÉE POUR V1  
Décision: Le device embarque une police principale fixe pour le rendu des textes. Le serveur ne choisit pas librement une famille de police en V1.  
Conséquences: Le firmware reste simple et la cohérence de rendu ESP/Web est facilitée. Les tailles/styles nécessaires restent à qualifier sur le matériel réel.

## D-020
Type: UX  
Statut: VALIDÉE  
Décision: touchDeck définit côté serveur un système de thème avec tokens sémantiques inspirés de Bootstrap (par exemple primary, secondary, success, warning, danger, info, light, dark) ainsi que les règles typographiques.  
Conséquences: L'éditeur manipule des rôles visuels cohérents ; le serveur résout le thème en propriétés finales avant transmission au device, qui ne connaît pas la notion de thème.

## D-021
Type: UX  
Statut: VALIDÉE  
Décision: Les tokens sémantiques du thème peuvent s'appliquer au fond global de la page ainsi qu'au fond des composants compatibles (Label, Button, Toggle, etc.).  
Conséquences: L'éditeur peut exprimer des variantes visuelles cohérentes de type `bg-success`, `bg-warning`, `bg-danger`, etc., sans exposer cette sémantique au firmware.

## D-024
Type: UX  
Statut: VALIDÉE  
Décision: Les composants interactifs utilisent les modificateurs d'état `active` et `disabled`, dans une logique proche de Bootstrap. L'état normal est implicite et n'est pas modélisé par `enabled=true`.  
Conséquences: `disabled` devient le vocabulaire standard de l'éditeur et du contrat UI. L'état fonctionnel `pending` peut réutiliser visuellement la variante `disabled` sans être confondu avec lui côté serveur.

## D-025
Type: UX  
Statut: VALIDÉE  
Décision: L'éditeur fonctionne en autosave. Une modification de page est enregistrée puis propagée immédiatement aux témoins HTML et aux devices connectés des groupes concernés.  
Conséquences: Pour les interactions continues (drag, resize, saisie), l'envoi est déclenché en fin d'action ou après temporisation de saisie, pas à chaque mouvement ou frappe.

## D-026
Type: UX  
Statut: VALIDÉE  
Décision: L'éditeur intègre un panel de simulateurs HTML pouvant contenir plusieurs clients simultanés. Chaque simulateur possède une identité propre et peut être rattaché à un groupe via l'interface d'administration.  
Conséquences: Plusieurs groupes peuvent être observés en parallèle depuis l'éditeur, sans ouvrir nécessairement plusieurs fenêtres.

## D-027
Type: UX  
Statut: VALIDÉE  
Décision: Lors de l'édition d'un jeu de pages utilisé par un groupe, les simulateurs HTML rattachés à ce groupe sont remontés en tête du panel de simulateurs.  
Conséquences: L'éditeur privilégie visuellement les témoins les plus pertinents pour le contexte de travail courant.

## D-028
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Une ressource structurante ne peut pas être supprimée tant qu'elle est référencée : groupe avec clients attachés, jeu de pages affecté à un groupe, profil device utilisé par un jeu de pages, source utilisée par au moins un binding.  
Conséquences: L'administration doit empêcher la suppression et indiquer les dépendances existantes afin de permettre leur nettoyage préalable.


## D-029
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Hors commande collective explicite, la navigation est individuelle par client. Le mode sentinelle est une politique serveur appliquée aux clients du groupe ; chaque interaction remet le délai du client concerné à zéro.  
Conséquences: Les clients d'un même groupe peuvent afficher des pages différentes. Une commande « forcer page » permet de les resynchroniser explicitement.

## D-030
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: La visibilité d'une page est une propriété unique indépendante du mode sentinelle. Une page invisible reste éditable mais est ignorée par la navigation `next/previous` et par la sentinelle.  
Conséquences: La sentinelle suit exactement le même ensemble de pages visibles que le swipe ; aucun attribut spécifique `sentinel` n'est nécessaire sur les pages.

## D-031
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Il n'existe pas de `defaultPage`. Lorsqu'un client doit initialiser son affichage, il prend la première page visible dans l'ordre du jeu. Après redémarrage du serveur, les clients repartent également sur cette première page visible.  
Conséquences: La page courante n'a pas à être restaurée après redémarrage et l'initialisation reste déterministe.

## D-032
Type: PRODUIT  
Statut: VALIDÉE  
Décision: La réaffectation d'un client à un autre groupe ou le changement du jeu de pages d'un groupe replace les clients concernés sur la première page visible du nouveau jeu. Une simple réorganisation des pages conserve en revanche la page courante de chaque client.  
Conséquences: Le nouvel ordre ne prend effet qu'au prochain `next/previous` ou passage de sentinelle.

## D-033
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Si la page courante devient invisible, elle reste affichée jusqu'à la prochaine navigation, qui rejoint une page visible. Si la page courante est supprimée, le client bascule immédiatement sur la première page visible.  
Conséquences: Rendre une page invisible ne provoque pas de rupture brutale sur les écrans qui l'affichent déjà, contrairement à sa suppression.

## D-034
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un client sans page fonctionnelle affichable montre l'écran système local et bascule automatiquement sur la première page visible dès qu'une page devient disponible. Si le client possède déjà une page visible valide, l'apparition d'une nouvelle page visible ne modifie pas immédiatement son affichage.  
Conséquences: Ce mécanisme couvre notamment affectation tardive d'un jeu, activation d'une page, reconnexion et retour de contenu disponible.

## D-035
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: La page courante est référencée par UUID et non par index. Pour `next/previous`, le serveur retrouve cet UUID dans l'ordre courant et sélectionne la page visible précédente ou suivante.  
Conséquences: Les changements d'ordre ne rendent pas obsolète un index conservé côté client.

## D-036
Type: UX  
Statut: VALIDÉE POUR V1  
Décision: Pour la navigation, un client ne possède qu'une requête en vol et une seule intention pending ; toute nouvelle intention remplace la pending précédente.  
Conséquences: La navigation applique une sémantique « dernière intention gagnante » sans constituer une file de swipes.

## D-037
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Les actions de composants utilisent une file stricte par client et sont exécutées dans leur ordre de déclenchement. Une action en erreur est consommée, l'erreur est remontée/loguée côté serveur, puis la file continue avec l'action suivante. Aucune gestion avancée de débordement n'est prévue en V1.  
Conséquences: Les actions utilisateur ne sont pas perdues par une logique last-write-wins. L'état visuel du composant, notamment son aspect grisé selon le thème, suffit comme retour d'exécution en V1.

## D-038
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Un composant peut être entièrement statique ou être associé à une seule source. Lorsqu'une source est associée, tous les bindings dynamiques du composant proviennent exclusivement de cette source ; les propriétés du composant peuvent néanmoins mélanger contenu statique et références aux variables de cette source.  
Conséquences: Une propriété textuelle peut par exemple contenir du texte fixe et une substitution de variable. Une variable sans valeur est substituée par une valeur vide.

## D-039
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Le descripteur de la source est la référence qui définit les actions et leurs paramètres. Un paramètre configuré peut être une valeur fixe ou une variable de la même source. Une valeur vide est envoyée telle quelle ; touchDeck ne lui attribue aucune signification métier. Il n'y a pas de notion bloquante requis/optionnel en V1.  
Conséquences: La source reste responsable de l'interprétation métier et peut signaler une erreur, sans que touchDeck bloque préventivement l'action.

## D-040
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Les états d'exécution ne sont pas persistés : ni valeurs courantes des variables de sources, ni page courante des clients, ni files d'actions. Après redémarrage, les variables repartent sans valeur, les files sont vides et l'affichage repart selon D-031.  
Conséquences: Aucune action ancienne n'est rejouée automatiquement après un arrêt ou un crash.

## D-041
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: La configuration de l'instance touchDeck est persistante et unique. Son support physique (petit fichier JSON ou enregistrement/table de configuration en base) n'est pas imposé à ce stade.  
Conséquences: Le choix de stockage peut être arrêté lors de l'implémentation sans modifier le contrat fonctionnel.



## D-042
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: La réimportation du descripteur JSON d'une source remplace intégralement sa définition courante tout en conservant l'identité de la source.  
Conséquences: Les bindings existants restent valides uniquement si les identifiants de propriétés/actions/événements qu'ils référencent existent encore dans le nouveau descripteur ; sinon ils sont conservés mais signalés comme invalides jusqu'à correction.


## D-043
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Une source créée manuellement peut être éditée directement dans l'administration, notamment pour ajouter, modifier ou supprimer ses propriétés et actions. Une source issue d'un descripteur JSON expose ces éléments en lecture seule ; sa définition se modifie par réimport du descripteur.  
Conséquences: L'origine de la définition de la source détermine son mode d'édition et évite toute divergence entre une source importée et son descripteur de référence.


## D-044
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Les événements restent supportés dans le modèle et peuvent être exposés par un descripteur de source, mais aucun éditeur manuel spécifique d'événements n'est prévu en V1. Les sources de test/fake fourniront leur propre descripteur.  
Conséquences: La V1 conserve la compatibilité avec le modèle complet sans alourdir l'administration avec une fonction non exploitée directement.


## D-045
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: L'écran Configuration reste minimal en V1. Il permet de modifier uniquement le libellé de l'instance et son fuseau horaire d'affichage. Des informations techniques non modifiables, comme la version du serveur ou l'état WebSocket, peuvent être affichées si elles sont utiles à l'exploitation.  
Conséquences: Aucun autre réglage global n'est introduit sans besoin concret.


## D-046
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Node.js est le serveur principal unique de touchDeck. Il porte l'administration Web, le WebSocket, l'orchestration des clients et groupes, ainsi que l'intégration des sources push/polling.  
Conséquences: La V1 n'introduit pas de backend PHP séparé ni de service WebSocket distinct sans nécessité démontrée.


## D-047
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: La configuration persistante du serveur touchDeck est stockée en fichiers JSON. L'état runtime reste en mémoire et n'est pas persisté.  
Conséquences: Les données sont réparties en fichiers cohérents par domaine plutôt que dans un unique gros fichier. Les références utilisent des UUID. Les écritures sont sérialisées par le serveur Node.js et réalisées de manière atomique (écriture temporaire puis renommage) afin d'éviter les fichiers partiellement écrits. Un SGBD ne sera introduit que si un besoin concret apparaît.


## D-048
Type: TECHNIQUE  
Statut: CANDIDAT V1 - À VALIDER PAR POC  
Décision: Socket.IO est le candidat privilégié pour le transport temps réel de touchDeck, en transport WebSocket uniquement. Le choix définitif dépend d'une validation sur l'ESP32-C3 réel.  
Conséquences: Les clients Web de simulation profitent nativement de Socket.IO (reconnexion, événements, ACK, rooms). Le firmware devra utiliser un client Socket.IO/Engine.IO compatible ; si le coût mémoire, flash ou la stabilité sont insuffisants, la solution de repli est un WebSocket standard via `ws`.


## D-051
Type: TECHNIQUE  
Statut: CANDIDAT V1 - À VALIDER PAR POC  
Décision: LovyanGFX est le candidat principal pour le rendu graphique et l'intégration tactile du firmware V1. TFT_eSPI associé à une bibliothèque tactile dédiée constitue la solution de repli.  
Conséquences: Le choix définitif dépend d'un POC sur le module réel, notamment pour vérifier le GC9A01, le contrôleur tactile CST816 de la carte, la fluidité, la RAM/flash et les redraw partiels.


## D-052
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Les inconnues matérielles et firmware de la V1 sont validées au moyen d'un POC matériel unique et progressif, enrichi étape par étape, plutôt que par une succession de POC indépendants.  
Conséquences: Le même firmware de qualification doit permettre de valider progressivement le matériel exact, le tactile, le rendu, le réseau, Socket.IO, mDNS, le stockage flash, les performances et l'empreinte mémoire. Chaque étape conserve ses critères de preuve propres.


## D-055
Type: PRODUIT / TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: La luminosité est définie au niveau du groupe avec une surcharge optionnelle au niveau de chaque client. Une surcharge client absente signifie que le client hérite de la valeur du groupe. Le serveur calcule la luminosité effective et l'envoie au device.  
Conséquences: Une modification de la luminosité du groupe est propagée immédiatement à tous les clients qui héritent. Le firmware ne connaît pas la hiérarchie groupe/client ; il applique uniquement la valeur effective reçue.


## D-056
Type: PRODUIT / TECHNIQUE  
Statut: CANDIDAT V1 - À VALIDER PAR POC  
Décision: Une orientation écran par client (0/90/180/270°) est prévue comme capacité V1 candidate. Le serveur conserve des coordonnées logiques indépendantes de l'orientation ; le firmware applique la rotation à l'affichage et remappe les coordonnées tactiles.  
Conséquences: Le POC matériel doit valider les quatre rotations, y compris le sens des swipes après transformation des coordonnées tactiles.


## D-057
Type: TECHNIQUE / EXPLOITATION  
Statut: CANDIDAT V1 - À VALIDER PAR POC  
Décision: La V1 doit pouvoir mettre à jour le firmware des clients par Wi-Fi (OTA), tout en conservant le flash USB comme solution de secours. L'OTA produit sera déclenchée depuis le serveur/admin et n'est pas automatique.  
Conséquences: Le POC matériel doit valider le partitionnement flash réel du module, l'espace disponible avec 4 Mo de flash, l'écriture du nouveau firmware, le redémarrage sur la nouvelle version et le retour à un état fonctionnel après mise à jour.


## D-058
Type: PRODUIT / TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: La V1 n'utilise pas le deep sleep pour la veille. Les clients restent connectés au Wi-Fi et au serveur en permanence. Une mise en veille visuelle éventuelle repose uniquement sur le rétroéclairage, qui peut être abaissé jusqu'à 0 % si le matériel le permet.  
Conséquences: Le firmware évite la complexité de reconnexion Wi-Fi/WebSocket liée au sommeil profond. Un éventuel réveil par interaction tactile reste une logique locale simple de rétroéclairage.


## D-059
Type: ARCHITECTURE / PROTOCOLE
Statut: VALIDÉE POUR V1
Décision: Le serveur résout au maximum la présentation avant envoi au client. Le firmware reçoit des composants prêts à rendre : coordonnées finales, dimensions, texte déjà substitué, couleurs finales, taille de police, ressources graphiques et états nécessaires. Il ne connaît ni Bootstrap, ni les thèmes serveur, ni les sources, ni les bindings métier.
Conséquences: Le firmware reste générique et stable ; l'éditeur, les thèmes et la résolution des données peuvent évoluer côté serveur sans imposer un nouveau firmware, tant que le contrat de rendu reste compatible.

## D-060
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Le client annonce `firmwareVersion` et `protocolVersion` à la connexion. Le serveur connaît les versions de protocole supportées. Un client incompatible ne reçoit aucune page fonctionnelle et affiche un écran système local indiquant qu'une mise à jour est nécessaire.  
Conséquences: L'administration signale clairement l'incompatibilité et peut proposer l'OTA sans tenter d'exécuter un protocole non compatible.

## D-061
Type: SÉCURITÉ  
Statut: VALIDÉE POUR V1  
Décision: L'authentification d'un device reste simple : un token aléatoire persistant est associé à son `deviceId`. La MAC reste une identité matérielle mais ne constitue pas à elle seule une authentification.  
Conséquences: Pas de comptes utilisateurs, certificats clients ni PKI en V1.

## D-062
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: L'enrôlement d'un nouveau device est explicite. Un device inconnu apparaît dans l'administration comme non validé et ne reçoit pas de pages fonctionnelles. La validation manuelle par l'administrateur autorise son enrôlement et l'association d'un token persistant.  
Conséquences: La présence sur le LAN ne suffit pas à obtenir le contenu fonctionnel.

## D-063
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: La V1 utilise une action unique « Supprimer » pour retirer un client. La suppression invalide son token, supprime son affectation et son enregistrement côté serveur.  
Conséquences: Si le même matériel se reconnecte ensuite, il est traité comme un nouveau client non validé et doit être enrôlé à nouveau.

## D-064
Type: SÉCURITÉ  
Statut: VALIDÉE POUR V1  
Décision: Aucun PIN ni code d'appairage n'est ajouté à l'enrôlement V1. La validation manuelle dans l'administration constitue le contrôle d'enrôlement.  
Conséquences: Le processus reste volontairement simple pour un usage sur LAN.

## D-065
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Le serveur touchDeck est découvert par mDNS via `_touchdeck._tcp`. Chaque instance publie un libellé lisible et un identifiant d'instance stable. Le device mémorise l'identifiant stable de l'instance choisie et la retrouve via mDNS, indépendamment de son adresse IP. En présence de plusieurs instances, l'utilisateur choisit celle à utiliser.  
Conséquences: Le choix du serveur survit aux changements d'adresse IP et reste explicite lorsqu'il existe plusieurs instances.

## D-066
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Si le serveur mémorisé ne peut pas être joint, le device effectue trois tentatives espacées de 30 secondes. Après trois échecs, il revient à l'écran de découverte/choix mDNS. Il n'effectue pas de bascule silencieuse vers une autre instance.  
Conséquences: La reconnexion ne crée pas de boucle intensive. Le POC doit particulièrement vérifier l'absence de boucle découverte → sélection → reconnexion observée dans l'ancien firmware.

## D-067
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: En cas de perte du Wi-Fi, le device affiche un écran système local et tente périodiquement de se reconnecter. Il n'ouvre jamais automatiquement son point d'accès de configuration.  
Conséquences: Une panne Wi-Fi ne provoque pas l'apparition automatique d'AP touchDeck. Le mode configuration reste une action locale volontaire au démarrage.

## D-068
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: La configuration Wi-Fi initiale s'effectue via l'AP temporaire et sa page Web. Les SSID visibles sont proposés, avec saisie manuelle possible pour un SSID masqué. Une nouvelle configuration n'est enregistrée qu'après un test de connexion réussi.  
Conséquences: Une erreur de SSID ou de mot de passe ne remplace pas une configuration fonctionnelle par une configuration inutilisable.

## D-069
Type: PRODUIT  
Statut: VALIDÉE POUR V1  
Décision: Le mode AP de configuration Wi-Fi ne peut pas être déclenché à distance depuis l'administration en V1.  
Conséquences: L'accès au mode configuration réseau reste local, notamment par l'action volontaire prévue au démarrage.

## D-070
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Le device utilise DHCP uniquement. Aucune configuration d'adresse IP statique n'est prévue sur l'ESP en V1.  
Conséquences: Une adresse stable éventuelle est gérée par réservation DHCP côté infrastructure réseau ; la découverte du serveur reste basée sur mDNS.

## D-071
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Les écrans système locaux du firmware, y compris le démarrage, restent strictement fonctionnels et légers, sans splash animé ni habillage consommant inutilement des ressources.  
Conséquences: Les ressources du device sont réservées au fonctionnement utile.

## D-072
Type: TECHNIQUE  
Statut: VALIDÉE SOUS QUALIFICATION  
Décision: Pendant une OTA, le device affiche un écran système minimal. Un pourcentage n'est affiché que si la progression fournie par le mécanisme OTA est fiable et si son rendu ne pénalise pas cette phase critique.  
Conséquences: QT-009 doit déterminer si le pourcentage peut être affiché sans compromettre la fiabilité ; à défaut, un simple état « mise à jour » suffit.

## D-073
Type: TECHNIQUE  
Statut: VALIDÉE POUR V1  
Décision: Après une OTA réussie, le device redémarre et se reconnecte automatiquement en conservant sa configuration locale nécessaire, notamment Wi-Fi, serveur choisi, identité et token. Le serveur constate la nouvelle `firmwareVersion`.  
Conséquences: Aucune intervention utilisateur n'est requise après une mise à jour réussie.

## D-074
Type: TECHNIQUE  
Statut: VALIDÉE SOUS QUALIFICATION  
Décision: La V1 n'implémente pas de mécanisme applicatif sophistiqué de rollback OTA au-delà des mécanismes sûrs fournis par la plateforme ESP32. Si le firmware courant reste amorçable après un échec, le device repart dessus et signale l'échec au serveur.  
Conséquences: QT-009 doit tester les interruptions de téléchargement/écriture et vérifier les scénarios de récupération, avec flash USB comme secours.

