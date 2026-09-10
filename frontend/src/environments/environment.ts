// URLs relatives : marche en dev (via proxy.conf.json) ET en prod
// (le back sert le bundle Angular sur la même origine).
//
// appVersion est bumpé manuellement à chaque release (à synchroniser avec
// frontend/package.json et le tag git). Affiché dans la toolbar.
export const environment = {
  production: false,
  appVersion: '3.0.27',
  apiUrl: '/api',
  socketUrl: '', // même origine que la page (auto-détection par socket.io)
};
