# Simulateur AV

## Version 1.37
- **Proxy Universel**: Le proxy Vercel a été transformé en proxy universel, gérant désormais les appels pour Yahoo, Tiingo, et EOD afin de résoudre tous les problèmes de CORS.
- **Sécurisation des Clés API**: Les clés API ont été retirées du code côté client (`app.js`) et doivent maintenant être configurées comme variables d'environnement sur Vercel pour une sécurité accrue.
- **Centralisation des Appels**: Le code de l'application a été refactorisé pour utiliser une fonction `fetchData` unique qui passe par le proxy pour toutes les requêtes de données financières.
- **Mise à jour de version**: Le numéro de build est passé à V1.37.

## Version 1.36
- **Intégration API Vercel**: Ajout d'une fonction `getFinancialData` pour appeler une API proxy sur Vercel (`my-yahoo-proxy.vercel.app`) afin de récupérer les données historiques des indices (CAC40, S&P 500) sur une longue période (20 ans).
- **Fallback Fournisseurs**: En cas d'échec de l'API Vercel, le système bascule automatiquement sur les fournisseurs de données alternatifs (Tiingo, EOD) pour assurer la continuité du service.
- **Ajustement du Graphique**: La plage de dates des graphiques s'adapte désormais dynamiquement pour commencer à la date la plus ancienne disponible parmi tous les actifs (indices et UC) et les dates de début de scénario.
- **Mise à jour de version**: Le numéro de build est passé à V1.36 dans les fichiers `app.js` et `index.html`.

## Déploiement
1. Uploadez **index.html**, **style.20251115142243.css**, **app.20251115142243.js**, **.nojekyll** et le dossier **my-yahoo-proxy** à la **racine** du dépôt.
2. `Settings → Pages` → *Deploy from a branch* → **main / (root)**.
3. Rechargez avec **Disable cache**.