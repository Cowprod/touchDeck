# TD-01 — ESP32 connecté, diagnostic préparé

## État observé
- devMcp détecte un périphérique `/dev/ttyACM0` : USB JTAG/serial debug unit, VID:PID `303A:1001`.
- Capture passive à 115200 bauds pendant 5 secondes : aucune sortie.
- Documentation historique : ancien prototype **ESP32-C3**, écran rond **GC9A01 240×240**, tactile **CST816**. Le format **480×320** également mentionné n'est pas confirmé sur le périphérique connecté.
- La présence d'un port série ne suffit **pas** à confirmer la référence du module, les broches de l'écran ni le type de tactile.

## Livrable
- `platformio.ini` : cible provisoire ESP32-C3, **diagnostic uniquement**.
- `src/main.cpp` : sortie série du modèle de puce, révision, flash, RAM, PSRAM, version SDK et MAC Wi-Fi, puis heartbeat.
- Aucun écran, tactile, Wi-Fi ou stockage initialisé. Aucun identifiant réseau intégré.
- Ce firmware ne constitue pas encore le client TouchDeck.

## Précautions
Un flash remplace le firmware actuellement installé. En l'absence de confirmation de l'identité du module et d'une autorisation de remplacer son firmware, ne pas lancer `platformio.upload`. Ne pas supposer que le câblage de l'ancien ESP32-C3 s'applique au module actuellement connecté.

## Suite
1. Obtenir la référence exacte du module connecté, ou une preuve indépendante qu'il s'agit de l'ESP32-C3 historique.
2. Qualifier flash/RAM et démarrage série ; conserver les logs.
3. Tester écran et tactile avec le câblage confirmé.
4. Ajouter Wi-Fi et découverte mDNS avec machine d'état unique ; ne jamais committer de secrets.
5. Brancher le protocole WebSocket et comparer redessin complet / partiel avant de choisir la stratégie de rendu.
