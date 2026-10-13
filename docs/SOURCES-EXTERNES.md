# Sources externes TouchDeck — contrat et exemple de supervision Ubuntu

**Statut : documentation du contrat actuellement implémenté (octobre 2026), exemple de conception ; aucun agent de supervision livré par ce document.**

## Objectif et architecture

Une machine Ubuntu collecte ses propres métriques (CPU, RAM, GPU AMD, températures et disques) et publie ses valeurs au serveur TouchDeck. Le serveur distribue les mises à jour aux clients ESP32 et simulateurs HTML via son WebSocket existant. L'ESP32 ne contacte jamais directement la machine surveillée.

`Ubuntu (agent collecteur) -> HTTP PUT TouchDeck -> source du catalogue -> bindings -> component_update WebSocket -> afficheurs`.

**Deux opérations distinctes :** (1) enregistrer le *descripteur* de la source dans le catalogue (configuration persistante), puis (2) publier les *valeurs* (état volatil en RAM). Publier des valeurs ne crée pas automatiquement une source. Un agent doit utiliser un ID stable, et ne doit pas réimporter son descripteur à chaque cycle.

## Contrat existant vérifié dans le code

- `server/src/sources.js` : source avec `id`, `name`, `origin` (`manual` ou `imported`) et `descriptor` ; sections optionnelles `properties`, `actions`, `events`. Chaque propriété possède un `type`. Identifiants : lettres, chiffres, `_`, `-`, 1 à 80 caractères.
- `PUT /api/admin/sources/import` : importe ou réimporte une source de type `imported`, dans la limite de 100 sources ; exige la `revision` de configuration courante. Une réimportation remplace le descripteur et efface les valeurs en RAM de cette source.
- `GET /api/admin/config` : renvoie notamment la `revision` et les `sources`. Le catalogue est sauvegardé dans la configuration du serveur.
- `PUT /api/sources/:sourceId/values` : publie un objet JSON de valeurs (sans enveloppe), uniquement pour une source existante. Le serveur vérifie les propriétés déclarées, leurs types et, pour les nombres, les limites `minimum`/`maximum`. Réponse de succès : HTTP 200 avec `ok:true` et `updated`.
- Un composant avec `sourceId` résout ses variables `${propertyId}` dans son texte ; les propriétés inconnues ou sans valeur sont rendues comme chaînes vides. Plusieurs composants peuvent réutiliser la même source.
- Les valeurs courantes sont conservées **uniquement en RAM** : après redémarrage serveur, la définition demeure mais les valeurs ne sont plus connues avant la prochaine publication.
- Les publications sont propagées aux composants liés à la source via `component_update`, sans réécrire les pages à chaque mesure.
- **Sécurité actuelle :** les routes d'import et de publication ne vérifient pas de jeton dans l'implémentation examinée. Les routes `/api/admin/config` ne doivent pas non plus être supposées protégées sans audit du code réellement déployé. N'utiliser ce contrat que sur un LAN isolé et de confiance. Ne jamais exposer le port 3000 à Internet. Authentification des agents, limitation de débit et contrôle des droits restent à concevoir avant un déploiement non isolé.

## Exemple de source : machine Ubuntu avec GPU AMD

L'ID de source est stable et indépendant du nom affiché : `host_rtx`. Les noms de propriétés sont volontairement plats (pas de points), pour respecter les bindings existants. Les unités sont dans le nom de la propriété ; les valeurs numériques restent numériques.

**Exemple de corps JSON à importer** avec `PUT /api/admin/sources/import` (remplacer `revision` par celle renvoyée par `GET /api/admin/config`) :

```json
{
  "revision": 1,
  "id": "host_rtx",
  "name": "RTX - Ubuntu",
  "descriptor": {
    "title": "Supervision materielle Ubuntu",
    "description": "Mesures CPU, RAM, GPU AMD et disques publiees par un agent local.",
    "properties": {
      "cpu_percent": {"type": "number", "readOnly": true, "minimum": 0, "maximum": 100, "unit": "%"},
      "ram_used_gb": {"type": "number", "readOnly": true, "minimum": 0, "unit": "GB"},
      "ram_total_gb": {"type": "number", "readOnly": true, "minimum": 0, "unit": "GB"},
      "gpu_percent": {"type": "number", "readOnly": true, "minimum": 0, "maximum": 100, "unit": "%"},
      "gpu_temp_c": {"type": "number", "readOnly": true, "unit": "C"},
      "gpu_vram_used_mb": {"type": "number", "readOnly": true, "minimum": 0, "unit": "MB"},
      "gpu_vram_total_mb": {"type": "number", "readOnly": true, "minimum": 0, "unit": "MB"},
      "cpu_temp_c": {"type": "number", "readOnly": true, "unit": "C"},
      "disk_percent": {"type": "number", "readOnly": true, "minimum": 0, "maximum": 100, "unit": "%"},
      "last_seen": {"type": "string", "readOnly": true}
    },
    "actions": {},
    "events": {}
  }
}
```

L'import est une opération administrative ponctuelle. Si l'API répond `409 config_conflict`, relire la révision avant de réessayer ; ne pas écraser aveuglément les modifications d'un autre administrateur. L'API ne découvre pas automatiquement les machines.

**Exemple de publication** : `PUT /api/sources/host_rtx/values`, `Content-Type: application/json` :

```json
{
  "cpu_percent": 12.4,
  "ram_used_gb": 6.2,
  "ram_total_gb": 16,
  "gpu_percent": 0,
  "gpu_temp_c": 30,
  "gpu_vram_used_mb": 24,
  "gpu_vram_total_mb": 8192,
  "last_seen": "2026-10-13T20:00:00Z"
}
```

Les nombres ci-dessus sont **illustratifs** et ne constituent pas une mesure réelle. Les champs facultatifs sans capteur fiable sont **omis**, et non remplacés par `0` (une mesure absente n'est pas une mesure nulle). Les mises à jour partielles sont autorisées : seules les clés transmises changent. Le serveur conserve les autres dernières valeurs.

**Exemples de bindings de labels :** sélectionner la source « RTX - Ubuntu », puis renseigner `CPU ${cpu_percent}%`, `GPU ${gpu_percent}%`, `GPU ${gpu_temp_c} C`, `VRAM ${gpu_vram_used_mb}/${gpu_vram_total_mb} MB`. Le formatage des nombres est réalisé côté agent si une précision fixe est souhaitée ; ne pas inventer de formatage dans les bindings actuels.

## Agent Linux : périmètre de l'implémentation future

- Python 3 avec `psutil` pour CPU, RAM, disques ; sous Linux AMD, interroger les fichiers exposés par `amdgpu` dans `/sys/class/drm/card*/device/` et `/sys/class/hwmon/`, en identifiant le bon périphérique plutôt qu'en supposant `card0`. Vérifier les fichiers disponibles et leurs unités sur la machine cible.
- Démarrage sous `systemd`, utilisateur non privilégié, configuration externe (ID source, URL serveur, intervalles). Ne pas exiger `sudo` pour les mesures accessibles sans privilèges.
- Collecte CPU/GPU toutes les ~2 s, RAM/températures toutes les ~5 s, disque toutes les ~30 s ; regrouper les mesures et publier uniquement les valeurs valides, idéalement modifiées. Les fréquences sont des **propositions**, pas un contrat serveur.
- Timeouts HTTP, reconnexion avec temporisation, logs bornés, aucune accumulation de mesures hors ligne, arrêt propre, pas de secret dans les logs. L'agent ne doit ni créer ni modifier des pages.
- Horodatages techniques UTC ISO 8601 (`last_seen`). Une absence de publication n'efface pas automatiquement la dernière valeur : la fraîcheur est déterminée à partir de `last_seen`.
- Les capteurs non disponibles ne doivent pas faire échouer la publication des autres métriques. Vérifier le support AMD (utilisation GPU, VRAM, température) sur la machine Ubuntu avant de promettre ces mesures.

## Critères de validation avant déploiement

1. Importer une fois `host_rtx` ; vérifier sa présence dans le catalogue et la persistance après redémarrage.
2. Lier au moins deux labels à des propriétés différentes ; vérifier la mise à jour sur simulateur HTML et ESP32.
3. Vérifier HTTP 404 sur une source absente, HTTP 400 sur propriété inconnue ou mauvais type, HTTP 409 sur une révision d'import périmée.
4. Couper l'agent : aucune valeur artificielle à zéro ; `last_seen` reste ancien. Redémarrer l'agent et vérifier la reprise.
5. Redémarrer le serveur : catalogue présent, valeurs absentes jusqu'à la prochaine publication ; reprise automatique de l'agent.
6. Faire fonctionner les affichages plusieurs heures sans disparition des textes ni augmentation anormale de la mémoire ESP32.
7. Ne pas déployer hors LAN de confiance tant que les API de publication et d'import ne sont pas authentifiées.

## Points à décider séparément

- Authentification des agents et gestion des droits par source.
- Enregistrement automatique d'une nouvelle source : **non implémenté**, non requis pour le premier POC ; l'import administratif explicite évite qu'une machine quelconque remplisse le catalogue.
- Affichage de l'état périmé : pour l'instant `last_seen` est une propriété ; aucune politique d'effacement/grisage automatique n'est imposée.
- Noms d'hôtes et unités standardisés pour un éventuel catalogue multi-machines.

**Fichiers de référence :** `server/src/index.js`, `server/src/sources.js`, `server/src/bindings.js`, `docs/CONTRAT-BINDINGS-P0.md`, `docs/SOURCE-HORLOGE.md`.
