(() => {
  const root = document.documentElement;
  const languageLinks = [...document.querySelectorAll('.languages a')];
  const bindings = [];
  for (const attribute of ['text', 'aria-label', 'title', 'href', 'content', 'class', 'data-mistyped']) {
    const translation = attribute === 'text' ? 'data-en' : `data-en-${attribute}`;
    for (const element of document.querySelectorAll(`[${translation}]`)) {
      const original = attribute === 'text' ? element.textContent : element.getAttribute(attribute);
      bindings.push({ element, attribute, ru: original, en: element.getAttribute(translation) });
    }
  }
  const languageContent = [...document.querySelectorAll('[data-lang-only]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const highlights = window.CSS?.highlights;
  const canAnimate = Boolean(highlights && window.Highlight && window.StaticRange);
  const strike = canAnimate ? new Highlight() : null;
  const erased = canAnimate ? new Highlight() : null;
  if (erased) erased.priority = 1;

  let frame;
  let destination;

  function urlLanguage() {
    return new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ru';
  }

  function languageURL(language) {
    const url = new URL(location.href);
    if (language === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    return url;
  }

  function updateLanguageLinks() {
    for (const link of languageLinks) {
      link.href = languageURL(link.hreflang);
      if (link.hreflang === root.lang) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function applyLanguage(language, preserveSection = false) {
    const activeLink = preserveSection && document.querySelector('#toc [aria-current]');
    const section = activeLink && document.getElementById(activeLink.hash.slice(1));
    const before = section && section.getBoundingClientRect().top;

    for (const { element, attribute, [language]: value } of bindings) {
      if (attribute === 'text') element.textContent = value;
      else if (value === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, value);
    }
    for (const element of languageContent) {
      element.hidden = element.dataset.langOnly !== language;
    }
    root.lang = language;
    updateLanguageLinks();

    if (section) {
      const delta = section.getBoundingClientRect().top - before;
      if (delta) scrollBy({ top: delta, behavior: 'instant' });
    }
    document.dispatchEvent(new Event('language-switch-end'));
  }

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
    highlights?.delete('resume-strike');
    highlights?.delete('resume-erased');
    destination = undefined;
  }

  function reveal() {
    const nodes = getTextNodes();
    highlights.set('resume-erased', erased);
    paint(erased, nodes, 0, true);

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

  function switchLanguage(language, animate = false) {
    cleanup();
    history.pushState(null, '', languageURL(language));
    applyLanguage(language, true);
    if (animate) reveal();
  }

  function strikeAndErase(language) {
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
          switchLanguage(language, true);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  for (const link of languageLinks) {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      const language = link.hreflang;
      if (destination || language === root.lang) return;

      document.dispatchEvent(new Event('language-switch-start'));
      if (canAnimate && !reducedMotion.matches) {
        cleanup();
        destination = language;
        strikeAndErase(language);
      } else {
        switchLanguage(language);
      }
    });
  }

  addEventListener('popstate', () => {
    cleanup();
    const language = urlLanguage();
    if (language !== root.lang) {
      document.dispatchEvent(new Event('language-switch-start'));
      applyLanguage(language);
    } else {
      updateLanguageLinks();
    }
  });
  addEventListener('hashchange', updateLanguageLinks);
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    const language = destination;
    if (language) switchLanguage(language);
    else cleanup();
  });
  addEventListener('pagehide', cleanup);

  const language = urlLanguage();
  if (language !== root.lang) applyLanguage(language);
  else updateLanguageLinks();
})();
