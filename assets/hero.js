(() => {
  const m=document.getElementById('mark'); let h='';
  for(let i=0;i<7;i++){ const s=40+i*30; h+=`<i style="width:${s}px;height:${s}px;opacity:${1-i*0.11}"></i>`; }

  /* animated hero heading: stroke lettering with triangular cut-outs */
    const G={
      A:{w:92,d:'M6 108L46 -8L86 108M20 66H72',n:[]},
      B:{w:67,d:'M8 0V100M0 8H34A21 21 0 0 1 34 50H0M0 50H38A21 21 0 0 1 38 92H0',n:[['r',16,16],['r',16,58]]},
      D:{w:72,d:'M8 0V100M0 8H22A42 42 0 0 1 22 92H0',n:[['r',16,16]]},
      E:{w:60,d:'M8 0V100M0 8H60M0 50H54M0 92H60',n:[['r',16,16],['r',16,58]]},
      F:{w:62,d:'M8 0V100M0 8H62M0 50H54',n:[['r',16,16],['r',16,58]]},
      G:{w:84,d:'M68 23A34 42 0 1 0 76 54L76 50L46 50',n:[]},
      H:{w:70,d:'M8 0V100M62 0V100M0 50H70',n:[['r',16,58]]},
      I:{w:16,d:'M8 0V100',n:[]},
      L:{w:54,d:'M8 0V100M0 92H54',n:[]},
      M:{w:96,d:'M8 100V0L48 78L88 0V100',n:[]},
      N:{w:76,d:'M8 100V0L68 100V0',n:[]},
      O:{w:88,d:'M8 50A36 42 0 1 1 80 50A36 42 0 1 1 8 50',n:[]},
      P:{w:63,d:'M8 0V100M0 8H34A21 21 0 0 1 34 50H0',n:[['r',16,16],['r',16,58]]},
      R:{w:69,d:'M8 0V100M0 8H38A21 21 0 0 1 38 50H0M34 50L66 112',n:[['r',16,16],['r',16,58]]},
      S:{w:58,d:'M48 20A21 21 0 1 0 29 50A21 21 0 1 1 10 80',n:[]},
      T:{w:66,d:'M0 8H66M33 0V100',n:[['r',41,16]]},
      U:{w:72,d:'M8 0V60A28 32 0 0 0 64 60V0',n:[]},
      V:{w:92,d:'M6 -8L46 108L86 -8',n:[]},
      W:{w:128,d:'M6 -8L34 108L64 0L94 108L122 -8',n:[]},
      Y:{w:80,d:'M4 -8L40 50L76 -8M40 50V100',n:[]}
    };
    const TEXT=['MY','YOUR ENERGY PROBLEMS','WITH OUR LLM ADVISOR'];
    const GAP=40,SPACE=70,LINE=160,ACC='LLM',SLOT=284;
    const isAcc=(line,i)=>line.substr(i,ACC.length)===ACC&&(i===0||line[i-1]===' ');
    const shuffle=n=>{const a=[];for(let i=0;i<n;i++)a.push(i);for(let j=n-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));const t=a[j];a[j]=a[k];a[k]=t;}return a;};
    const widths=TEXT.map(line=>{
      let w=0,first=true;
      for(let i=0;i<line.length;i++){
        const c=line[i];
        if(c===' '){w+=SPACE;first=true;continue;}
        if(isAcc(line,i)){w+=SLOT;i+=ACC.length-1;first=false;continue;}
        if(!first)w+=GAP;
        w+=G[c].w;first=false;
      }
      return w;
    });
    const maxW=Math.max.apply(null,widths);
    const glyphs=[],notches=[],lines=[];let acc={x:0,y:0};
    TEXT.forEach((line,li)=>{
      const y=li*LINE;let x=(maxW-widths[li])/2,first=true;
      lines.push({y:y,cw:maxW+40});
      for(let i=0;i<line.length;i++){
        const c=line[i];
        if(c===' '){x+=SPACE;first=true;continue;}
        if(isAcc(line,i)){acc={x:x,y:y};x+=SLOT;i+=ACC.length-1;first=false;continue;}
        if(!first)x+=GAP;
        const g=G[c];
        glyphs.push({x:x,y:y,path:g.d});
        g.n.forEach(n=>{
          const X=x+n[1],Y=y+n[2];
          notches.push(n[0]==='r'?(X-14)+','+Y+' '+X+','+Y+' '+X+','+(Y+12):X+','+Y+' '+(X+14)+','+Y+' '+X+','+(Y+12));
        });
        x+=g.w;first=false;
      }
    });
    const H=LINE*(TEXT.length-1)+100;
    const gO=shuffle(glyphs.length),nO=shuffle(notches.length),gStep=1.6/glyphs.length;
    const svg=`<svg class="fl-svg" viewBox="0 0 ${maxW} ${H}" role="img" aria-label="New era of solving your energy problems with our LLM advisor"><defs>
  <clipPath id="fl-c">${lines.map(l=>`<rect x="-20" y="${l.y}" width="${l.cw}" height="100"></rect>`).join('')}</clipPath>
  <mask id="fl-m" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${maxW+40}" height="${H+40}"><rect x="-20" y="-20" width="${maxW+40}" height="${H+40}" fill="#fff"></rect>${notches.map((pts,i)=>`<polygon class="fl-n" style="--d:${(4.45+nO[i]*0.05).toFixed(3)}s" points="${pts}" fill="#000"></polygon>`).join('')}</mask></defs>
  <g mask="url(#fl-m)" clip-path="url(#fl-c)">${glyphs.map((g,i)=>`<g transform="translate(${g.x} ${g.y})"><g class="fl-g" style="--d:${(gO[i]*gStep).toFixed(3)}s"><path class="fl-s" d="${g.path}"></path></g></g>`).join('')}</g>
  <g class="fl-acc" transform="translate(${acc.x} ${acc.y})" style="--d:2.2s"><defs><clipPath id="fl-ac"><rect x="0" y="0" width="284" height="100"></rect></clipPath></defs>
  <g class="fl-br" clip-path="url(#fl-ac)"><path pathLength="1" style="--o:0s" d="M0 16.7H284"></path><path pathLength="1" style="--o:.25s" d="M284 50H0"></path><path pathLength="1" style="--o:.5s" d="M0 83.3H284"></path></g>
  <g class="fl-llm" clip-path="url(#fl-ac)"><path class="fl-ls" d="M8 0V100M0 92H54"></path><path class="fl-ls" transform="translate(94 0)" d="M8 0V100M0 92H54"></path><path class="fl-ls" transform="translate(188 0)" d="M8 100V0L48 78L88 0V100"></path></g></g></svg>`;
    const h1=document.getElementById('hh');
    h1.innerHTML=svg;
    const el=h1.firstElementChild;
    setTimeout(()=>el.classList.add('play'),60);
})();
