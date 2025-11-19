# Simulateur AV

## Version 1.44
- **Ajustement du style**: La largeur de la colonne "Année" dans le tableau des taux du Fonds Euro a été augmentée pour une meilleure lisibilité.
- **Mise à jour de version**: Le numéro de build est passé à V1.44.

## Version 1.43
- **Amélioration du Scénario 3**: Le scénario 3 (Dynamisation progressive) a été entièrement revu pour inclure :
  - L'ajout de versements programmés, similaires au scénario 2.
  - L'implémentation de la logique de "dynamisation", qui déplace progressivement un montant du Fonds Euro vers les Unités de Compte selon une répartition dédiée.
  - Une mise à jour de l'interface pour accueillir ces nouvelles options de configuration.
- **Correction du style (Taux Fonds Euro)**: Une solution CSS plus robuste a été mise en place pour corriger définitivement le problème de dépassement du tableau des taux du Fonds Euro.
- **Mise à jour de version**: Le numéro de build est passé à V1.43.

## Version 1.42
- **Correction de la récupération des données UC**: La logique de récupération des données pour les Unités de Compte (UC) a été corrigée pour utiliser directement le ticker fourni par l'API de recherche Yahoo Finance, ce qui résout les erreurs 404 (Not Found) pour certains fonds.
- **Correction du style**: La largeur du tableau des taux du Fonds Euro a été ajustée pour qu'il ne dépasse plus de son conteneur, améliorant ainsi la mise en page.
- **Mise à jour de version**: Le numéro de build est passé à V1.42.

## Version 1.41
- **Correction de la recherche d'UCs**: Le fournisseur de recherche pour les Unités de Compte (UCs) a été basculé de EOD à Yahoo Finance pour résoudre une erreur 403 (Forbidden) qui empêchait la recherche de fonctionner correctement.
- **Mise à jour de version**: Le numéro de build est passé à V1.41.

## Version 1.40
- **Correction de l'échelle des graphiques**: L'échelle de temps du graphique "Indices et UCs" est maintenant synchronisée avec celle des scénarios de simulation.
- **Mise à jour de version**: Le numéro de build est passé à V1.40 dans tous les fichiers concernés.

## Version 1.39
- **Simplification du fournisseur de données**: La récupération des données pour les UCs a été basculée sur Yahoo Finance pour une meilleure cohérence et pour éliminer les erreurs liées aux autres fournisseurs.
- **Nettoyage du Proxy**: Le code du proxy Vercel a été simplifié, ne conservant que la logique pour Yahoo (données de prix) et EOD (recherche), ce qui supprime la nécessité de configurer une clé API pour Tiingo.
- **Mise à jour de version**: Le numéro de build est passé à V1.39.

## Version 1.38
- **Correction de la mise en page**: La structure HTML a été corrigée pour que la section "Unités de Compte" s'affiche correctement dans son propre cadre.
- **Correction des Graphiques**: La logique d'affichage a été ajustée. Le graphique des scénarios est maintenant zoomé sur la période de simulation, tandis que le graphique des indices conserve l'historique complet pour une meilleure mise en perspective.

## Version 1.37
- **Proxy Universel**: Le proxy Vercel a été transformé en proxy universel pour résoudre tous les problèmes de CORS.
- **Sécurisation des Clés API**: Les clés API ont été retirées du code côté client et déplacées vers les variables d'environnement de Vercel.

## Version 1.36
- **Intégration API Vercel**: Ajout d'une fonction pour appeler une API proxy sur Vercel afin de récupérer les données historiques.
- **Ajustement du Graphique**: La plage de dates des graphiques s'adapte dynamiquement.

## Déploiement
1. Uploadez **index.html**, **style.20251115142243.css**, **app.20251115142243.js**, **.nojekyll** et le dossier **my-yahoo-proxy** à la **racine** du dépôt.
2. `Settings → Pages` → *Deploy from a branch* → **main / (root)**.
3. Rechargez avec **Disable cache**.