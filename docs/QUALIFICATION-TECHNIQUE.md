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

## Sources historiques

Des essais antérieurs réalisés avec Codex existent potentiellement. Ils doivent être récupérés et analysés avant de refaire inutilement les mêmes POC.
