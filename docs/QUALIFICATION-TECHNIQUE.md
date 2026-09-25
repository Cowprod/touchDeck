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

## Sources historiques

Des essais antérieurs réalisés avec Codex existent potentiellement. Ils doivent être récupérés et analysés avant de refaire inutilement les mêmes POC.
