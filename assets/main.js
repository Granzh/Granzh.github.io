(() => {
  const root = document.documentElement;
  const themes = document.getElementById('themes');
  const buttons = [...themes.querySelectorAll('button')];
  const colorPreference = matchMedia('(prefers-color-scheme: light)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const storageKey = 'atelier-theme';
  let mode = 'dark';

  try {
    const savedMode = localStorage.getItem(storageKey);
    if (buttons.some(button => button.dataset.m === savedMode)) mode = savedMode;
  } catch {}

  function effectiveTheme() {
    return mode === 'system' ? (colorPreference.matches ? 'light' : 'dark') : mode;
  }

  function applyTheme() {
    root.dataset.eff = effectiveTheme();
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.m === mode));
    }
  }

  function setTheme(nextMode) {
    mode = nextMode;
    try { localStorage.setItem(storageKey, mode); } catch {}
    applyTheme();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setTheme(button.dataset.m));
  }
  colorPreference.addEventListener('change', applyTheme);
  applyTheme();
  themes.hidden = false;

  const links = [...document.querySelectorAll('#toc a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  let activeLink = links[0];

  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.code === 'KeyT') {
      setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
    }
  });

  const rail = document.getElementById('rail');
  let clr = null;
  function buildRail(){
    const w = rail.clientWidth;
    const h = rail.clientHeight;
    if (!w || !h) return;
    let seed=11; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    let d='M20 0V'+h, nodes='';
    let y=18+rnd()*20;
    while(y<h-70){
      const len=50+rnd()*110, dx=rnd()<.5?16:32, y2=Math.min(h-10,y+len);
      d+=`M20 ${y.toFixed(1)}l${dx} 14V${(y2-14).toFixed(1)}l${-dx} 14`;
      nodes+=`<circle cx="${20+dx}" cy="${(y+14+(y2-y-28)*rnd()).toFixed(1)}" r="2.6"/>`;
      y=y2+18+rnd()*40;
    }
    for(let k=0,yy=40;yy<h-10;k++,yy+=46+rnd()*60) nodes+=`<circle cx="20" cy="${yy.toFixed(1)}" r="2.6"/>`;
    rail.innerHTML=`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><g id="gg" fill="none" stroke-width="1"><path d="${d}"/>${nodes}</g><clipPath id="cl"><rect id="clr" x="0" y="0" width="${w}" height="0"/></clipPath></defs><use href="#gg" style="stroke:var(--line2)"/><use href="#gg" style="stroke:var(--acc)" clip-path="url(#cl)"/></svg>`;
    clr=document.getElementById('clr');
  }
  buildRail();
  addEventListener('resize', buildRail);

  const drawBackground = createBackground(reducedMotion, effectiveTheme);
  let activeFramePending = false;

  function updateNavigation() {
    activeFramePending = false;
    const documentHeight = root.scrollHeight;
    const scrollRange = Math.max(0, documentHeight - innerHeight);
    const atBottom = scrollRange > 0 && scrollY >= scrollRange - 2;
    let current = links[0];
    for (let index = 1; index < sections.length; index++) {
      if (atBottom || sections[index].getBoundingClientRect().top <= innerHeight * 0.35) {
        current = links[index];
      }
    }

    if (activeLink !== current) {
      activeLink.removeAttribute('aria-current');
      current.setAttribute('aria-current', 'location');
      activeLink = current;
    }
    if (clr) {
      const progress = scrollRange ? Math.max(0, Math.min(1, scrollY / scrollRange)) : 0;
      clr.setAttribute('height', progress * rail.clientHeight);
    }
  }

  function scheduleNavigation() {
    if (activeFramePending) return;
    activeFramePending = true;
    requestAnimationFrame(updateNavigation);
  }

  addEventListener('scroll', scheduleNavigation, { passive: true });
  addEventListener('resize', scheduleNavigation);
  scheduleNavigation();

  if (drawBackground) {
    if (reducedMotion) {
      const draw = () => drawBackground(0, innerHeight, scrollY, root.scrollHeight);
      draw();
      addEventListener('scroll', draw, { passive: true });
      addEventListener('resize', draw);
      new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['data-eff'] });
    } else {
      function frame(time) {
        drawBackground(time, innerHeight, scrollY, root.scrollHeight);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }
})();
