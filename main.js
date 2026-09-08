import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";

const $ = id => document.getElementById(id);
const boot = $("boot");
const bootStatus = $("bootStatus");
const fpsEl = $("fps");
const zoneEl = $("zone");
const joyEl = $("joy"), stickEl = $("stick"), lookEl = $("look");
const runEl = $("run"), jumpEl = $("jump"), fireEl = $("fire"), reloadEl = $("reload");

function showFatal(title, detail) {
  boot.innerHTML = `<strong>${title}</strong><span style="white-space:pre-wrap;max-width:92vw">${detail}</span>`;
  boot.style.background = "#430b0b";
  boot.style.color = "#fff";
}
window.addEventListener("error", e => showFatal("JAVASCRIPT ERROR", e.error?.stack || e.message || String(e)));
window.addEventListener("unhandledrejection", e => showFatal("PROMISE ERROR", e.reason?.stack || e.reason || String(e)));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:"high-performance" });
} catch (e) {
  showFatal("WEBGL START FAILED", String(e));
  throw e;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171b1b);
scene.fog = new THREE.Fog(0x171b1b, 80, 330);

const camera = new THREE.PerspectiveCamera(67, innerWidth / innerHeight, 0.05, 500);
camera.position.set(0, 1.72, 19);

renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xa9b4b5, 0x29231e, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd2cbb9, 1.7);
sun.position.set(-80, 110, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const city = new THREE.Group();
world.add(city);

const mat = (color, rough=0.9, metal=0) => new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const roadMat = mat(0x272827,1);
const concreteMat = mat(0x6a6861,1);
const asphaltPatch = mat(0x20211f,1);
const sidingMat = mat(0x77736a,0.98);
const brickMat = mat(0x714f43,0.96);
const roofMat = mat(0x282827,0.95);
const glassMat = new THREE.MeshStandardMaterial({color:0x53656a,roughness:.18,metalness:.05,transparent:true,opacity:.62});
const darkGlass = new THREE.MeshStandardMaterial({color:0x243136,roughness:.2,metalness:.08});
const trimMat = mat(0x3e3b35,.85);
const rustMat = mat(0x684a3c,.92);
const yellowMat = mat(0xb08a43,.85);
const greenMat = mat(0x40564a,.92);

function box(w,h,d,material,x,y,z,rx=0,ry=0,rz=0,parent=city){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z); m.rotation.set(rx,ry,rz); m.castShadow=true; m.receiveShadow=true;
  parent.add(m); return m;
}
function plane(w,d,material,x,y,z,rotX=-Math.PI/2,parent=city){
  return box(w,.035,d,material,x,y,z,rotX,0,0,parent);
}

function road(cx,cz,w=54,d=54){
  plane(w,d,roadMat,cx,.01,cz);
  box(w,.12,3,asphaltPatch,cx,.07,cz-d/2+7);
  box(w,.12,3,asphaltPatch,cx,.07,cz+d/2-7);
  for(let x=cx-w/2+5;x<cx+w/2-4;x+=9) box(4,.018,.16,yellowMat,x,.085,cz);
  box(.14,.15,d,concreteMat,cx-w/2,.075,cz);
  box(.14,.15,d,concreteMat,cx+w/2,.075,cz);
}

function house(x,z,variant=0){
  const g=new THREE.Group(); city.add(g); g.position.set(x,0,z);
  const w=9+variant*1.2, d=8;
  box(w,.35,d,concreteMat,0,.18,0,0,0,0,g);
  box(w,4.1,d,sidingMat,0,2.25,0,0,0,0,g);
  box(w+.35,.35,d+.35,trimMat,0,4.35,0,0,0,0,g);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2.3,4),roofMat);
  roof.rotation.y=Math.PI/4; roof.position.y=5.55; roof.scale.z=.86; roof.castShadow=true; g.add(roof);
  for(const px of [-w*.28,w*.28]){
    box(1.75,1.45,.12,darkGlass,px,2.7,-d/2-.07,0,0,0,g);
    box(1.92,.10,.20,trimMat,px,3.45,-d/2-.08,0,0,0,g);
    box(.10,1.55,.20,trimMat,px,2.7,-d/2-.08,0,0,0,g);
  }
  box(1.15,2.3,.18,trimMat,0,1.32,-d/2-.10,0,0,0,g);
  box(.08,.08,.25,yellowMat,.42,1.42,-d/2-.22,0,0,0,g);
  box(2.4,.16,1.2,trimMat,0,.9,-d/2-.65,0,0,0,g);
  for(let i=0;i<3;i++) box(2.7,.12,.28,concreteMat,0,.58-i*.16,-d/2-.68,0,0,0,g);
  box(1.1,1.0,.7,rustMat,w/2+.42,2.0,-.8,0,0,0,g);
  box(.8,.6,.55,trimMat,-w/2-.4,2.2,1.0,0,0,0,g);
  return g;
}

function shop(x,z,brick=false){
  const g=new THREE.Group(); city.add(g); g.position.set(x,0,z);
  box(14,.45,10,concreteMat,0,.22,0,0,0,0,g);
  box(14,5.0,10,brick?brickMat:sidingMat,0,2.9,0,0,0,0,g);
  box(14.5,.35,10.5,roofMat,0,5.55,0,0,0,0,g);
  box(11.2,3.0,.15,glassMat,0,2.55,-5.08,0,0,0,g);
  box(11.5,.24,.4,trimMat,0,4.2,-5.22,0,0,0,g);
  for(let i=-4;i<=4;i+=2) box(.09,3.1,.22,trimMat,i,2.55,-5.22,0,0,0,g);
  box(2.0,1.1,.25,trimMat,0,4.65,-5.32,0,0,0,g);
  box(3.2,.35,.45,rustMat,5.4,4.0,-5.3,0,0,0,g);
  box(1.4,1.8,.18,trimMat,-5.0,2.15,-5.2,0,0,0,g);
  box(.5,.5,.5,yellowMat,-4.35,2.1,-5.42,0,0,0,g);
  box(1.8,.7,.9,trimMat,5.2,1.0,5.35,0,0,0,g);
  return g;
}

function warehouse(x,z){
  const g=new THREE.Group(); city.add(g); g.position.set(x,0,z);
  box(20,.5,14,concreteMat,0,.25,0,0,0,0,g);
  box(20,7.5,14,brickMat,0,4.2,0,0,0,0,g);
  box(20.5,.4,14.5,roofMat,0,8.15,0,0,0,0,g);
  box(6.5,5.0,.2,darkGlass,0,3.3,-7.15,0,0,0,g);
  box(6.8,.28,.35,trimMat,0,5.95,-7.3,0,0,0,g);
  box(5.6,4.8,.3,rustMat,7.0,2.9,-7.25,0,0,0,g);
  box(1.2,1.2,.9,trimMat,-8,6.5,1.8,0,0,0,g);
  box(1.4,1.0,.8,rustMat,-6,6.8,1.8,0,0,0,g);
  return g;
}

function car(x,z,rot=0,pickup=false){
  const g=new THREE.Group(); city.add(g); g.position.set(x,.05,z); g.rotation.y=rot;
  const body=mat(pickup?0x5c5a52:0x41464a,.7,.05);
  box(4.5,.75,1.75,body,0,.62,0,0,0,0,g);
  box(pickup?2.0:2.5,.8,1.55,darkGlass,.45,1.18,0,0,0,0,g);
  for(const wx of [-1.55,1.55]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.22,16),trimMat);w.rotation.z=Math.PI/2;w.position.set(wx,.38,0);w.castShadow=true;g.add(w)}
  return g;
}

function pole(x,z){
  const g=new THREE.Group();city.add(g);g.position.set(x,0,z);
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,9,10),trimMat);p.position.y=4.5;p.castShadow=true;g.add(p);
  box(3.1,.14,.14,trimMat,0,8.1,0,0,0,0,g);
  box(.35,.22,.35,yellowMat,1.3,7.95,0,0,0,0,g);
}

function dumpster(x,z){
  const g=new THREE.Group();city.add(g);g.position.set(x,0,z);
  box(3,1.5,1.8,rustMat,0,.8,0,0,0,0,g);
  box(3.15,.12,1.95,trimMat,0,1.58,0,0,0,0,g);
}

function buildFallbackCity(){
  // Continuous road/city grid.
  for(let ix=-3;ix<=3;ix++) for(let iz=-3;iz<=3;iz++) road(ix*54,iz*54);
  // Near field: enough geometry to prove the renderer works immediately.
  house(-17,-12,0); house(-5,-12,1); house(8,-12,2);
  house(-17,10,1); house(-5,10,0);
  shop(11,9,false); shop(-18,21,true); warehouse(18,21);
  for(let i=-3;i<=3;i++) { pole(i*54-23,-23); pole(i*54+23,23); }
  for(let i=0;i<12;i++) car(-22+(i%6)*8,-21+Math.floor(i/6)*42,(i%4)*Math.PI/2,i%3===0);
  dumpster(17,-17); dumpster(-18,18);
  // Distant massing keeps the city continuous rather than empty.
  for(let ix=-4;ix<=4;ix++) for(let iz=-4;iz<=4;iz++){
    if(Math.abs(ix)<=3 && Math.abs(iz)<=3) continue;
    const h=8+((ix*17+iz*11)%9+9)%9;
    box(34,h,28,mat(0x383b39,.98),ix*54,h/2,iz*54);
    box(30,h*.55,.12,mat(0x202526,.8),ix*54,h*.52,iz*54-14.1);
  }
}
buildFallbackCity();

const chunks=[];
for(let ix=-3;ix<=3;ix++) for(let iz=-3;iz<=3;iz++){
  const g=new THREE.Group();g.position.set(ix*54,0,iz*54);g.visible=true;world.add(g);
  chunks.push({ix,iz,g});
}

bootStatus.textContent = "RENDERER OK — CITY BASE ONLINE";

const st={yaw:0,pitch:0,vy:0,ground:true,run:false};
let ax=0,ay=0,jid=null,jx=0,jy=0,lid=null,lx=0,ly=0;
joyEl.onpointerdown=e=>{jid=e.pointerId;jx=e.clientX;jy=e.clientY;joyEl.setPointerCapture(jid)};
joyEl.onpointermove=e=>{if(e.pointerId!==jid)return;const dx=e.clientX-jx,dy=e.clientY-jy,k=Math.min(1,Math.hypot(dx,dy)/48),a=Math.atan2(dy,dx);ax=Math.cos(a)*k;ay=Math.sin(a)*k;stickEl.style.transform=`translate(${Math.cos(a)*k*42}px,${Math.sin(a)*k*42}px)`};
function joyEnd(){jid=null;ax=ay=0;stickEl.style.transform="translate(0,0)"}
joyEl.onpointerup=joyEnd; joyEl.onpointercancel=joyEnd;
lookEl.onpointerdown=e=>{lid=e.pointerId;lx=e.clientX;ly=e.clientY;lookEl.setPointerCapture(lid)};
lookEl.onpointermove=e=>{if(e.pointerId!==lid)return;st.yaw-=(e.clientX-lx)*.004;st.pitch-=(e.clientY-ly)*.003;lx=e.clientX;ly=e.clientY;st.pitch=Math.max(-1.3,Math.min(1.2,st.pitch))};
lookEl.onpointerup=()=>lid=null; lookEl.onpointercancel=()=>lid=null;
runEl.onpointerdown=()=>st.run=true; runEl.onpointerup=()=>st.run=false; runEl.onpointercancel=()=>st.run=false;
jumpEl.onpointerdown=()=>{if(st.ground){st.vy=5.5;st.ground=false}};
fireEl.onpointerdown=()=>fireEl.textContent="FIRE •"; fireEl.onpointerup=()=>fireEl.textContent="FIRE";
reloadEl.onpointerdown=()=>{reloadEl.textContent="RELOADING";setTimeout(()=>reloadEl.textContent="RELOAD",650)};
const keys={};
window.onkeydown=e=>keys[e.code]=1; window.onkeyup=e=>keys[e.code]=0;

let last=performance.now(),frames=0,fpsT=performance.now();
function loop(t){
  requestAnimationFrame(loop);
  const d=Math.min(.033,(t-last)/1000); last=t;
  let x=ax+(keys.KeyD?1:0)-(keys.KeyA?1:0);
  let z=ay+(keys.KeyS?1:0)-(keys.KeyW?1:0);
  const n=Math.hypot(x,z); if(n>1){x/=n;z/=n}
  const sp=(st.run||keys.ShiftLeft)?8:4.5;
  const f=new THREE.Vector3(Math.sin(st.yaw),0,Math.cos(st.yaw));
  const rr=new THREE.Vector3(Math.cos(st.yaw),0,-Math.sin(st.yaw));
  camera.position.addScaledVector(rr,x*sp*d);
  camera.position.addScaledVector(f,z*sp*d);
  st.vy-=15*d; camera.position.y+=st.vy*d;
  if(camera.position.y<1.72){camera.position.y=1.72;st.vy=0;st.ground=true}
  camera.rotation.order="YXZ"; camera.rotation.y=st.yaw; camera.rotation.x=st.pitch;
  for(const q of chunks){
    const dd=Math.max(Math.abs(camera.position.x-q.ix*54),Math.abs(camera.position.z-q.iz*54));
    q.g.visible=dd<180;
  }
  frames++;
  if(t-fpsT>500){fpsEl.textContent=Math.round(frames*1000/(t-fpsT))+" FPS";frames=0;fpsT=t}
  zoneEl.textContent=Math.abs(camera.position.x)+Math.abs(camera.position.z)<160?"RESIDENTIAL / COMMERCIAL":"OUTSKIRTS";
  renderer.render(scene,camera);
}
requestAnimationFrame(loop);

window.addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// GLB layer is deliberately secondary. If it fails, the renderer/city remain visible.
(async()=>{
  try{
    bootStatus.textContent="RENDERER OK — LOADING GLB LAYER...";
    const {GLTFLoader}=await import("https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js");
    const loader=new GLTFLoader();
    const cache=new Map();
    const files={
      house_01:"house_01.glb",house_02:"house_02.glb",house_03:"house_03.glb",
      store_pawn:"store_pawn.glb",store_laundromat:"store_laundromat.glb",
      motel_01:"motel_01.glb",warehouse_01:"warehouse_01.glb",
      car_sedan_01:"car_sedan_01.glb",car_pickup_01:"car_pickup_01.glb",
      dumpster_01:"dumpster_01.glb",utility_pole_01:"utility_pole_01.glb"
    };
    async function load(id){
      if(cache.has(id)) return cache.get(id).clone(true);
      const gltf=await loader.loadAsync("./"+files[id]);
      gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
      cache.set(id,gltf.scene);
      return gltf.scene.clone(true);
    }
    // Load only a small near-field set first; never block boot on all 49 chunks.
    const placements=[
      [-17,-15,"house_01"],[-5,-15,"house_02"],[8,-15,"house_03"],
      [-17,9,"house_01"],[-6,10,"house_02"],[10,10,"motel_01"],
      [18,-12,"store_pawn"],[-18,20,"store_laundromat"],[17,21,"warehouse_01"]
    ];
    const g=new THREE.Group();g.position.set(0,0,0);world.add(g);
    for(const [x,z,id] of placements){
      try{const a=await load(id);a.position.set(x,0,z);g.add(a)}catch(e){console.warn("GLB",id,e)}
    }
    bootStatus.textContent="CITY ONLINE — GLB ASSETS LOADED";
    setTimeout(()=>boot.style.opacity=".35",900);
  }catch(e){
    console.warn("GLB layer unavailable; fallback city retained.",e);
    bootStatus.textContent="CITY BASE ONLINE — GLB LAYER UNAVAILABLE";
    boot.style.opacity=".85";
  }
})();
