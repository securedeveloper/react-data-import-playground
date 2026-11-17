// Sets the theme class before the first paint (an external file, so the CSP needs no 'unsafe-inline').
(function () {
  var t = null;
  try {
    t = localStorage.getItem('rdi-playground:theme');
  } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (t === 'dark') document.documentElement.classList.add('dark');
  document.documentElement.style.colorScheme = t;
})();
