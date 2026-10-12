# TouchDeck — serveur et clients Web

Serveur Node.js 22, HTTP et WebSocket standard (qualification ESP à venir).

## Accès

- Simulateur : `http://192.168.194.189:3000/`
- Administration : `http://192.168.194.189:3000/admin`
- Santé : `GET /api/health`
- Configuration de démonstration : `GET /api/bootstrap`

Le serveur écoute sur toutes les interfaces IPv4 pour permettre aux clients du LAN de se connecter. Restreindre le port 3000 au réseau de confiance : **pas d'exposition Internet**.

## Administration

`GET/PUT /api/admin/config` requiert l'en-tête `X-TouchDeck-Admin-Token` et un jeton non vide fourni par la variable d'environnement `TOUCHDECK_ADMIN_TOKEN` au processus Node/PM2.

**Sans jeton configuré côté serveur, toute écriture et toute lecture de cette API sont refusées (401).** Le jeton ne doit jamais être commité dans Git ni exposé dans les logs.

L'interface `/admin` permet de saisir ce jeton dans l'onglet, charger la configuration, gérer les groupes, jeux de pages et pages, modifier les composants au format JSON, prévisualiser et enregistrer. C'est une première interface fonctionnelle, pas encore l'éditeur visuel final.

Les modifications sont validées avant sauvegarde et propagées par WebSocket. Les configurations sont persistées atomiquement dans `server/data/config.json` par défaut ; ce répertoire doit être sauvegardé et rester hors Git.

## Développement

```sh
cd server
npm ci
npm test
npm start
```

Sur la VM, utiliser les actions bornées devMcp (`workspace.sync`, `node.test`, `service.restart`, `service.health`, `service.logs`). PM2 est géré par devMcp.

## Limites

- Enrôlement et authentification des clients matériels non implémentés.
- Affectation de démonstration `demo` autorisée au simulateur ; l'affectation générale nécessite une future action admin.
- Les états d'exécution (page courante, présence clients) ne sont pas persistés.
- Édition des composants encore en JSON, sans drag-and-drop.
- Sources, actions, tokens sémantiques, rendu différentiel et firmware ESP à développer.
- Le jeton d'administration circule en HTTP sur le LAN de développement : HTTPS ou un tunnel sécurisé seront nécessaires avant tout usage sur réseau non fiable.
