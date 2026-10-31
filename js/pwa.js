'use strict';
// Registro do Service Worker (instalação PWA e cache do app).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('PWA SW:', err)));
}
