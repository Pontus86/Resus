/* ---------- Hand-byggd SSAO + kontur-postprocessing för huvudvyn ----------
   Det här projektet har INGEN postprocessing-pipeline sedan tidigare (ingen EffectComposer,
   ingen RenderPass/SSAOPass/OutlinePass) -- och kan inte enkelt få en heller: three.js egna
   exempel-filer för det (examples/jsm/postprocessing/*) är ES-moduler som importerar 'three'
   som ett namngivet modul-specifikationer, medan HELA resten av den här sajten (alla <script>-
   taggar, alla globala funktioner som ensureBrain3D/setBrain3DClip osv, window.BRAIN3D_OBJ) bygger
   på att three.js laddas som EN global UMD-bundle (lib/three.min.js) utan modulsystem eller
   bundler (statisk file://-sajt, se kommentarerna i brain3d.js om varför fetch() undviks
   överallt). Att byta till ES-moduler bara för postprocessingen hade inneburit att brygga om
   HELA sidans skript-laddning -- en mycket större, mer riskabel arkitekturändring än själva
   rendering-funktionen. Löser det i stället med en egen, minimal, beroendefri composer skriven
   i samma stil (globala funktioner via <script>-tagg) som resten av filerna här.

   Tekniken:
   1. Rendera huvudscenen till en offscreen WebGLRenderTarget MED djup- och stencilbuffert
      (stencilBuffer:true är KRITISKT -- annars slutar hela cap-systemet i brain3d.js fungera,
      se _buildStencilCaps/_addToBulkOutlineStencil).
   2. Ett enda fullskärms-quad-pass läser av färg + djup från det, och:
      - rekonstruerar view-space-position/normal ur djupet (via skärmrymds-derivator -- undviker
        ett HELT EXTRA scenrender-pass bara för normal-bufferten, se prestandakraven i
        specifikationen: minimera draw calls),
      - kör enkel hemisfär-SSAO (16 sampel) mot djupbufferten,
      - känner av kanter (djup-diskontinuitet) för konturlinjen,
      - kombinerar båda och ritar till skärmen. */

const BRAIN3D_POST_VERTEX_SHADER = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRAIN3D_POST_FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform mat4 uProjectionMatrixInv;
uniform mat4 uProjectionMatrix;
uniform vec2 uResolution;
uniform float uAoStrength;
uniform float uAoRadius;
uniform float uAoBias;
uniform float uOutlineOpacity;
uniform vec3 uOutlineColor;
uniform vec3 uKernel[16];
varying vec2 vUv;

float readDepth(vec2 uv){ return texture2D(tDepth, uv).r; }

vec3 viewPosFromDepth(vec2 uv, float depth){
  float z = depth*2.0-1.0;
  vec4 clip = vec4(uv*2.0-1.0, z, 1.0);
  vec4 view = uProjectionMatrixInv * clip;
  return view.xyz/view.w;
}

void main(){
  vec4 base = texture2D(tDiffuse, vUv);
  float depth = readDepth(vUv);
  // Bakgrund (djup vid fjärranklippsplanet) -- ingen AO/kontur att räkna ut där.
  if(depth >= 0.9999){ gl_FragColor = base; return; }

  vec3 viewPos = viewPosFromDepth(vUv, depth);

  // --- SSAO: enkel hemisfär-kärna runt viewPos, testar mot djupbufferten. Normalen behövs bara
  // för att orientera kärnan ungefär mot ytan -- rekonstrueras via skärmrymds-derivator av
  // viewPos i stället för ett separat normal-buffer-pass (billigare, se filkommentaren). ---
  vec3 viewNormal = normalize(cross(dFdx(viewPos), dFdy(viewPos)));
  float occlusion = 0.0;
  for(int i=0;i<16;i++){
    vec3 samplePos = viewPos + uKernel[i]*uAoRadius*sign(dot(uKernel[i],viewNormal)+0.001);
    vec4 offset = uProjectionMatrix * vec4(samplePos,1.0);
    offset.xyz /= offset.w;
    vec2 sampleUv = offset.xy*0.5+0.5;
    if(sampleUv.x<0.0||sampleUv.x>1.0||sampleUv.y<0.0||sampleUv.y>1.0) continue;
    float sampleDepth = readDepth(sampleUv);
    vec3 sampleViewPos = viewPosFromDepth(sampleUv, sampleDepth);
    float rangeCheck = smoothstep(0.0,1.0, uAoRadius/max(0.0001,abs(viewPos.z-sampleViewPos.z)));
    occlusion += (sampleViewPos.z >= samplePos.z+uAoBias ? 1.0 : 0.0) * rangeCheck;
  }
  float ao = 1.0 - clamp((occlusion/16.0)*uAoStrength, 0.0, 1.0);

  // --- Kontur: dels djup-diskontinuitet mellan grannpixlar (Sobel-liknande) för organens
  // 3D-siluetter, dels FÄRG-diskontinuitet för snittytornas (lockens) inbördes gränser --
  // två olika strukturers lock i samma snittplan ligger på nästan EXAKT samma djup (bara en
  // enstaka epsilon isär, för att undvika z-fighting, se BRAIN3D_CAP_EPS), så rent djupbaserad
  // kantdetektering ser praktiskt taget ingen gräns alls där, trots att färgerna är helt olika
  // (upptäckt: Atlas-stilens konturer -- också djupbaserade -- löste inte detta). Färgkanten
  // begränsas till "platta" ytor (nästan noll djupgradient) för att inte rita falska linjer
  // längs toon-materialets egna, i sig SKARPA, gradientband på den böjda 3D-ytan (som har en
  // riktig, betydande djupgradient, till skillnad från ett plant lock rakt framifrån). ---
  vec2 texel = 1.0/uResolution;
  float dRight = readDepth(vUv+vec2(texel.x,0.0));
  float dLeft  = readDepth(vUv-vec2(texel.x,0.0));
  float dUp    = readDepth(vUv+vec2(0.0,texel.y));
  float dDown  = readDepth(vUv-vec2(0.0,texel.y));
  float depthEdge = abs(dRight-dLeft)+abs(dUp-dDown);

  vec3 cRight = texture2D(tDiffuse, vUv+vec2(texel.x,0.0)).rgb;
  vec3 cLeft  = texture2D(tDiffuse, vUv-vec2(texel.x,0.0)).rgb;
  vec3 cUp    = texture2D(tDiffuse, vUv+vec2(0.0,texel.y)).rgb;
  vec3 cDown  = texture2D(tDiffuse, vUv-vec2(0.0,texel.y)).rgb;
  float colorEdge = length(cRight-cLeft) + length(cUp-cDown);
  // Rått (icke-linjärt) djupbuffert-värde dög inte för platthets-testet -- vid det här
  // kameraavståndet komprimeras HELA scenens djupintervall till väldigt små råa deltavärden
  // (perspektiv-djup är starkt olinjärt), så även den böjda cortex-ytan fick nästan lika litet
  // rått djup-delta som ett riktigt platt lock -- platthetstestet filtrerade praktiskt taget
  // ingenting (upptäckt: identiskt brusigt resultat även efter att tröskeln stramats åt kraftigt).
  // Återanvänder i stället viewPosFromDepth (redan uträknad för SSAO ovan) för att jämföra LINJÄR
  // view-space-Z mellan grannpixlar -- riktiga världsenheter, där ett plant lock verkligen ger
  // ~0 medan cortex-ytans krökning ger ett mätbart, mycket större värde.
  vec3 vR = viewPosFromDepth(vUv+vec2(texel.x,0.0), dRight);
  vec3 vL = viewPosFromDepth(vUv-vec2(texel.x,0.0), dLeft);
  vec3 vU = viewPosFromDepth(vUv+vec2(0.0,texel.y), dUp);
  vec3 vD = viewPosFromDepth(vUv-vec2(0.0,texel.y), dDown);
  float viewZEdge = abs(vR.z-vL.z) + abs(vU.z-vD.z);
  float flatness = 1.0 - smoothstep(0.0015, 0.01, viewZEdge);   // ~1 på platta lock, ~0 på böjd 3D-yta
  float capEdge = smoothstep(0.35, 0.7, colorEdge) * flatness;

  float depthEdgeAmt = smoothstep(0.0006, 0.0025, depthEdge) * uOutlineOpacity;
  float capEdgeAmt = capEdge * uOutlineOpacity;

  vec3 color = base.rgb * ao;
  color = mix(color, uOutlineColor, depthEdgeAmt);
  // Lockens inbördes gränser mörkas i stället mot SIN EGEN (den här pixelns) färg -- inte den
  // gemensamma, fasta konturfärgen -- så en gräns mellan t.ex. talamus och capsula läses som
  // "två olika mörkare nyanser av respektive struktur", inte en enda neutral svart linje.
  color = mix(color, base.rgb * 0.55, capEdgeAmt);
  gl_FragColor = vec4(color, base.a);
}`;

let _brain3dPostFX = null;
function _brain3dBuildAoKernel(){
  const kernel = [];
  for(let i=0;i<16;i++){
    const v = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*0.9+0.1);
    v.normalize();
    let scale = i/16; scale = 0.15 + scale*scale*0.85;   // fler sampel nära origo, glesare långt ut
    v.multiplyScalar(scale);
    kernel.push(v);
  }
  return kernel;
}
// Byggs EN gång (delad shader/uniform-objekt, inga nya allokeringar per bildruta -- se
// prestandakraven i specifikationen), återanvänds/skalas om vid canvas-storleksändring.
function ensureBrain3DPostFX(renderer){
  if(_brain3dPostFX) return _brain3dPostFX;
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const dpr = renderer.getPixelRatio();
  const w = Math.max(1, Math.floor(size.x*dpr)), h = Math.max(1, Math.floor(size.y*dpr));

  // DepthStencilFormat + UnsignedInt248Type -- den kombinerade 24-bitars djup/8-bitars stencil-
  // texturen som krävs för att ha BÅDE en avläsningsbar djuptextur OCH fungerande stencil-test
  // i samma offscreen-mål. stencilBuffer:true är KRITISKT -- annars fungerar inte lock-systemets
  // stencil-test alls när huvudscenen renderas hit i stället för direkt till skärmen.
  const depthTexture = new THREE.DepthTexture(w, h);
  depthTexture.format = THREE.DepthStencilFormat;
  depthTexture.type = THREE.UnsignedInt248Type;
  const sceneTarget = new THREE.WebGLRenderTarget(w, h, {depthTexture, stencilBuffer:true});

  const quadGeo = new THREE.PlaneGeometry(2,2);
  const os = window.BRAIN3D_RENDER_SETTINGS.outline, aos = window.BRAIN3D_RENDER_SETTINGS.ao;
  const quadMat = new THREE.ShaderMaterial({
    uniforms:{
      tDiffuse:{value:sceneTarget.texture}, tDepth:{value:sceneTarget.depthTexture},
      uProjectionMatrixInv:{value:new THREE.Matrix4()}, uProjectionMatrix:{value:new THREE.Matrix4()},
      uResolution:{value:new THREE.Vector2(w,h)},
      uAoStrength:{value:aos.strength}, uAoRadius:{value:aos.radius}, uAoBias:{value:aos.bias},
      uOutlineOpacity:{value: os.enabled ? os.opacity : 0},
      uOutlineColor:{value:new THREE.Color(os.color[0], os.color[1], os.color[2])},
      uKernel:{value:_brain3dBuildAoKernel()}
    },
    vertexShader: BRAIN3D_POST_VERTEX_SHADER,
    fragmentShader: BRAIN3D_POST_FRAGMENT_SHADER,
    depthTest:false, depthWrite:false
  });
  const quad = new THREE.Mesh(quadGeo, quadMat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  _brain3dPostFX = {sceneTarget, quadMat, quad, quadScene, quadCamera, w, h};
  return _brain3dPostFX;
}
function _brain3dResizePostFX(renderer){
  const fx = _brain3dPostFX;
  if(!fx) return;
  const size = new THREE.Vector2(); renderer.getSize(size);
  const dpr = renderer.getPixelRatio();
  const w = Math.max(1,Math.floor(size.x*dpr)), h = Math.max(1,Math.floor(size.y*dpr));
  if(w===fx.w && h===fx.h) return;
  fx.sceneTarget.setSize(w,h);
  fx.quadMat.uniforms.uResolution.value.set(w,h);
  fx.w=w; fx.h=h;
}
// Ersätter det direkta renderer.render(scene,camera)-anropet i huvudloopen (se ensureBrain3D).
function renderBrain3DPostFX(renderer, scene, camera){
  const fx = ensureBrain3DPostFX(renderer);
  _brain3dResizePostFX(renderer);
  const os = window.BRAIN3D_RENDER_SETTINGS.outline, aos = window.BRAIN3D_RENDER_SETTINGS.ao;
  fx.quadMat.uniforms.uProjectionMatrixInv.value.copy(camera.projectionMatrixInverse);
  fx.quadMat.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
  fx.quadMat.uniforms.uOutlineOpacity.value = os.enabled ? os.opacity : 0;
  fx.quadMat.uniforms.uAoStrength.value = aos.strength;
  fx.quadMat.uniforms.uAoRadius.value = aos.radius;

  const oldTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(fx.sceneTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(oldTarget);
  renderer.render(fx.quadScene, fx.quadCamera);
}
function setBrain3DOutlineEnabled(on){
  window.BRAIN3D_RENDER_SETTINGS.outline.enabled = !!on;
}
function setBrain3DPostFXEnabled(on){
  if(!brain3d)return;
  brain3d.postFXEnabled = !!on;
}
