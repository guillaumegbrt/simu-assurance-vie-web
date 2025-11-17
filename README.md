# Simulateur AV – V1.29

Cette version V1.29 correspond aux fichiers **style.20251115142243.css** et **app.20251115142243.js**.
- UC par **ISIN** uniquement → nom auto (OpenFIGI) + historique (Stooq), fallback CSV.
- **Répartition (%)** par scénario (Fonds € + UC), **Total** rouge si **> 100%**.

## Déploiement
1. Uploadez **index.html**, **style.20251115142243.css**, **app.20251115142243.js**, **.nojekyll** à la **racine** du dépôt et supprimez/ignorez les anciens `style*.css` / `app*.js`.
2. `Settings → Pages` → *Deploy from a branch* → **main / (root)**.
3. Rechargez avec **Disable cache**.
