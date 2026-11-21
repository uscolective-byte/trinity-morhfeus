// Trinity v7.0.0 — Auth Bootstrap
// Načítaj token z URL hash alebo localStorage
(function() {
  const hash = window.location.hash;
  if (hash.startsWith('#token=')) {
    const token = hash.substring(7);
    localStorage.setItem('trinity_token', token);
    window.location.hash = '';
  }
  window.TRINITY_TOKEN = localStorage.getItem('trinity_token') || '';
})();
