// Fichier : /api/historical.js

export default async function handler(request, response) {
  // Récupérer les paramètres de la requête (ticker, date de début, date de fin)
  const { ticker, period1, period2 } = request.query;

  if (!ticker || !period1 || !period2) {
    return response.status(400).json({ error: 'Les paramètres ticker, period1 et period2 sont requis.' });
  }

  // Construire l'URL de l'API Yahoo Finance
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    // Appeler l'API de Yahoo depuis le serveur
    const yahooResponse = await fetch(yahooUrl, {
      headers: {
        // Il est parfois utile de simuler un navigateur pour éviter les blocages
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!yahooResponse.ok) {
      // Si Yahoo renvoie une erreur, la transmettre
      const errorData = await yahooResponse.text();
      return response.status(yahooResponse.status).send(errorData);
    }

    const data = await yahooResponse.json();

    // Ajouter les en-têtes CORS pour autoriser l'appel depuis votre github.io
    response.setHeader('Access-Control-Allow-Origin', '*'); // Ou mettez l'URL de votre github.io pour plus de sécurité
    response.setHeader('Access-Control-Allow-Methods', 'GET');
    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Mettre en cache la réponse pour 1 jour

    // Renvoyer les données au format JSON
    return response.status(200).json(data);

  } catch (error) {
    return response.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}