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

  const tree = document.getElementById('toc');
  const rail = document.querySelector('.tree-rail');
  const treeNodes = [...tree.children];
  const compactNavigation = matchMedia('(max-width: 900px), (max-height: 510px)');
  let progressClip;

  function buildRail() {
    if (compactNavigation.matches) {
      rail.setAttribute('hidden', '');
      tree.removeAttribute('data-rail');
      progressClip = null;
      return;
    }

    const width = tree.clientWidth;
    const height = tree.clientHeight;
    const trunk = 20;
    let seed = 11;
    function random() {
      seed = seed * 16807 % 2147483647;
      return seed / 2147483647;
    }

    let path = `M${trunk} 0V${height}`;
    const points = [];
    let y = 18 + random() * 20;
    while (y < height - 70) {
      const length = 50 + random() * 110;
      const offset = random() < 0.5 ? 16 : 32;
      const end = Math.min(height - 10, y + length);
      path += `M${trunk} ${y.toFixed(1)}l${offset} 14V${(end - 14).toFixed(1)}l${-offset} 14`;
      points.push({ x: trunk + offset, y: y + 14 + (end - y - 28) * random() });
      y = end + 18 + random() * 40;
    }
    for (let y = 40; y < height - 10; y += 46 + random() * 60) {
      points.push({ x: trunk, y });
    }

    const gap = (height - 56) / (treeNodes.length - 1);
    const interactivePoints = new Set();
    treeNodes.forEach((node, index) => {
      const y = 28 + gap * index;
      const position = points.find(point => Math.abs(point.y - y) < gap * 0.23);
      if (position) interactivePoints.add(position);
      node.style.setProperty('--node-x', `${position?.x ?? trunk}px`);
      node.style.setProperty('--node-y', `${position?.y ?? y}px`);
    });

    const dots = points.filter(point => !interactivePoints.has(point))
      .map(({ x, y }) => `<circle cx="${x}" cy="${y.toFixed(1)}" r="2.6"/>`).join('');
    rail.setAttribute('width', width);
    rail.setAttribute('height', height);
    rail.setAttribute('viewBox', `0 0 ${width} ${height}`);
    rail.removeAttribute('hidden');
    rail.innerHTML = `
      <defs>
        <g id="tree-branches" fill="none"><path d="${path}"/>${dots}</g>
        <clipPath id="tree-progress"><rect width="${width}" height="0"/></clipPath>
      </defs>
      <use href="#tree-branches" style="stroke:var(--line2)"/>
      <use href="#tree-branches" style="stroke:var(--acc)" clip-path="url(#tree-progress)"/>`;
    progressClip = rail.querySelector('rect');
    tree.setAttribute('data-rail', '');
  }

  tree.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const node = link.closest('details');
    requestAnimationFrame(() => { node.open = false; });
  });

  tree.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const node = event.target.closest('details[open]');
    if (!node) return;
    node.open = false;
    node.querySelector('summary').focus();
  });

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
    if (progressClip) {
      const progress = scrollRange ? Math.max(0, Math.min(1, scrollY / scrollRange)) : 0;
      progressClip.setAttribute('height', progress * tree.clientHeight);
    }
  }

  function scheduleNavigation() {
    if (activeFramePending) return;
    activeFramePending = true;
    requestAnimationFrame(updateNavigation);
  }

  addEventListener('scroll', scheduleNavigation, { passive: true });
  addEventListener('resize', () => {
    buildRail();
    scheduleNavigation();
  });
  buildRail();
  scheduleNavigation();

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealItems = [...document.querySelectorAll('main :is(.intro, .entry, .cell, .contact-list > div)')]
      .filter(item => item.getBoundingClientRect().top >= innerHeight);
    const revealObserver = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting || target.dataset.scrollReveal !== 'pending') continue;
        target.dataset.scrollReveal = 'shown';
        revealObserver.unobserve(target);
      }
    });

    for (const item of revealItems) {
      item.dataset.scrollReveal = 'pending';
      revealObserver.observe(item);
    }

    document.addEventListener('focusin', event => {
      const item = event.target.closest('[data-scroll-reveal]');
      if (!item) return;
      delete item.dataset.scrollReveal;
      revealObserver.unobserve(item);
    });
  }

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
