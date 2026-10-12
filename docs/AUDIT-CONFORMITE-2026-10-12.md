# Audit de conformité TouchDeck — 2026-10-12

## Périmètre et méthode
Comparaison du code `server/src/index.js` et `server/public/admin.html` avec `docs/CONCEPTION.md` et `docs/DECISIONS.md`. Les statuts ci-dessous décrivent le code réellement inspecté, pas une fonctionnalité supposée. Cet audit est partiel : il porte sur le serveur et l'administration Web, pas sur un firmware ESP32.

## Écarts constatés

| Priorité | Décisions / conception | Constat vérifié | Travail nécessaire |
|---|---|---|---|
| P0 | D-020, D-021, D-019, D-024 | Aucune édition des tokens sémantiques de fond/texte, de typographie ni des états `active`/`disabled`; l'aperçu utilise des couleurs fixes. | Définir schéma thème et résolution serveur, édition par page/composant, rendu HTML et contrat device. |
| P0 | Grille logique ; capacité sans chevauchement | L'éditeur permet le chevauchement au drag/resize ; le serveur ne contrôlait que les bornes. | Refuser les cellules occupées dans le serveur et prévenir les chevauchements dans l'éditeur. **Garde serveur ajoutée** dans ce chantier. |
| P0 | D-026, D-027 | L'administration n'intègre pas le panel multi-simulateurs. | Simulateurs multiples avec identités et affectations indépendantes, tri par groupe édité. |
| P0 | D-028 | L'API permettait de supprimer des groupes avec clients connectés et des jeux référencés. | Bloquer les suppressions référencées ; ajouter gestion complète des clients persistés. **Gardes initiales ajoutées** dans ce chantier, portée limitée aux clients runtime. |
| P0 | D-008, D-026 et modèle d'affectation | Le WebSocket `assign` est limité au groupe `demo` et déclenché côté client ; aucun éditeur d'affectation dans l'administration. | API d'administration et gestion des identités, authentification adaptée avant exposition réseau. |
| P1 | D-025 | Autosave sur PUT existe, mais sans gestion de version/conflit entre plusieurs éditions ; le `sync()` lit des champs de sélection courante pendant la sauvegarde. | Éliminer les écritures croisées, sérialiser et tester les modifications concurrentes. |
| P1 | D-030 et navigation | `broadcastConfig()` replace immédiatement sur une page visible lorsqu'une page courante devient invisible ; la conception exige de la conserver jusqu'à la prochaine navigation. | Distinguer page devenue invisible de page supprimée. |
| P1 | D-020/D-021 | Le serveur transmet les composants et leur grille sans résolution graphique, alors que le contrat prévoit des propriétés finales pour le device. | Implémenter résolution serveur et versionnement des pages. |
| P1 | Composants V1 | Éditeur limité à Label, Button, Toggle ; Icon, IconBar, Gauge/Progress, Slider non éditables ; IconBar non admis par validation API. | Schémas et éditeurs par type ; qualification Slider/swipe avant activation. |
| P1 | Sources et bindings | Absence d'éditeur de sources, de descripteurs, de bindings et de moteur de résolution. | Implémentation selon sections Sources et décisions correspondantes, sans inventer les contrats. |
| P1 | D-025 | Les tests Node existants ne constituent pas des tests d'interactions navigateur. | Tests automatisés de création, sélection, suppression, déplacement, resize et autosave. |
| P2 | Référentiel frontend | Administration charge Quartz et Font Awesome via CDN ; les routes locales existent mais dépendances/lockfile non alignés. | Résoudre `npm ci` et passer aux assets locaux. |

## Correctifs immédiats engagés
- Validation serveur de l'absence de chevauchement entre composants, cellule par cellule.
- Rejet de la suppression d'un groupe ayant des clients runtime affectés.
- Rejet de la suppression d'un jeu encore référencé dans la configuration proposée.

## Points à ne pas considérer comme terminés
- Les protections de suppression sont incomplètes tant que l'inventaire client n'est pas persistant.
- Le drag/resize côté éditeur ne prévient pas encore les collisions ; le serveur les rejette.
- Les décisions sur le thème et le rendu ne sont pas implémentées par ce seul audit.
- Aucun test physique ESP32 ou test navigateur n'est revendiqué.

## Ordre de reprise
1. Tests de non-régression du serveur et vérification des gardes.
2. Prévention visuelle des chevauchements et retour d'erreur d'autosave.
3. Modèle de thème conforme aux D-019/D-020/D-021/D-024, résolution serveur et contrôles d'édition.
4. Modèle clients/groupes et panel de simulateurs D-026/D-027/D-028.
5. Sources, bindings, composants restants et validation sur ESP32.
