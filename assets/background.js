function createBackground(reduced, effTheme) {
  const navLabels = [...document.querySelectorAll('#toc a')];
  const VERT=`#version 300 es
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    gl_Position=vec4(p*2.0-1.0,0.0,1.0);
  }`;

  // Both passes use the same GLSL to compute the edge offsets.
  const NOISE_SIZE = 256;
  const EDGE_GLSL=`
  uniform highp sampler2D uNoiseTexture;
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    // At integer lattice coordinates, sample the center of a texel.
    vec2 uv = (cell + f + 0.5) / float(${NOISE_SIZE});
    return textureLod(uNoiseTexture, uv, 0.0).r;
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=0.5; }
    return v;
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

  `;

  const EDGE_FRAG=`#version 300 es
  precision highp float;
  uniform float uTime;
  uniform float uScrollRaw;
  layout(location = 0) out float offset;
  ${EDGE_GLSL}
  void main() {
    float x = floor(gl_FragCoord.x) * 4.0;
    float edgeIndex = floor(gl_FragCoord.y);
    offset = edgeOff(x, edgeIndex);
  }`;

  const PAINT_GLSL=`
  vec3 gBg; vec3 gLi; vec3 gAcc;
  void setPaintPalette() {
    gBg =mix(vec3(16.0,14.0,48.0),vec3(229.0,212.0,237.0),uTheme)/255.0;
    gLi =mix(vec3(161.0,145.0,225.0),vec3(105.0,86.0,126.0),uTheme)/255.0;
    gAcc=mix(vec3(237.0,173.0,209.0),vec3(139.0,52.0,109.0),uTheme)/255.0;
  }

  mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

  /* u is height-normalised and centred. */
  vec3 paint(vec2 u, int gap, float H){
    float seed=float(gap)*1.37+0.3;
    vec3 col=gBg;

    // Domain warping creates irregular ridges and enclosed basins.
    bool withMark = gap % 2 == 0;
    vec2 terrain = u*(withMark ? 3.0 : 4.8)+vec2(seed, seed*0.5);
    vec2 warp = vec2(noise(terrain*0.75+5.4), noise(terrain*0.75-3.2));
    vec2 warped = terrain + (warp-0.5)*1.5;
    float h = noise(warped)+0.24*noise(warped*2.03+8.6);
    float v = h*19.0;
    float fw=max(fwidth(v),1e-3);
    float fr=fract(v);
    float dist=min(fr,1.0-fr)/fw;
    float cl=1.0-smoothstep(0.25,1.15,dist);
    float idx=floor(v+0.5);
    float strong=step(abs(mod(idx,5.0)),0.5);
    float light=mix(0.18,0.55,strong)*mix(0.58,1.0,noise(terrain*0.55));
    vec3 lc=mix(gLi,gAcc,strong*0.16);
    col=mix(col,lc,cl*light*mix(1.0,0.65,uTheme));

    if(withMark){
      // nested squares mark + viewfinder cross
      vec2 c=u-vec2(0.30,0.02);
      vec2 p=rot(0.52)*c;
      float sd=max(abs(p.x),abs(p.y));
      float r=sd*13.0;
      float f=fract(r);
      float px=min(f,1.0-f)/(13.0/H);
      float ring=1.0-smoothstep(0.6,1.4,px);
      float inside=(1.0 - smoothstep(0.37,0.41,sd));
      float k=floor(r);
      col=mix(col,gAcc,ring*inside*(0.85-0.1*k));
      float cx=(1.0-smoothstep(0.5,1.2,abs(c.y)*H))*step(abs(c.x),0.55);
      float cy=(1.0-smoothstep(0.5,1.2,abs(c.x)*H))*step(abs(c.y),0.55);
      col=mix(col,gLi,max(cx,cy)*0.18);
    }
    return col;
  }

  `;

  const PAINT_FRAG=`#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform float uScrollRaw;
  uniform float uTheme;
  uniform vec2 uPaintOrigin;
  uniform int uGap;
  out vec4 outColor;

  ${EDGE_GLSL}
  ${PAINT_GLSL}
  void main() {
    setPaintPalette();
    vec2 size = uRes / uDpr;
    vec2 point = (gl_FragCoord.xy + uPaintOrigin) / uDpr;
    vec2 u = (point - size * 0.5) / size.y;
    outColor = vec4(paint(u, uGap, size.y), 1.0);
  }`;

  const FRAG=`#version 300 es
  precision highp float;
  uniform vec2  uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform float uScroll;
  uniform float uScrollRaw;
  uniform float uTheme;      // 0 dark .. 1 light
  uniform vec2  uParallax;
  uniform int   uN;
  uniform float uTop[8];
  uniform float uBot[8];
  uniform float uGapSc[9];
  uniform highp sampler2D uEdgeTexture;
  uniform bool uUseEdgeTexture;
  uniform highp sampler2DArray uPaintTexture;
  uniform bool uUsePaintTexture;
  uniform float uPaintHeight;
  uniform float uPaintPaddingX;
  uniform int uPaintLayer[9];
  uniform float uPaintStart[9];
  uniform int uNavLabelCount;
  uniform vec4 uNavExtent;
  uniform vec4 uNavLabels[${navLabels.length}];
  out vec4 outColor;

  ${EDGE_GLSL}
  ${PAINT_GLSL}
  float edgeAt(float x, int edgeIndex) {
    if (uUseEdgeTexture) {
      return texelFetch(uEdgeTexture, ivec2(int(x * 0.25), edgeIndex), 0).r;
    }
    return edgeOff(x, float(edgeIndex));
  }

  float labelBacking(vec2 point, float edgeY) {
    if (uNavLabelCount == 0
        || any(lessThan(point, uNavExtent.xy - 3.0))
        || any(greaterThan(point, uNavExtent.zw + 3.0))) return 0.0;

    for (int i = 0; i < uNavLabelCount; i++) {
      vec4 label = uNavLabels[i];
      if (edgeY < label.y || edgeY > label.w) continue;
      vec2 margin = min(point - label.xy, label.zw - point);
      float underText = smoothstep(-3.0, 0.0, min(margin.x, margin.y));
      if (underText > 0.0) {
        return underText * (1.0 - smoothstep(4.0, 10.0, abs(point.y - edgeY)));
      }
    }
    return 0.0;
  }

  void main(){
    float H=uRes.y/uDpr, W=uRes.x/uDpr;
    vec2 fc=gl_FragCoord.xy/uDpr;
    float x=fc.x, y=H-fc.y;
    vec2 pp=floor(vec2(x,y)/4.0)*4.0;

    setPaintPalette();
    vec3 paperC=mix(vec3(23.0,21.0,65.0),vec3(244.0,234.0,247.0),uTheme)/255.0;
    vec3 edgeC=mix(vec3(255.0,208.0,232.0),vec3(174.0,113.0,167.0),uTheme)/255.0;

    float s=-10000.0; int gap=0;
    float edgeY = -10000.0;
    for(int i=0;i<8;i++){
      if(i>=uN) break;
      float dt = pp.y - uTop[i];
      int edgeIndex = i * 2;
      if (abs(dt) <= 161.0) {
        dt = pp.y - (uTop[i] + edgeAt(pp.x, edgeIndex));
      }
      // The final sheet continues to the bottom of the page.
      float db = 10000.0;
      if (i < uN - 1) {
        db = uBot[i] - pp.y;
        if (abs(db) <= 161.0) {
          db = (uBot[i] + edgeAt(pp.x, edgeIndex + 1)) - pp.y;
        }
      }
      float paperDistance = min(dt, db);
      if (paperDistance > s) {
        s = paperDistance;
        edgeY = pp.y + (dt < db ? -dt : db);
      }
      if (db < 0.0) gap = i + 1;
    }

    // The contours move behind the page-anchored paper.
    vec2 point = vec2(x, y + 0.5 * (uScroll - uGapSc[gap])) + uParallax;
    vec2 u = (point - vec2(W, H) * 0.5) / H;
    vec3 pc;
    // The choice is uniform across the draw so paint() can use fwidth().
    if (uUsePaintTexture) {
      vec2 paintUV = (point * uDpr + vec2(uPaintPaddingX, -uPaintStart[gap]))
        / vec2(uRes.x + 2.0 * uPaintPaddingX, uPaintHeight);
      pc = textureLod(uPaintTexture, vec3(paintUV, float(uPaintLayer[gap])), 0.0).rgb;
    } else {
      pc = paint(u, gap, H);
    }
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

    vec3 color = mix(pc, pa, inP);
    outColor = vec4(mix(color, paperC, 0.94 * labelBacking(vec2(x, y), edgeY)), 1.0);
  }`;

  const canvas=document.getElementById('gl');
  const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
  if (!gl) {
    canvas.hidden = true;
    return;
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
  }

  const vertex = compileShader(gl.VERTEX_SHADER, VERT);
  if (!vertex) {
    canvas.hidden = true;
    return;
  }

  function createProgram(source) {
    const fragment = compileShader(gl.FRAGMENT_SHADER, source);
    if (!fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }

  const prog = createProgram(FRAG);
  if (!prog) {
    gl.deleteShader(vertex);
    canvas.hidden = true;
    return;
  }
  const edgeProgram = gl.getExtension('EXT_color_buffer_float')
    ? createProgram(EDGE_FRAG)
    : null;
  const paintProgram = createProgram(PAINT_FRAG);
  gl.deleteShader(vertex);

  const U = {};
  for (const name of [
    'uRes', 'uDpr', 'uTime', 'uScrollRaw', 'uScroll', 'uTheme', 'uParallax',
    'uN', 'uTop', 'uBot', 'uGapSc', 'uEdgeTexture', 'uUseEdgeTexture', 'uNoiseTexture',
    'uNavLabelCount', 'uNavExtent', 'uNavLabels[0]',
    'uPaintTexture', 'uUsePaintTexture', 'uPaintHeight', 'uPaintPaddingX', 'uPaintLayer[0]', 'uPaintStart[0]'
  ]) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  // Generate a reproducible tile of lattice values once per WebGL context.
  const noiseValues = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
  let seed = 0x243f6a88;
  for (let i = 0; i < noiseValues.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    noiseValues[i] = seed >>> 24;
  }

  const noiseTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, NOISE_SIZE, NOISE_SIZE, 0,
    gl.RED, gl.UNSIGNED_BYTE, noiseValues);

  const edgeTexture = gl.createTexture();
  // A complete 1x1 texture keeps the sampler valid in direct-rendering mode.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, edgeTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.useProgram(prog);
  gl.uniform1i(U.uEdgeTexture, 0);
  gl.uniform1i(U.uNoiseTexture, 1);

  const edgeFramebuffer = edgeProgram ? gl.createFramebuffer() : null;
  const edgeTime = edgeProgram ? gl.getUniformLocation(edgeProgram, 'uTime') : null;
  const edgeScroll = edgeProgram ? gl.getUniformLocation(edgeProgram, 'uScrollRaw') : null;
  if (edgeProgram) {
    gl.useProgram(edgeProgram);
    gl.uniform1i(gl.getUniformLocation(edgeProgram, 'uNoiseTexture'), 1);
    gl.useProgram(prog);
  }
  const maxEdgeWidth = edgeFramebuffer
    ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0])
    : 0;

  const paintFramebuffer = paintProgram ? gl.createFramebuffer() : null;
  const MAX_PAINT_LAYERS = 3;
  const PAINT_BUDGET = 96 * 1024 * 1024;
  const parallaxMaxX = reduced ? 0 : 24;
  const parallaxMaxY = reduced ? 0 : 16;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

  function createPaintTexture(width, height, layers) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, width, height, layers);
    return texture;
  }

  // Keep the array sampler complete even when direct rendering is used.
  gl.activeTexture(gl.TEXTURE2);
  const emptyPaintTexture = createPaintTexture(1, 1, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(U.uPaintTexture, 2);

  const P = {};
  if (paintProgram) {
    for (const name of ['uRes', 'uDpr', 'uTheme', 'uGap', 'uPaintOrigin', 'uNoiseTexture']) {
      P[name] = gl.getUniformLocation(paintProgram, name);
    }
    gl.useProgram(paintProgram);
    gl.uniform1i(P.uNoiseTexture, 1);
    gl.useProgram(prog);
  }

  const tops = new Float32Array(8);
  const bots = new Float32Array(8);
  const gaps = new Float32Array(9);
  const papers = [...document.querySelectorAll('.paper')];
  const n = Math.min(papers.length, tops.length);
  const edgeRows = Math.max(0, n * 2 - 1);
  const sidebar = matchMedia('screen and (width > 900px) and (height > 510px)');
  const labelRange = document.createRange();
  const labelBoxes = new Float32Array(navLabels.length * 4);
  let DPR = 0;
  let edgeWidth = 0;
  let edgeTextureReady = false;
  let lastEdgeTime = NaN;
  let lastEdgeScroll = NaN;

  const paintSlotGap = new Int32Array(MAX_PAINT_LAYERS);
  const paintSlotStart = new Float32Array(MAX_PAINT_LAYERS);
  const paintLayer = new Int32Array(9);
  const paintStartByGap = new Float32Array(9);
  const neededStart = new Float32Array(9);
  const neededEnd = new Float32Array(9);
  let paintTexture = null;
  let paintHeight = 0;
  let paintPaddingX = 0;
  let paintLayers = 0;
  let paintTheme = -1;

  function resizePaintCache() {
    paintSlotGap.fill(-1);
    if (!paintFramebuffer) return;

    gl.activeTexture(gl.TEXTURE2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, paintFramebuffer);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, null, 0, 0);
    if (paintTexture) gl.deleteTexture(paintTexture);
    paintTexture = null;

    // Bake enough extra area for the full cursor motion to reuse each cached layer.
    paintPaddingX = Math.ceil(parallaxMaxX * DPR);
    const minHeight = canvas.height + 2 * Math.ceil(parallaxMaxY * DPR) + 4;
    const width = canvas.width + 2 * paintPaddingX;
    paintHeight = Math.min(
      Math.max(minHeight, Math.ceil(canvas.height * 1.25) + 4), maxTextureSize, maxViewport[1]
    );
    const layers = Math.min(n + 1, MAX_PAINT_LAYERS,
      Math.floor(PAINT_BUDGET / (4 * width * paintHeight)));
    paintLayers = 0;
    if (canvas.width > 0 && width <= Math.min(maxTextureSize, maxViewport[0])
        && canvas.height > 0 && paintHeight >= minHeight && layers > 0) {
      paintTexture = createPaintTexture(width, paintHeight, layers);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, paintTexture, 0, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        paintLayers = layers;
      } else {
        gl.deleteTexture(paintTexture);
        paintTexture = null;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, paintTexture || emptyPaintTexture);
    gl.activeTexture(gl.TEXTURE0);
  }

  function preparePaintCache(scroll, theme) {
    if (!paintLayers || (theme !== 0 && theme !== 1)) return false;
    if (paintTheme !== theme) {
      paintSlotGap.fill(-1);
      paintTheme = theme;
    }

    const height = canvas.height / DPR;
    let visibleCount = 0;
    let usedSlots = 0;
    paintLayer.fill(-1);
    for (let gap = 0; gap <= n; gap++) {
      // A gap can only begin below the previous bottom and finish before the next.
      // Include maximum torn-edge movement and the four-pixel rounding in FRAG.
      const top = gap === 0 ? 0 : Math.max(0, bots[gap - 1] - 125);
      const bottom = gap === n ? height : Math.min(height, bots[gap] + 125);
      if (top > bottom) {
        neededEnd[gap] = -Infinity;
        continue;
      }
      if (++visibleCount > paintLayers) return false;
      const shift = 0.5 * (scroll - gaps[gap]);
      const first = Math.floor((top + shift - parallaxMaxY) * DPR) - 2;
      const last = Math.ceil((bottom + shift + parallaxMaxY) * DPR) + 2;
      if (last - first > paintHeight) return false;
      neededStart[gap] = first;
      neededEnd[gap] = last;

      for (let slot = 0; slot < paintLayers; slot++) {
        if (paintSlotGap[slot] === gap && paintSlotStart[slot] <= first
            && paintSlotStart[slot] + paintHeight >= last) {
          paintLayer[gap] = slot;
          paintStartByGap[gap] = paintSlotStart[slot];
          usedSlots |= 1 << slot;
          break;
        }
      }
    }

    let baking = false;
    for (let gap = 0; gap <= n; gap++) {
      if (neededEnd[gap] === -Infinity || paintLayer[gap] !== -1) continue;
      if (!baking) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, paintFramebuffer);
        gl.viewport(0, 0, canvas.width + 2 * paintPaddingX, paintHeight);
        gl.useProgram(paintProgram);
        gl.uniform2f(P.uRes, canvas.width, canvas.height);
        gl.uniform1f(P.uDpr, DPR);
        gl.uniform1f(P.uTheme, theme);
        baking = true;
      }
      let slot = 0;
      while (usedSlots & (1 << slot)) slot++;
      // Prefer replacing an old page of this gap over a different gap.
      for (let old = slot; old < paintLayers; old++) {
        if (!(usedSlots & (1 << old)) && paintSlotGap[old] === gap) {
          slot = old;
          break;
        }
      }
      usedSlots |= 1 << slot;
      const origin = Math.floor((neededStart[gap] + neededEnd[gap] - paintHeight) * 0.5);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, paintTexture, 0, slot);
      gl.uniform1i(P.uGap, gap);
      gl.uniform2f(P.uPaintOrigin, -paintPaddingX, origin);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      paintSlotGap[slot] = gap;
      paintSlotStart[slot] = origin;
      paintLayer[gap] = slot;
      paintStartByGap[gap] = origin;
    }

    if (baking) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, paintTexture);
      gl.activeTexture(gl.TEXTURE0);
      gl.useProgram(prog);
    }
    return true;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const widthPixels = Math.round(innerWidth * dpr);
    const heightPixels = Math.round(innerHeight * dpr);
    if (DPR !== dpr || canvas.width !== widthPixels || canvas.height !== heightPixels) {
      DPR = dpr;
      canvas.width = widthPixels;
      canvas.height = heightPixels;
      resizePaintCache();
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

    const width = Math.ceil(canvas.width / (DPR * 4));
    if (!edgeFramebuffer || !edgeRows || width === edgeWidth) return;
    edgeWidth = width;
    lastEdgeTime = NaN;
    edgeTextureReady = false;
    if (edgeWidth < 1 || edgeWidth > maxEdgeWidth) return;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, edgeTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, edgeWidth, edgeRows, 0, gl.RED, gl.FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, edgeFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, edgeTexture, 0);
    edgeTextureReady = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  addEventListener('resize', resize);
  resize();

  let sm = scrollY;
  let th = effTheme() === 'light' ? 1 : 0;
  let targetX = 0;
  let targetY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let previousTime;

  if (!reduced) {
    const allowMotion = matchMedia('(prefers-reduced-motion: no-preference)');
    function resetPointer() {
      targetX = 0;
      targetY = 0;
    }

    addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !allowMotion.matches) return;
      const x = Math.min(innerWidth, Math.max(0, event.clientX)) / innerWidth;
      const y = Math.min(innerHeight, Math.max(0, event.clientY)) / innerHeight;
      targetX = (2 * x - 1) * parallaxMaxX;
      targetY = (2 * y - 1) * parallaxMaxY;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', resetPointer);
    addEventListener('blur', resetPointer);
    allowMotion.addEventListener('change', () => {
      if (allowMotion.matches) return;
      resetPointer();
      parallaxX = 0;
      parallaxY = 0;
    });
  }

  function uploadNavLabels() {
    const count = sidebar.matches ? navLabels.length : 0;
    gl.uniform1i(U.uNavLabelCount, count);
    if (!count) return;

    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let index = 0; index < count; index++) {
      labelRange.selectNodeContents(navLabels[index]);
      const rect = labelRange.getBoundingClientRect();
      labelBoxes.set([rect.left, rect.top, rect.right, rect.bottom], index * 4);
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
    gl.uniform4f(U.uNavExtent, left, top, right, bottom);
    gl.uniform4fv(U['uNavLabels[0]'], labelBoxes);
  }

  return function drawBackground(time, height, raw, docHeight) {
    const elapsed = Math.min(50, time - (previousTime ?? time));
    previousTime = time;
    const follow = 1 - Math.exp(-elapsed / 110);
    parallaxX += (targetX - parallaxX) * follow;
    parallaxY += (targetY - parallaxY) * follow;

    sm += (raw - sm) * (reduced ? 1 : 0.14);
    const targetTheme = effTheme() === 'light' ? 1 : 0;
    th += (targetTheme - th) * (reduced ? 1 : 0.12);
    if (Math.abs(targetTheme - th) < 1 / 65536) th = targetTheme;

    let previousBottom = 0;
    for (let i = 0; i < n; i++) {
      const rect = papers[i].getBoundingClientRect();
      tops[i] = rect.top;
      bots[i] = rect.bottom;
      const top = rect.top + raw;
      gaps[i] = Math.max(0, (previousBottom + top) / 2 - height / 2);
      previousBottom = rect.bottom + raw;
    }
    gaps[n] = Math.max(0, (previousBottom + docHeight) / 2 - height / 2);

    const seconds = reduced ? 0 : Math.fround(time * 0.001);
    const edgeRaw = Math.fround(raw);
    if (edgeTextureReady && (seconds !== lastEdgeTime || edgeRaw !== lastEdgeScroll)) {
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, edgeFramebuffer);
      gl.viewport(0, 0, edgeWidth, edgeRows);
      gl.useProgram(edgeProgram);
      gl.uniform1f(edgeTime, seconds);
      gl.uniform1f(edgeScroll, edgeRaw);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, edgeTexture);
      gl.useProgram(prog);
      lastEdgeTime = seconds;
      lastEdgeScroll = edgeRaw;
    }

    const usePaintTexture = preparePaintCache(Math.fround(sm), th);
    gl.uniform1i(U.uUsePaintTexture, Number(usePaintTexture));
    if (usePaintTexture) {
      gl.uniform1f(U.uPaintHeight, paintHeight);
      gl.uniform1f(U.uPaintPaddingX, paintPaddingX);
      gl.uniform1iv(U['uPaintLayer[0]'], paintLayer);
      gl.uniform1fv(U['uPaintStart[0]'], paintStartByGap);
    }

    gl.uniform1i(U.uUseEdgeTexture, edgeTextureReady ? 1 : 0);
    gl.uniform2f(U.uRes,canvas.width,canvas.height);
    gl.uniform1f(U.uDpr,DPR);
    gl.uniform1f(U.uTime,seconds);
    gl.uniform1f(U.uScroll,sm);
    gl.uniform1f(U.uScrollRaw,edgeRaw);
    gl.uniform1f(U.uTheme,th);
    gl.uniform2f(U.uParallax, parallaxX, parallaxY);
    gl.uniform1i(U.uN,n);
    gl.uniform1fv(U.uTop,tops);
    gl.uniform1fv(U.uBot,bots);
    gl.uniform1fv(U.uGapSc,gaps);
    uploadNavLabels();
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
}
