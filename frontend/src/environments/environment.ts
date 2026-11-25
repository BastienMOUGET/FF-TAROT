// URLs relatives : marche en dev (via proxy.conf.json) ET en prod
// (le back sert le bundle Angular sur la même origine).
//
// appVersion est bumpé manuellement à chaque release (à synchroniser avec
// frontend/package.json et le tag git). Affiché dans la toolbar.
export const environment = {
  production: false,
  appVersion: '3.0.39',
  apiUrl: '/api',
  socketUrl: '', // vide = déduit de l'adresse de la page (voir socket.service)
  // Le classement live tourne sur un port séparé du back (SOCKET_PORT côté
  // serveur). En production, la page est servie sur 3000 : viser la même
  // origine ferait échouer la connexion, d'où le « Déconnecté » permanent
  // (retour terrain n°11).
  socketPort: 3001,
  // Port du serveur de développement Angular : là, /socket.io est proxifié
  // par proxy.conf.json, donc on garde l'origine.
  devPort: '4200',
};
