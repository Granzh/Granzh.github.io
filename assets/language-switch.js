(() => {
  const highlights = window.CSS?.highlights;
  if (!highlights || !window.Highlight || !window.StaticRange) return;

  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'resume-language-transition';
  let incoming = false;
  let storage;

  // Read the handoff before the first paint so the new text starts hidden.
  try {
    storage = sessionStorage;
    const pending = JSON.parse(storage.getItem(storageKey));
    if (pending?.href === location.href) {
      storage.removeItem(storageKey);
      incoming = !reducedMotion.matches && pending.expires > Date.now();
    }
  } catch {
    return;
  }

  if (incoming) root.setAttribute('data-language-entering', '');

  const strike = new Highlight();
  const erased = new Highlight();
  erased.priority = 1;
  let frame;
  let destination;

  function getTextNodes() {
    const nodes = [];
    for (const section of document.querySelectorAll('body > .nav, main')) {
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.data.trim() && !node.parentElement.closest('[aria-hidden="true"], [hidden]')) {
          nodes.push(node);
        }
      }
    }
    return nodes;
  }

  function paint(highlight, nodes, progress, fromEnd = false) {
    highlight.clear();
    for (const node of nodes) {
      const offset = Math.floor(node.length * progress);
      const startOffset = fromEnd ? offset : 0;
      const endOffset = fromEnd ? node.length : offset;
      if (startOffset === endOffset) continue;
      highlight.add(new StaticRange({ startContainer: node, startOffset, endContainer: node, endOffset }));
    }
  }

  function cleanup() {
    cancelAnimationFrame(frame);
    highlights.delete('resume-strike');
    highlights.delete('resume-erased');
    root.removeAttribute('data-language-entering');
    destination = undefined;
  }

  function navigate(href) {
    try {
      storage.setItem(storageKey, JSON.stringify({ href, expires: Date.now() + 10000 }));
    } catch {}
    location.assign(href);
  }

  function reveal() {
    const nodes = getTextNodes();
    highlights.set('resume-erased', erased);
    paint(erased, nodes, 0, true);
    root.removeAttribute('data-language-entering');

    let start;
    function tick(now) {
      start ??= now;
      const progress = Math.min((now - start) / 460, 1);
      paint(erased, nodes, progress, true);
      if (progress === 1) cleanup();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  function strikeAndErase(href) {
    const strikeDuration = 380;
    const eraseStart = strikeDuration + 130;
    const eraseDuration = 330;
    const nodes = getTextNodes();
    highlights.set('resume-strike', strike);
    highlights.set('resume-erased', erased);

    let start;
    function tick(now) {
      start ??= now;
      const elapsed = now - start;
      if (elapsed <= eraseStart) {
        paint(strike, nodes, Math.min(elapsed / strikeDuration, 1));
      } else {
        const progress = Math.min((elapsed - eraseStart) / eraseDuration, 1);
        paint(strike, nodes, progress, true);
        paint(erased, nodes, progress);
        if (progress === 1) {
          navigate(href);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const link = document.querySelector('.languages a[hreflang]');
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (reducedMotion.matches) return;

      event.preventDefault();
      if (destination) return;
      cleanup();
      destination = link.href;
      document.dispatchEvent(new Event('language-switch-start'));
      strikeAndErase(destination);
    });

    if (incoming && !reducedMotion.matches) reveal();
    else cleanup();
  });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    const href = destination;
    cleanup();
    if (href) location.assign(href);
  });
  addEventListener('pagehide', cleanup);
})();
