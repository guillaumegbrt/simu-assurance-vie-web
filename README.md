# Simulateur AV – V1.31

- Build V1.31 du 2025-11-17:
  - Changement de l'API pour les indices (CAC40, S&P500) vers Alpha Vantage pour avoir un historique de plus de 5 ans.

Cette version V1.30 correspond aux fichiers **style.20251115142243.css** et **app.20251115142243.js**.
- UC par **ISIN** uniquement → nom auto (OpenFIGI) + historique (Stooq), fallback CSV.
- **Répartition (%)** par scénario (Fonds € + UC), **Total** rouge si **> 100%**.

## Version 1.36
- **Intégration API Vercel**: Ajout d'une fonction `getFinancialData` pour appeler une API proxy sur Vercel (`my-yahoo-proxy.vercel.app`) afin de récupérer les données historiques des indices (CAC40, S&P 500) sur une longue période (20 ans).
- **Fallback Fournisseurs**: En cas d'échec de l'API Vercel, le système bascule automatiquement sur les fournisseurs de données alternatifs (Tiingo, EOD) pour assurer la continuité du service.
- **Ajustement du Graphique**: La plage de dates des graphiques s'adapte désormais dynamiquement pour commencer à la date la plus ancienne disponible parmi tous les actifs (indices et UC) et les dates de début de scénario.
- **Mise à jour de version**: Le numéro de build est passé à V1.36 dans les fichiers `app.js` et `index.html`.

## Déploiement
1. Uploadez **index.html**, **style.20251115142243.css**, **app.20251115142243.js**, **.nojekyll** à la **racine** du dépôt et supprimez/ignorez les anciens `style*.css` / `app*.js`.
2. `Settings → Pages` → *Deploy from a branch* → **main / (root)**.
3. Rechargez avec **Disable cache**.