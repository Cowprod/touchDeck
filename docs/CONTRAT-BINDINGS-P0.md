# Contrat expérimental des sources et bindings — P0 serveur

**Statut : implémentation de qualification, non validée comme contrat V1 final.**

Références validées : D-008 à D-011, D-038 à D-044, D-073 à D-078 (voir `docs/DECISIONS.md`) et sections « Sources de données », « Import », « Minimalisme du device » de `docs/CONCEPTION.md`.

## Source persistante

Une source possède `id`, `name`, `origin` (`manual` ou `imported`) et `descriptor`, objet de sections `properties`, `actions`, `events` indexées par identifiant. Les métadonnées inconnues du descripteur restent intactes, sans interprétation métier. Une propriété doit déclarer un `type`.

- Source manuelle : éditable par `PUT /api/admin/config`.
- Source importée : lecture seule dans l'éditeur ; création et réimport via `PUT /api/admin/sources/import`, identité conservée, nouvelle `revision` de la configuration.
- Les références aux propriétés supprimées par réimport ne sont pas effacées ; leur résolution rend une chaîne vide. Le diagnostic explicite dans l'administration reste à produire.

## Binding texte (convention P0 à qualifier)

Un composant peut avoir un seul `sourceId`. Son champ `text` accepte une chaîne mêlant texte statique et placeholders littéraux `${identifiant}` qui sont résolus uniquement contre `descriptor.properties` de **cette** source. Propriété absente ou non encore alimentée : chaîne vide (D-038). Un composant sans `sourceId` reste entièrement statique.

## État d'exécution

- `PUT /api/sources/:sourceId/values` accepte un objet JSON des changements de propriétés, vérifie les types et bornes déclarés.
- Le serveur conserve les dernières valeurs **uniquement en RAM** (D-040), sans persistance.
- Le serveur transmet au client concerné `component_update` avec `pageId`, `pageRevision` et les textes résolus des seuls composants liés à la source. Le simulateur n'applique le différentiel que si page et révision concordent.
- Les définitions de pages ne sont pas réécrites lors de chaque push.

## Limitations connues

1. APIs d'administration et de push **non authentifiées** : usage exclusif POC sur réseau de développement isolé ; **ne pas exposer en production**.
2. Le schéma JSON définit une convention technique initiale ; validation formelle du contrat firmware et des bindings multi-propriétés/actions à faire.
3. Pas encore de connecteurs polling externes, d'édition graphique des actions, de diagnostic visible des références rompues, ni de transport d'action vers les sources. La file FIFO D-037 est développée et testée séparément, mais **pas branchée à une source réelle**.
4. Aucune validation ESP32 réelle ou navigateur E2E.
5. Les numéros de révision sont pour le moment globaux à la configuration, pas indépendants par page.
