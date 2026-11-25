(() => {
  const surname = document.querySelector('.surname');
  const original = surname.querySelector('.surname-text');
  const typing = surname.querySelector('.surname-typing');
  const prefix = typing.querySelector('.surname-prefix');
  const letter = typing.querySelector('.surname-letter');
  const cursor = typing.querySelector('.surname-cursor');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  const wrong = Array.from(surname.dataset.mistyped);
  const correct = Array.from(original.textContent);
  const steps = [
    { delay: 900, mode: 'insert', text: [] },
    ...wrong.map((_, index) => ({
      delay: index === 0 ? 280 : 92,
      text: wrong.slice(0, index + 1),
      motion: 'type',
    })),
    ...wrong.map((_, index) => ({
      delay: index === 0 ? 1550 : 64,
      text: wrong.slice(0, wrong.length - index - 1),
      motion: 'erase',
    })),
    ...correct.map((_, index) => ({
      delay: index === 0 ? 280 : 92,
      text: correct.slice(0, index + 1),
      motion: 'type',
    })),
    { delay: 900 },
  ];

  let timer;
  let cursorMotion;
  let letterMotion;

  function stop() {
    clearTimeout(timer);
    cursorMotion?.cancel();
    letterMotion?.cancel();
    typing.hidden = true;
    delete surname.dataset.mode;
    reducedMotion.removeEventListener('change', stop);
    document.removeEventListener('language-switch-start', stop);
  }

  function play(index) {
    const step = steps[index];
    timer = setTimeout(() => {
      if (!step.text) {
        stop();
        return;
      }

      if (step.mode) surname.dataset.mode = step.mode;
      const from = cursor.getBoundingClientRect();
      cursorMotion?.cancel();
      letterMotion?.cancel();
      prefix.textContent = step.text.slice(0, -1).join('');
      letter.textContent = step.text.at(-1) ?? '';

      if (step.motion) {
        const to = cursor.getBoundingClientRect();
        const duration = step.motion === 'type' ? 86 : 60;
        cursorMotion = cursor.animate?.(
          [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }],
          { duration, easing: 'cubic-bezier(0.25, 0.7, 0.35, 1)' },
        );
        if (step.motion === 'type') {
          letterMotion = letter.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
        }
      }
      play(index + 1);
    }, step.delay);
  }

  surname.dataset.mode = 'normal';
  typing.hidden = false;
  reducedMotion.addEventListener('change', stop);
  document.addEventListener('language-switch-start', stop);
  play(0);
})();
