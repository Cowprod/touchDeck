# Décisions — touchDeck

## D-001
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Le serveur est autoritaire sur le jeu de pages et la page à afficher. Un client n'a pas à connaître durablement toutes les pages.  
Conséquences: La navigation peut être résolue côté serveur et une modification de page côté serveur ne nécessite pas de reflash.

## D-002
Type: PRODUIT  
Statut: VALIDÉE  
Décision: La synchronisation repose sur des groupes. Chaque client affecté appartient à un seul groupe ; un client indépendant est placé seul dans un groupe dédié.  
Conséquences: Aucun mode spécial « indépendant » n'est nécessaire.

## D-003
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un groupe possède un jeu de pages et une page courante.  
Conséquences: Tous les clients du groupe partagent la même navigation et reçoivent la page courante du groupe.

## D-004
Type: PRODUIT  
Statut: VALIDÉE  
Décision: Un client peut être connu du serveur sans être affecté à un groupe ; il est alors « non affecté / à ranger ».  
Conséquences: L'enrôlement d'un nouveau terminal est dissocié de son affectation fonctionnelle.

## D-005
Type: TECHNIQUE  
Statut: VALIDÉE SOUS QUALIFICATION  
Décision: L'identité technique d'un ESP utilisera sa MAC Wi-Fi stable, sous réserve de validation sur le matériel réel.  
Conséquences: Le serveur peut conserver l'affectation de l'ESP sans configuration fonctionnelle locale supplémentaire.

## D-006
Type: TECHNIQUE  
Statut: VALIDÉE  
Décision: Un client Web utilise un UUID persistant généré à sa première utilisation et stocké dans `localStorage`.  
Conséquences: Un autre navigateur/profil ou l'effacement du stockage local crée un nouveau client à affecter.

## D-007
Type: PRODUIT  
Statut: VALIDÉE  
Décision: L'identifiant technique d'un client est distinct de son libellé humain modifiable.  
Conséquences: Une MAC ou un UUID peut être renommé côté serveur sans modifier son identité.

## D-008
Type: PRODUIT  
Statut: VALIDÉE  
Décision: `next` et `previous` sont des intentions de navigation adressées au serveur ; le serveur détermine la page résultante et la diffuse au groupe. Le serveur peut également imposer directement une page.  
Conséquences: ESP et Web peuvent partager la même sémantique de navigation.
