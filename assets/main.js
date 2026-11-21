(() => {
  /* reveal */
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));

  /* =====================================================================
     SCROLL + NAV
     ===================================================================== */
  const tocEl = document.getElementById('toc');
  const secEls = [...document.querySelectorAll('[data-sec]')];
  const tocItems = [...tocEl.children];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis=null;
  if(window.Lenis&&!reduced){ lenis=new Lenis({lerp:0.09,smoothWheel:true}); }

  function goTo(el,off){
    off=off||0;
    if(lenis) lenis.scrollTo(el,{offset:off,duration:1.6});
    else window.scrollTo({top:el.getBoundingClientRect().top+scrollY+off,behavior:'smooth'});
  }
  tocEl.addEventListener('click',e=>{
    const li=e.target.closest('li'); if(!li) return;
    const i=+li.dataset.i;
    if(i<0){ lenis?lenis.scrollTo(0,{duration:1.6}):scrollTo({top:0,behavior:'smooth'}); }
    else goTo(secEls[i],0);
  });
  addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    if(e.target&&e.target.closest&&e.target.closest('input,textarea')) return;
    const k=(e.code||'').replace(/^Key/,'').replace(/^Digit/,'').toLowerCase();
    if(k==='t'){ setMode(effTheme()==='dark'?'light':'dark'); }
    else if(k==='d'){ goTo(document.getElementById('end')); }
    else if(k==='c'){ goTo(document.getElementById('s0'),0); }
    else if(k>='1'&&k<='6'){ goTo(secEls[+k-1],0); }
  });
  document.querySelectorAll('[data-key]').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();
    goTo(document.querySelector(a.getAttribute('href')),0);
  }));

  /* ---------- theme ---------- */
  const mq=matchMedia('(prefers-color-scheme: light)');
  let mode='dark';
  try{ mode=localStorage.getItem('atelier-theme')||'dark'; }catch(e){}
  const themesEl=document.getElementById('themes');
  function effTheme(){ return mode==='system'?(mq.matches?'light':'dark'):mode; }
  function applyTheme(){
    document.documentElement.dataset.eff=effTheme();
    themesEl.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
  }
  function setMode(m){ mode=m; try{localStorage.setItem('atelier-theme',m);}catch(e){} applyTheme(); }
  themesEl.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.m); });
  mq.addEventListener&&mq.addEventListener('change',applyTheme);
  applyTheme();

  /* ---------- git-graph rail ---------- */
  const rail=document.getElementById('rail'); let clr=null,railH=0;
  function buildRail(){
    const w=rail.clientWidth||200, h=rail.clientHeight||300; railH=h;
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
  addEventListener('resize',buildRail);

  buildRail();
  const drawBackground = createBackground(reduced, effTheme);
  let activeIdx = -2;

  function frame(t) {
    if (lenis) lenis.raf(t);
    const H = innerHeight;
    const raw = scrollY;
    const docH = document.documentElement.scrollHeight;
    let idx=-1;
    for(let i=0;i<secEls.length;i++){ if(secEls[i].getBoundingClientRect().top<H*0.5) idx=i; }
    if(idx!==activeIdx){ tocItems.forEach(li=>li.classList.toggle('on',+li.dataset.i===idx)); activeIdx=idx; }
    if(clr) clr.setAttribute('height',(Math.min(1,raw/Math.max(1,docH-H))*railH).toFixed(1));
    drawBackground(t, H, raw, docH);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
