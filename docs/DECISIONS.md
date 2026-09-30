# Décisions — touchDeck

## D-001
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Le serveur est autoritaire sur le jeu de pages et la page à afficher. Un client n'a pas à connaître durablement toutes les pages.  
Conséquences: La navigation peut être résolue côté serveur et une modification de page côté serveur ne nécessite pas de reflash.

## D-002
Type: PRODUIT  
Statut: VALIDÉE  
Décision: La synchronisation repose sur des groupes. Chaque client affecté appartient à un seul groupe ; un client indépendant est placé seul dans un groupe dédié.  
Conséquences: Aucun mode spécial « indépendant » n'est nécessaire.

## D-003
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un groupe possède un jeu de pages et une page courante.  
Conséquences: Tous les clients du groupe partagent la même navigation et reçoivent la page courante du groupe.

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
Décision: `next` et `previous` sont des intentions de navigation adressées au serveur ; le serveur détermine la page résultante et la diffuse au groupe. Le serveur peut également imposer directement une page.  
Conséquences: ESP et Web peuvent partager la même sémantique de navigation.

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
