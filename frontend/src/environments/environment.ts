// URLs relatives : marche en dev (via proxy.conf.json) ET en prod
// (le back sert le bundle Angular sur la même origine).
export const environment = {
  production: false,
  apiUrl: '/api',
  socketUrl: '', // même origine que la page (auto-détection par socket.io)
};
