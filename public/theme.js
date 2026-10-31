// Apply before the first paint; preferences contain no connection credentials.
const appearance = ['light', 'dark', 'system'];
let choice = 'light';
try { const saved = localStorage.getItem('folio-appearance'); if (appearance.includes(saved)) choice = saved; } catch {}
const system = matchMedia('(prefers-color-scheme: dark)');
function apply() {
  const theme = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('themeToggle');
  if (button) {
    button.dataset.appearance = choice;
    window.dispatchEvent(new Event('folio-theme'));
  }
  window.folioDesktop?.setTheme(theme).catch(() => {});
}
window.folioAppearance={get:()=>choice,set:value=>{if(!appearance.includes(value))return;choice=value;try{localStorage.setItem('folio-appearance',choice);}catch{}apply();}};
apply();
system.addEventListener('change', apply);
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').onclick = () => {
    choice = appearance[(appearance.indexOf(choice) + 1) % appearance.length];
    try { localStorage.setItem('folio-appearance', choice); } catch {}
    apply();
  };
  apply();
});
