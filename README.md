# Simulateur AV – V1.31

- Build V1.31 du 2025-11-17:
  - Changement de l'API pour les indices (CAC40, S&P500) vers Alpha Vantage pour avoir un historique de plus de 5 ans.

Cette version V1.30 correspond aux fichiers **style.20251115142243.css** et **app.20251115142243.js**.
- UC par **ISIN** uniquement → nom auto (OpenFIGI) + historique (Stooq), fallback CSV.
- **Répartition (%)** par scénario (Fonds € + UC), **Total** rouge si **> 100%**.

## Déploiement
1. Uploadez **index.html**, **style.20251115142243.css**, **app.20251115142243.js**, **.nojekyll** à la **racine** du dépôt et supprimez/ignorez les anciens `style*.css` / `app*.js`.
2. `Settings → Pages` → *Deploy from a branch* → **main / (root)**.
3. Rechargez avec **Disable cache**.
