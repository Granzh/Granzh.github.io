(() => {
  const root = document.documentElement;
  const themes = document.getElementById('themes');
  const buttons = [...themes.querySelectorAll('button')];
  const colorPreference = matchMedia('(prefers-color-scheme: light)');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = motionPreference.matches;
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
  const sectionFrames = sections.map(section => section.querySelector(':scope > .col'));
  const connector = document.querySelector('.section-connector > g');
  const connectorMask = document.querySelector('#section-connector-mask path');
  const connectorPaths = sectionFrames.map(() => ({
    main: connector.appendChild(document.createElementNS(connector.namespaceURI, 'path')),
    upperRight: connector.appendChild(document.createElementNS(connector.namespaceURI, 'path'))
  }));
  const hero = sections[0];
  const heroCard = sectionFrames[0];
  let activeIndex = 0;

  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.code === 'KeyT') {
      setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
    }
  });

  const drawBackground = createBackground(reducedMotion, effectiveTheme);
  let activeFramePending = false;
  let connectorOpacity = null;
  let connectorTransition = null;

  function updateConnector(time, link, frames, lead, sectionChanged) {
    const linkBox = link.getBoundingClientRect();
    const dotRadius = parseFloat(getComputedStyle(link, '::after').width) / 2;
    const dotX = linkBox.right - dotRadius;
    const dotY = linkBox.top + linkBox.height / 2;
    const easedLead = lead * lead * (3 - 2 * lead);
    const targetOpacity = frames.map((_, index) => ({
      main: Number(index === activeIndex),
      upperRight: index === activeIndex ? 1 - easedLead : index === activeIndex + 1 ? easedLead : 0
    }));

    if (motionPreference.matches) {
      connectorTransition = null;
    } else if (sectionChanged && connectorOpacity) {
      connectorTransition = { from: connectorOpacity, start: time };
    }

    connectorOpacity = targetOpacity;
    if (connectorTransition) {
      const { from, start } = connectorTransition;
      const progress = (time - start) / 220;
      if (progress < 1) {
        const eased = 1 - (1 - progress) ** 3;
        connectorOpacity = targetOpacity.map(({ main, upperRight }, index) => {
          const previous = from[index];
          return {
            main: previous.main + (main - previous.main) * eased,
            upperRight: previous.upperRight + (upperRight - previous.upperRight) * eased
          };
        });
        scheduleNavigation();
      } else {
        connectorTransition = null;
      }
    }

    frames.forEach(({ left, top, right, bottom }, index) => {
      const { main, upperRight } = connectorPaths[index];
      const opacity = connectorOpacity[index];
      main.setAttribute('opacity', opacity.main);
      upperRight.setAttribute('opacity', opacity.upperRight);
      if (opacity.main > 0) {
        main.setAttribute('d', `M ${left} ${top} L ${dotX} ${dotY} L ${left} ${bottom} M ${dotX} ${dotY} L ${right} ${bottom}`);
      }
      if (opacity.upperRight > 0) {
        upperRight.setAttribute('d', `M ${dotX} ${dotY} L ${right} ${top}`);
      }
    });
  }

  function updateNavigation(time) {
    activeFramePending = false;
    const documentHeight = root.scrollHeight;
    const scrollRange = Math.max(0, documentHeight - innerHeight);
    const atBottom = scrollRange > 0 && scrollY >= scrollRange - 2;
    const scrollPadding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const activationLine = Math.max(innerHeight * 0.35, scrollPadding + 1);
    let currentIndex = 0;
    for (let index = 1; index < sections.length; index++) {
      if (atBottom || sections[index].getBoundingClientRect().top <= activationLine) {
        currentIndex = index;
      }
    }

    const currentLink = links[currentIndex];
    const sectionChanged = activeIndex !== currentIndex;
    if (sectionChanged) {
      links[activeIndex].removeAttribute('aria-current');
      currentLink.setAttribute('aria-current', 'location');
      activeIndex = currentIndex;
    }

    const card = heroCard.getBoundingClientRect();
    if (connector.ownerSVGElement.getClientRects().length) {
      const frames = [card, ...sectionFrames.slice(1).map(frame => frame.getBoundingClientRect())];
      connectorMask.setAttribute('d', frames.map(({ left, top, right, bottom }) =>
        `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`
      ).join(' '));
      const nextIndex = currentIndex + 1;
      let lead = 0;
      if (frames[nextIndex] && !motionPreference.matches) {
        let distanceToSwitch = sections[nextIndex].getBoundingClientRect().top - activationLine;
        if (nextIndex === sections.length - 1 && scrollRange > 0) {
          distanceToSwitch = Math.min(distanceToSwitch, scrollRange - scrollY);
        }
        const leadDistance = 120;
        lead = Math.max(0, Math.min(1, 1 - distanceToSwitch / leadDistance));
      }
      updateConnector(time, currentLink, frames, lead, sectionChanged);
    } else {
      connectorOpacity = null;
      connectorTransition = null;
    }

    const viewportWidth = root.clientWidth;
    const progress = Math.max(0, Math.min(1, -card.top / card.height));
    const spread = progress * progress * (3 - 2 * progress);
    const x = card.left * (1 - spread);
    const y = Math.max(0, card.bottom - 2);
    const scale = card.width / viewportWidth * (1 - spread) + spread;
    hero.style.setProperty('--hero-line-transform', `translate(${x}px, ${y}px) scaleX(${scale})`);
    hero.style.setProperty('--hero-line-opacity', progress);
    root.toggleAttribute('data-header-pinned', card.bottom <= 0);
  }

  function scheduleNavigation() {
    if (activeFramePending) return;
    activeFramePending = true;
    requestAnimationFrame(updateNavigation);
  }

  addEventListener('scroll', scheduleNavigation, { passive: true });
  addEventListener('resize', scheduleNavigation);
  motionPreference.addEventListener('change', scheduleNavigation);
  if ('ResizeObserver' in window) {
    const frameObserver = new ResizeObserver(scheduleNavigation);
    for (const frame of sectionFrames) frameObserver.observe(frame);
  }
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
