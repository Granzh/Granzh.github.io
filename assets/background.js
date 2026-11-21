function createBackground(reduced, effTheme) {
  const VERT=`#version 300 es
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    gl_Position=vec4(p*2.0-1.0,0.0,1.0);
  }`;

  const FRAG=`#version 300 es
  precision highp float;
  uniform vec2  uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform float uScroll;
  uniform float uScrollRaw;
  uniform float uTheme;      // 0 dark .. 1 light
  uniform int   uN;
  uniform float uTop[8];
  uniform float uBot[8];
  uniform float uGapSc[9];
  out vec4 outColor;

  vec3 gBg; vec3 gLi; vec3 gAcc;

  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=0.5; }
    return v;
  }
  mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

  /* technical "paintings": u height-normalised & centred, q css px */
  vec3 paint(vec2 u, vec2 q, int gap, float H){
    float seed=float(gap)*1.37+0.3;
    vec3 col=gBg;

    // topographic contours (always)
    float h=fbm(u*1.5+vec2(seed,seed*0.5))+0.12*sin(u.x*3.0+seed);
    float v=h*16.0;
    float fw=max(fwidth(v),1e-3);
    float fr=fract(v);
    float dist=min(fr,1.0-fr)/fw;
    float cl=1.0-smoothstep(0.4,1.4,dist);
    float idx=floor(v+0.5);
    float strong=step(abs(mod(idx,5.0)),0.5);
    float hi=step(abs(idx-8.0),0.5);
    vec3 lc=mix(gLi,gAcc,hi);
    float la=cl*mix(0.10,0.26,strong)*(1.0+2.4*hi)*mix(1.0,0.6,uTheme);
    col=mix(col,lc,clamp(la,0.0,1.0));

    // dot grid
    float dd=length(fract(q/22.0)-0.5)*22.0;
    col=mix(col,gLi,0.20*smoothstep(1.2,0.5,dd));

    if(gap-(gap/2)*2==0){
      // nested squares mark + viewfinder cross
      vec2 c=u-vec2(0.30,0.02);
      vec2 p=rot(0.52)*c;
      float sd=max(abs(p.x),abs(p.y));
      float r=sd*13.0;
      float f=fract(r);
      float px=min(f,1.0-f)/(13.0/H);
      float ring=1.0-smoothstep(0.6,1.4,px);
      float inside=smoothstep(0.41,0.37,sd);
      float k=floor(r);
      col=mix(col,gAcc,ring*inside*(0.85-0.1*k));
      float cx=(1.0-smoothstep(0.5,1.2,abs(c.y)*H))*step(abs(c.x),0.55);
      float cy=(1.0-smoothstep(0.5,1.2,abs(c.x)*H))*step(abs(c.y),0.55);
      col=mix(col,gLi,max(cx,cy)*0.18);
    } else {
      // ghost code
      float rowH=16.0;
      float ry=floor(q.y/rowH);
      float inRow=fract(q.y/rowH);
      float rowOn=step(0.28,inRow)*step(inRow,0.68);
      float indent=floor(hash(vec2(ry,1.0))*4.0)*18.0+40.0;
      float qx=q.x-indent;
      float seg=floor(qx/9.0);
      float run=hash(vec2(floor(qx/54.0),ry));
      float blk=step(0.22,run)*step(0.30,hash(vec2(seg,ry)+3.7))*step(0.0,qx);
      float fade=smoothstep(0.0,0.3,u.x+0.95)*smoothstep(0.0,0.3,0.95-u.x);
      float hot=step(0.94,hash(vec2(ry,9.0)));
      vec3 cc=mix(gLi,gAcc,hot);
      col=mix(col,gAcc,hot*0.06*step(0.05,inRow)*step(inRow,0.95));
      col=mix(col,cc,rowOn*blk*mix(0.12,0.40,hot)*fade*mix(1.0,0.5,uTheme));
    }
    return col;
  }

  /* torn edge */
  float edgeOff(float x,float seed){
    float qx=floor(x/6.0)*6.0;
    float t=uScrollRaw*0.0008+uTime*0.04;
    float n=fbm(vec2(qx*0.004+seed*7.3,seed*1.9+t));
    float m=fbm(vec2(qx*0.02+seed*3.1,seed+t*2.0));
    float j=hash(vec2(floor(x/4.0),seed))-0.5;
    return (n-0.5)*190.0+(m-0.5)*44.0+j*8.0;
  }

  void main(){
    float H=uRes.y/uDpr, W=uRes.x/uDpr;
    vec2 fc=gl_FragCoord.xy/uDpr;
    float x=fc.x, y=H-fc.y;
    vec2 pp=floor(vec2(x,y)/4.0)*4.0;

    gBg =mix(vec3(16.0,14.0,48.0),vec3(229.0,212.0,237.0),uTheme)/255.0;
    gLi =mix(vec3(161.0,145.0,225.0),vec3(105.0,86.0,126.0),uTheme)/255.0;
    gAcc=mix(vec3(237.0,173.0,209.0),vec3(139.0,52.0,109.0),uTheme)/255.0;
    vec3 paperC=mix(vec3(23.0,21.0,65.0),vec3(244.0,234.0,247.0),uTheme)/255.0;
    vec3 edgeC=mix(vec3(255.0,208.0,232.0),vec3(174.0,113.0,167.0),uTheme)/255.0;

    float s=-10000.0; int gap=0;
    for(int i=0;i<8;i++){
      if(i>=uN) break;
      float ot=edgeOff(pp.x,float(i)*2.0);
      float ob=edgeOff(pp.x,float(i)*2.0+1.0);
      float dt=pp.y-(uTop[i]+ot);
      float db=(uBot[i]+ob)-pp.y;
      s=max(s,min(dt,db));
      if(pp.y>uBot[i]+ob) gap=i+1;
    }

    // painting: parallax 0.5x, glitch rows near the tear
    float rowBand=floor(y/5.0);
    float gb=step(0.84,hash(vec2(rowBand,floor(uScrollRaw/50.0))));
    float nr=smoothstep(60.0,0.0,abs(s));
    float qx=x+gb*nr*(hash(vec2(rowBand,3.0))-0.5)*44.0;
    float qy=y+0.5*(uScroll-uGapSc[gap]);
    vec2 u=(vec2(qx,qy)-vec2(W*0.5,H*0.5))/H;
    vec3 pc=paint(u,vec2(qx,qy),gap,H);
    pc*=0.96+0.08*noise(vec2(x,y)*0.9);
    pc*=1.0-mix(0.55,0.08,uTheme)*pow(length((vec2(x,y)/vec2(W,H))-0.5)*1.2,2.2);
    pc*=1.0-mix(0.55,0.06,uTheme)*smoothstep(-40.0,0.0,s)*step(s,0.0);

    // paper: flat, with a page-anchored dot grid
    vec3 pa=paperC*(0.985+0.03*noise(fc*0.8));
    float pd=length(fract(vec2(x,y+uScrollRaw)/32.0)-0.5)*32.0;
    pa=mix(pa,gLi,0.10*smoothstep(1.1,0.4,pd));

    float inP=step(0.0,s);
    float flick=0.75+0.5*hash(pp*0.37);
    float glow=smoothstep(26.0,0.0,s)*inP;
    float line=smoothstep(3.2,0.8,s)*inP;
    pa=mix(pa,gAcc,clamp(glow*0.20,0.0,1.0));
    pa=mix(pa,mix(gAcc,edgeC,0.35),clamp(line*flick,0.0,1.0));

    outColor=vec4(mix(pc,pa,inP),1.0);
  }`;

  const canvas=document.getElementById('gl'), errEl=document.getElementById('err');
  const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
  let U={}, prog=null;
  function fail(m){ errEl.textContent=m; console.error(m); }
  if(!gl){ fail('WebGL2 is not available in this browser.'); }
  else{
    const mk=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){fail('Shader error:\n'+gl.getShaderInfoLog(s));return null;}return s;};
    const vs=mk(gl.VERTEX_SHADER,VERT), fs=mk(gl.FRAGMENT_SHADER,FRAG);
    if(vs&&fs){
      prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){fail('Link error:\n'+gl.getProgramInfoLog(prog));prog=null;}
      else{ gl.useProgram(prog); ['uRes','uDpr','uTime','uScroll','uScrollRaw','uTheme','uN','uTop','uBot','uGapSc'].forEach(n=>U[n]=gl.getUniformLocation(prog,n)); }
    }
  }

  let DPR=1;
  function resize(){
    DPR=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(innerWidth*DPR); canvas.height=Math.round(innerHeight*DPR);
    if(gl) gl.viewport(0,0,canvas.width,canvas.height);
  }
  addEventListener('resize',resize); resize();

  const tops=new Float32Array(8), bots=new Float32Array(8), gaps=new Float32Array(9);
  const papers=[...document.querySelectorAll('.paper')];
  let sm=scrollY, th=effTheme()==='light'?1:0;

  return function drawBackground(time, height, raw, docHeight) {
    sm+=(raw-sm)*(reduced?1:0.14);
    th+=((effTheme()==='light'?1:0)-th)*(reduced?1:0.12);

    const n=papers.length;
    const tp=[], bp=[];
    for(let i=0;i<n;i++){
      const r=papers[i].getBoundingClientRect();
      tops[i]=r.top; bots[i]=r.bottom; tp.push(r.top+raw); bp.push(r.bottom+raw);
    }
    for(let k=0;k<=n;k++){
      const a=k===0?0:bp[k-1], b=k===n?docHeight:tp[k];
      gaps[k]=Math.max(0,(a+b)/2-height/2);
    }

    if(gl&&prog){
      gl.uniform2f(U.uRes,canvas.width,canvas.height);
      gl.uniform1f(U.uDpr,DPR);
      gl.uniform1f(U.uTime,reduced?0:time*0.001);
      gl.uniform1f(U.uScroll,sm);
      gl.uniform1f(U.uScrollRaw,raw);
      gl.uniform1f(U.uTheme,th);
      gl.uniform1i(U.uN,n);
      gl.uniform1fv(U.uTop,tops);
      gl.uniform1fv(U.uBot,bots);
      gl.uniform1fv(U.uGapSc,gaps);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
  };
}
