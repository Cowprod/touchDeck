# Serveur touchDeck — premier socle

Prototype serveur et simulateur Web, indépendant du matériel ESP.

## Prérequis
Node.js 22 ou supérieur et npm. Les dépendances sont déclarées dans `server/package.json`.

## Démarrage (depuis la VM)
```sh
cd /srv/devmcp-workspaces/touchDeck/server
npm install
npm test
npm start
```

Le serveur écoute par défaut sur `127.0.0.1:3000`. Ouvrir `http://127.0.0.1:3000/` depuis la VM ou utiliser un tunnel SSH depuis le poste distant :

```sh
ssh -L 3000:127.0.0.1:3000 utilisateur@touchdeck
```

Puis ouvrir `http://127.0.0.1:3000/` sur le poste distant.

**Important :** la synchronisation du workspace devMcp n'a pas encore été lancée : le dossier local non suivi `touchDeck/` doit être examiné auparavant. Ces commandes sont à exécuter uniquement une fois les fichiers `main` effectivement présents dans le bon répertoire.

## Endpoints
- `GET /` : simulateur Web
- `GET /api/health` : état du serveur
- `GET /api/bootstrap` : profils, groupes et jeux de pages de démonstration
- `WS /ws` : `hello`, `assign` (uniquement en mode local), `navigate` (`next` / `previous`)

## Limites de cette première itération
- Données en mémoire, sans persistance.
- Un profil et un groupe de démonstration, deux pages avec labels.
- Aucun contrôle d'accès d'administration ; ne pas exposer le serveur sur Internet ou le LAN.
- Pas encore d'éditeur, de gestion des sources, de rendu différentiel ni de support matériel.
- Transport WebSocket standard provisoire ; choix Socket.IO vs ws pour l'ESP toujours soumis à QT-007.
- Les tests sont versionnés, mais n'ont pas encore été exécutés sur la VM.
