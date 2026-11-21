(() => {
  const log=document.getElementById('clog'), chips=document.getElementById('chips'),
        sum=document.getElementById('csum'), form=document.getElementById('cform'),
        inp=document.getElementById('cin'), btn=document.getElementById('csend');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const wait=ms=>new Promise(r=>setTimeout(r,reduce?0:ms));
  const F=[['task','задача'],['obj','объект'],['res','ресурс'],['sol','решение'],['bud','бюджет'],['con','контакт']];
  const S={task:'',obj:'',res:'',sol:'',bud:'',con:''}; let handed=false, busy=false, started=false;
  function drawSum(flash){
    sum.innerHTML='<b>Резюме для менеджера</b>'+F.map(([k,n])=>`<div class="sr${S[k]?' set':''}${flash===k?' flash':''}"><u>${n}</u><span>${S[k]||'—'}</span></div>`).join('')
      +`<div class="st">статус: ${handed?'передано менеджеру':(S.con?'контакты получены':'сбор данных')}</div>`;
  }
  drawSum();
  function addLine(who,text){
    const d=document.createElement('div'); d.className='ln '+(who==='me'?'me':'bot');
    d.innerHTML=`<b>${who==='me'?'вы':'консультант'}</b><span></span>`;
    d.lastChild.textContent=text||''; log.appendChild(d); log.scrollTop=log.scrollHeight; return d.lastChild;
  }
  async function think(){
    const el=addLine('bot',''); const st=['читаю запрос','определяю ресурс и объект','подбираю решение'];
    el.innerHTML='<span class="thk"></span>'; const t=el.firstChild;
    for(let i=0;i<st.length;i++){ t.textContent=st[i]+'…'; log.scrollTop=log.scrollHeight; await wait(420); }
    el.parentNode.remove();
  }
  async function stream(text){
    const el=addLine('bot',''); const c=document.createElement('i'); c.className='caret';
    const parts=text.match(/\S+\s*|\n/g)||[]; let out='';
    for(const w of parts){ out+=w; el.textContent=out; el.appendChild(c); log.scrollTop=log.scrollHeight; await wait(22+Math.random()*38); }
    c.remove();
  }
  /* very small rule-based extractor + dialog policy */
  function extract(t){
    const l=t.toLowerCase(); let ch=null;
    const set=(k,v)=>{ if(v&&S[k]!==v){ S[k]=v; ch=k; } };
    let m=l.match(/(\d+)\s*(склад|объект|магазин|здани|цех|филиал|завод|офис)[а-я]*/);
    if(m) set('obj',m[1]+' '+({склад:'складов',объект:'объектов',магазин:'магазинов',здани:'зданий',цех:'цехов',филиал:'филиалов',завод:'заводов',офис:'офисов'}[m[2]]));
    else if(/склад|магазин|здани|цех|завод|офис|ферм/.test(l)) set('obj',(l.match(/склад|магазин|здани|цех|завод|офис|ферм/)||[''])[0]);
    const res=[]; if(/электр|свет|киловатт|квт/.test(l))res.push('электричество'); if(/тепл|отоплен|пар\b/.test(l))res.push('тепло'); if(/вод[аыуе]|водоснаб/.test(l))res.push('вода'); if(/\bгаз/.test(l))res.push('газ');
    if(res.length) set('res',res.join(', '));
    const g=[]; if(/учёт|учет|видеть|мониторинг|счётчик|счетчик|контрол/.test(l))g.push('учёт'); if(/сэконом|экономи|снизить|сократ|затрат|дорого/.test(l))g.push('экономия');
    if(g.length) set('task',g.join(' + '));
    m=l.match(/(\d[\d\s]*)\s*(тыс|млн|т\.?\s?р|₽|руб)/); if(m) set('bud',m[1].trim()+' '+(m[2].startsWith('млн')?'млн ₽':m[2].startsWith('тыс')?'тыс ₽':'₽'));
    m=t.match(/\+?\d[\d\s\-()]{9,}\d/); if(m) set('con',m[0].replace(/\D/g,'').replace(/^(\d)(\d{3})\d{3}(\d{2})(\d{2})$/,'+$1 $2 ***-**-$4'));
    m=t.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if(m) set('con',m[0].replace(/^(.).*(@.*)$/,'$1***$2'));
    if(S.res&&(S.task||S.obj)){ const need=/учёт|учет/.test(S.task)||!S.task; set('sol',need?'учёт + аналитика':'энергоаудит + мониторинг'); }
    return ch;
  }
  async function getDemoReply(text){
    const l=text.toLowerCase(); const ch=extract(text); drawSum(ch);
    if(/сколько|цен|стоим|прайс/.test(l)&&!S.con) return 'Точная цена зависит от числа объектов и приборов, поэтому её считает менеджер. '+(S.obj?'':'Скажите, сколько у вас объектов и какой ресурс нужно учитывать? ')+'Я подготовлю для него краткое резюме.';
    if(S.con&&!handed){ handed=true; drawSum('con'); return 'Спасибо, контакты получены. Передаю менеджеру резюме: '+[S.obj,S.res,S.sol].filter(Boolean).join(', ')+'. Он свяжется с вами в рабочее время и подготовит расчёт.'; }
    if(handed) return 'Менеджер уже получил резюме. Если нужно что-то добавить, напишите, я допишу в карточку.';
    if(!S.obj&&!S.res) return 'Понял. Уточню: что именно нужно учитывать (электричество, тепло, воду, газ) и на скольких объектах?';
    if(!S.res) return 'Какой ресурс в приоритете: электричество, тепло, вода или газ?';
    if(!S.obj) return 'Сколько у вас объектов и какого типа: склады, офисы, производство?';
    if(!S.task) return 'Что важнее: видеть расход онлайн или снизить затраты? Можно и то и другое.';
    if(!S.bud&&!S.con) return 'Для вашей задачи подойдёт связка: '+S.sol+'. Решение МТС: приборы учёта с цифровым выходом и аналитика расхода, чтобы находить потери. Оставьте телефон или e-mail, и менеджер подготовит расчёт.';
    return 'Принято. Оставьте телефон или e-mail, и я передам менеджеру резюме с расчётом.';
  }
  async function send(text){
    text=text.trim(); if(!text||busy) return; busy=true; btn.disabled=true; chips.classList.add('gone');
    addLine('me',text); inp.value='';
    await wait(250); await think();
    const a=await getDemoReply(text); await stream(a);
    busy=false; btn.disabled=false; inp.focus({preventScroll:true});
  }
  form.addEventListener('submit',e=>{ e.preventDefault(); send(inp.value); });
  async function intro(){
    if(started) return; started=true; busy=true;
    await stream('Здравствуйте! Я консультант EnergyTool. Расскажите, что хотите учитывать или на чём сэкономить, и я подберу решение МТС.');
    busy=false;
    const ex=['12 складов, хотим видеть расход электричества','Как снизить затраты на тепло в офисах?','Сколько это стоит?'];
    chips.innerHTML=ex.map((t,i)=>`<button type="button" style="animation-delay:${i*120}ms">${t}</button>`).join('');
    chips.onclick=e=>{ const b=e.target.closest('button'); if(b) send(b.textContent); };
  }
  new IntersectionObserver((es,o)=>{ if(es[0].isIntersecting){ o.disconnect(); setTimeout(intro,350); } },{threshold:.4}).observe(document.getElementById('cform'));
})();
