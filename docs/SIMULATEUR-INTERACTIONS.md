# Interactions des simulateurs Web

## Correctif du chronomètre

Le chronomètre de la source intégrée « Horloge (Europe/Paris) » est piloté par le serveur : propriétés `elapsed` (HH:MM:SS) et `running`, actions `start`, `stop`, `reset`. Les valeurs sont diffusées par WebSocket. La page « Chronomètre » du groupe `demo` expose les trois boutons et le temps écoulé.

Le correctif du simulateur Web est présent dans `server/public/index.html` depuis le commit `94430c690143ff4388873768ceac2b357b6c7050` (successeur de `5fd8a31afbd4c79a5f3b7757da2d43add72ce524`). Il remplace la combinaison d'événements tactiles et de clics avec temporisation par des événements Pointer Events unifiés :

- `pointerdown` mémorise position, heure et `pointerId` ;
- `pointerup` distingue un swipe horizontal (navigation) d'un appui court et immobile (activation du composant sous le pointeur) ;
- `pointercancel` annule le geste ;
- `activate()` n'émet `interact` que pour un `Button` ou `Toggle` actif, avec WebSocket ouvert ;
- le composant est temporairement marqué `pending`, puis libéré sur `interaction_result` ou après un délai de sécurité de cinq secondes.

Ce traitement est commun au simulateur autonome et aux iframes `index.html?embedded=1` intégrées à l'administration. Les interactions restent propres à chaque client simulé ; l'action métier est exécutée côté serveur.

## Vérifications et limites

- Fonctionnement Start/Stop/Reset sur ESP32 : confirmé par l'utilisateur.
- Fonctionnement du chronomètre et de ses boutons dans le simulateur : confirmé par l'utilisateur après correction.
- Tests Node.js exécutés via devMcp le 13 octobre 2026 sur le commit `94430c690143ff4388873768ceac2b357b6c7050` : tâche `node.test` réussie (code de sortie 0).
- Cette vérification automatisée ne constitue pas un test navigateur instrumenté des événements Pointer Events dans une iframe. Conserver ce scénario dans les tests de non-régression manuels jusqu'à automatisation navigateur.

## Scénario de non-régression navigateur

1. Ouvrir l'administration, afficher un simulateur HTML du groupe `demo`, puis naviguer jusqu'à « Chronomètre ».
2. Cliquer sur Start : vérifier que `elapsed` progresse dans le simulateur et sur l'ESP connecté.
3. Cliquer sur Stop : vérifier que la valeur se fige.
4. Cliquer sur Start : vérifier la reprise, sans remise à zéro.
5. Cliquer sur Reset : vérifier `00:00:00`.
6. Vérifier que les swipes horizontaux changent de page sans déclencher de bouton, et qu'un clic simple n'entraîne pas de navigation.
7. Refaire les interactions sur écran tactile si disponible.
