# Source de test Horloge

La source `clock` est automatiquement créée au démarrage du serveur touchDeck, avec un descripteur importé et protégé en lecture seule. Elle fournit six propriétés **chaînes de caractères** actualisées chaque seconde, avec zéros initiaux :

| Propriété | Exemple | Signification |
| --- | --- | --- |
| `dd` | `09` | Jour du mois |
| `mm` | `12` | Mois |
| `yyyy` | `2026` | Année |
| `hh` | `23` | Heure (24 h) |
| `ii` | `04` | Minutes |
| `ss` | `05` | Secondes |

Le fuseau de présentation est **Europe/Paris**, avec changement d'heure automatique. Les horodatages techniques de touchDeck restent UTC. Le réglage du fuseau par instance, prévu dans la conception, n'est pas encore implémenté.

## Tester plusieurs composants

Dans l'administration, sur une page, ajouter un ou plusieurs labels puis sélectionner la source **Horloge (Europe/Paris)** pour chaque composant. Exemple de texte : `${hh}:${ii}:${ss}`, ou `${dd}/${mm}/${yyyy}`. Plusieurs labels peuvent utiliser simultanément les mêmes variables ou des combinaisons différentes.

L'horloge est une **source fake interne**, pas un deuxième backend. Le processus Node principal publie ses valeurs par le même chemin que les autres sources, et les clients reçoivent des messages `component_update` par WebSocket sans polling. Cela respecte la décision d'architecture du serveur Node unique en V1.

La source est toujours présente après redémarrage, mais ses **valeurs courantes ne sont pas persistées**. Le minuteur est aligné sur les secondes, et arrêté proprement avec le serveur. Aucun flash ESP32 n'est requis pour tester les simulateurs.

**Limitation de qualification :** tests unitaires et intégration WebSocket ; pas encore de vérification visuelle dans un navigateur réel.
