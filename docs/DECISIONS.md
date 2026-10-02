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

