# Référentiels — touchDeck

## Méthode projet

Source : https://github.com/Cowprod/aiDevMethod  
Version épinglée : `57d032cc9661ddf48606f89cf9fc7676710001f8`

La méthode constitue la règle de conduite du projet : phase 0, décisions, qualifications techniques, jalons, preuves, STOP et validation.

## Référentiel technique Cowprod

Source : https://github.com/Cowprod/referenciel  
Version épinglée : `476f0fb4cf98095a244b2e981c980f0b5e935948`

### Applicable à ce stade

- `FRONTEND.md` pour la future interface Web/backoffice.
  - Bootstrap 5.x de référence.
  - Bootswatch autorisé/recommandé lorsqu'utile.
  - Font Awesome pour les icônes standard.
  - jQuery autorisé/préférable lorsqu'il simplifie réellement le code.
  - autosave préféré lorsqu'adapté ;
  - `jquery.typing` pour temporiser les champs texte lorsqu'il est disponible ;
  - TableDnD pour réordonner des lignes lorsque l'UI correspond à un tableau ;
  - Tabler n'est pas une dépendance normative.

### À déterminer

Les conventions SQL/PHP ne deviennent applicables que si l'architecture serveur retenue utilise ces technologies.

## Hiérarchie

1. décision projet validée ;
2. exception projet documentée ;
3. référentiel externe déclaré ici ;
4. méthode générale ;
5. choix d'implémentation de l'exécutant.
