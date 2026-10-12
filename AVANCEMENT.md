# AVANCEMENT — touchDeck

Dernière mise à jour : 2026-10-12 (UTC)

## Sources de vérité
- Dépôt : Cowprod/touchDeck, branche principale `main`.
- Spécifications : `docs/CONCEPTION.md`.
- Décisions : `docs/DECISIONS.md` (D-001 à D-083, numérotation non continue).
- Questions : `docs/QUESTIONS-OUVERTES.md`.
- Qualification : `docs/QUALIFICATION-TECHNIQUE.md` (QT-001 à QT-010).
- Référentiels épinglés : `docs/REFERENTIELS.md`.
- Ce fichier suit les jalons et les preuves ; il ne remplace pas les décisions ni la conception.

## Jalons
| Jalon | Objet | Statut | Preuves / suite |
| --- | --- | --- | --- |
| TD-00 | État des lieux dépôt, MCP, matériel | PARTIAL | Documents lus, outils MCP interrogés ; arborescence exhaustive et dossier local non suivi à examiner |
| TD-01 | GitHub → devMcp → PlatformIO → ESP → série | NOT STARTED | Flash soumis à autorisation explicite |
| TD-02 | Identification du matériel, écran, tactile, mémoire | NOT STARTED | QT-001, QT-002, QT-003, QT-008 |
| TD-03 | Réseau, découverte et transport | NOT STARTED | QT-004, QT-007, QT-010 |
| TD-04 | Pages, navigation, rendu différentiel | NOT STARTED | QT-005 |
| TD-05 | Ressources graphiques et cache | NOT STARTED | QT-006 |
| TD-06 | OTA | NOT STARTED | QT-009 |
| TD-07 | Serveur, administration et intégration V1 | IN PROGRESS | API config persistante, navigation WS, autosave, thèmes résolus, panel multi-simulateurs, tests Node ; sources, enrolment et sécurisation admin à faire |

## Vérifications du 2026-10-12
- Connecteur devMcp : projet `touchdeck` accessible ; 8 actions déclarées.
- `git.head` : `adbb38ada65e6743db6d3cec55af84937897f446`.
- `git.status` : `## HEAD (no branch)` et `?? touchDeck/` ; dossier local **non suivi, contenu inconnu**.
- `platformio.version` : PlatformIO Core 6.2.0.
- `platformio.devices` : `/dev/ttyACM0`, VID/PID 303A:1001, série USB `10:00:3B:C9:0B:BC`.
- Audit devMcp : `workspace.sync` terminé avec succès le 2026-10-10 ; capture série du 2026-10-12 terminée avec succès.
- Aucun build, flash ni changement local lancé pendant cet état des lieux.

## Risques et inconnues
1. Le dossier local non suivi `touchDeck/` doit être inventorié sans suppression avant toute synchronisation.
2. Le matériel historique documenté est un ESP32-C3 avec écran rond 240×240, GC9A01 et tactile CST816 ; le module actuellement connecté et le format 480×320 évoqué au démarrage ne sont pas identifiés comme équivalents.
3. Le dépôt ne possède pas de `platformio.ini` à sa racine sur `main` ; chercher d'éventuels projets dans les sous-répertoires avant création.
4. La capacité devMcp de lister sans modification les fichiers du workspace n'est pas déclarée ; proposer une action générique bornée si nécessaire.
5. Aucun flash autorisé à ce stade.

## Prochaine étape
- Vérifier les références GitHub et l'arborescence restante.
- Inventorier sans altération le dossier local `touchDeck/`.
- Définir ensuite TD-01 et son firmware de diagnostic minimal sur la base du matériel confirmé.
- Conserver les logs de compilation, upload et série avec SHA exact et critères PASS/FAIL.

## Réalisation serveur et administration — 2026-10-12
- Audit détaillé des écarts dans `docs/AUDIT-CONFORMITE-2026-10-12.md`.
- Grille : serveur rejette les chevauchements ; éditeur évite les collisions et recherche une place libre.
- Rendu : résolution côté serveur des coordonnées en pixels, tokens de couleur, niveaux de police et états `active`/`disabled` (D-019/020/021/024).
- Navigation : une page courante rendue invisible reste à l'écran jusqu'à la prochaine navigation.
- Multi-simulateurs HTML intégrés à l'administration (D-026/027) : identités distinctes, affectation par groupe via API d'administration, navigation indépendante, ordre prioritaire des groupes en cours d'édition, mémorisation du panel en localStorage. **Affectation seulement runtime**, non persistée.
- Tests automatiques renforcés : résolution graphique, API de configuration et collisions, visibilité, affectation de simulateurs, vérification de syntaxe JS des pages.
- Mise en service : commit `7e2496ebf23df072481bf87951ca06d5e3ae516d` synchronisé, tests Node PASS ; service PM2 rechargé à l'étape précédente.
- Reste : intégration des sources, enrolment des clients physiques, sécurité de l'administration (API actuellement sans authentification : usage POC LAN exclusivement), types complémentaires, validation dans un vrai navigateur et sur ESP32.
