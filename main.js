import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";

const $ = id => document.getElementById(id);
const boot=$('boot'), bootStatus=$('bootStatus'), fpsEl=$('fps'), zoneEl=$('zone');
const joyEl=$('joy'), stickEl=$('stick'), lookEl=$('look'), runEl=$('run'), jumpEl=$('jump'), fireEl=$('fire'), reloadEl=$('reload');
function fatal(title,detail){if(!boot)return;boot.innerHTML=`<strong>${title}</strong><span style="white-space:pre-wrap;max-width:92vw">${detail}</span>`;boot.style.background='#5a1712';boot.style.color='#fff'}
window.addEventListener('error',e=>fatal('JAVASCRIPT ERROR',e.error?.stack||e.message||String(e)));
window.addEventListener('unhandledrejection',e=>fatal('PROMISE ERROR',e.reason?.stack||e.reason||String(e)));

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'})}catch(e){fatal('WEBGL START FAILED',String(e));throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8b9491);
scene.fog=new THREE.Fog(0x8b9491,250,620);
const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.05,700);camera.position.set(0,1.72,12);

const hemi=new THREE.HemisphereLight(0xf8f4e9,0x6a6257,2.45);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffdfbd,3.05);sun.position.set(-120,180,95);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-250;sun.shadow.camera.right=250;sun.shadow.camera.top=250;sun.shadow.camera.bottom=-250;sun.shadow.camera.near=1;sun.shadow.camera.far=520;scene.add(sun);
const fill=new THREE.DirectionalLight(0xd6e6ff,1.15);fill.position.set(140,85,-180);scene.add(fill);

const city=new THREE.Group();scene.add(city);
const buildings=[];
const solids=[];
const detailGroups=[];
const texLoader=new THREE.TextureLoader();
const tc=new Map();
function tex(n){if(!tc.has(n)){const t=texLoader.load(n);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;tc.set(n,t)}return tc.get(n)}
function pbr(base,rough,normal,ao,rep=1,metal=0){const m=new THREE.MeshStandardMaterial({map:tex(base),roughnessMap:tex(rough),normalMap:tex(normal),aoMap:tex(ao),roughness:.78,metalness:metal});for(const t of [m.map,m.roughnessMap,m.normalMap,m.aoMap])t.repeat.set(rep,rep);m.normalScale.set(.48,.48);return m}
const MAT={
  siding:pbr('pbr_siding_basecolor.jpg','pbr_siding_roughness.jpg','pbr_siding_normal.jpg','pbr_siding_ao.jpg',2),
  brick:pbr('pbr_brick_basecolor.jpg','pbr_brick_roughness.jpg','pbr_brick_normal.jpg','pbr_brick_ao.jpg',2),
  asphalt:pbr('pbr_asphalt_basecolor.jpg','pbr_asphalt_roughness.jpg','pbr_asphalt_normal.jpg','pbr_asphalt_ao.jpg',6),
  concrete:pbr('pbr_concrete_basecolor.jpg','pbr_concrete_roughness.jpg','pbr_concrete_normal.jpg','pbr_concrete_ao.jpg',2),
  rust:pbr('pbr_rust_basecolor.jpg','pbr_rust_roughness.jpg','pbr_rust_normal.jpg','pbr_rust_ao.jpg',2,.12),
  roof:new THREE.MeshStandardMaterial({color:0x3a3b3a,roughness:.9}),
  trim:new THREE.MeshStandardMaterial({color:0x464746,roughness:.82}),
  dark:new THREE.MeshStandardMaterial({color:0x182025,roughness:.45,metalness:.04}),
  glass:new THREE.MeshStandardMaterial({color:0x5e7378,roughness:.2,metalness:.05}),
  wood:new THREE.MeshStandardMaterial({color:0x735d4b,roughness:.9}),
  grass:new THREE.MeshStandardMaterial({color:0x52634a,roughness:.98}),
  dirt:new THREE.MeshStandardMaterial({color:0x5b5146,roughness:1}),
  metal:new THREE.MeshStandardMaterial({color:0x5f6260,roughness:.54,metalness:.58}),
  yellow:new THREE.MeshStandardMaterial({color:0xc0ad65,roughness:.8}),
  white:new THREE.MeshStandardMaterial({color:0xd1d0c9,roughness:.84}),
  black:new THREE.MeshStandardMaterial({color:0x111416,roughness:.66})
};

function addMesh(parent,g,x,y,z,rx=0,ry=0,rz=0){g.position.set(x,y,z);g.rotation.set(rx,ry,rz);parent.add(g);if(g.isMesh){g.castShadow=true;g.receiveShadow=true}return g}
function box(parent,w,h,d,mat,x,y,z,rx=0,ry=0,rz=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cyl(parent,r,h,mat,x,y,z,seg=14){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function slab(parent,w,d,mat,x,z,y=.03){return box(parent,w,.045,d,mat,x,y,z)}
function addSolid(g,x,z,w,d,h){g.userData.solid={minX:x-w/2-0.25,maxX:x+w/2+0.25,minZ:z-d/2-0.25,maxZ:z+d/2+0.25,minY:0,maxY:h+0.3};buildings.push(g)}
function windowUnit(g,x,y,z,w=1.5,h=1.3,mat=MAT.dark){box(g,w,h,.09,mat,x,y,z);box(g,w+.20,.08,.13,MAT.trim,x,y+h/2+.06,z);box(g,w+.20,.08,.13,MAT.trim,x,y-h/2-.06,z);box(g,.09,h+.18,.13,MAT.trim,x-w/2-.06,y,z);box(g,.09,h+.18,.13,MAT.trim,x+w/2+.06,y,z);box(g,.045,h-.14,.11,MAT.trim,x,y,z-.045)}
function door(g,x,y,z,w=1,h=2.2){box(g,w,h,.13,MAT.wood,x,y,z);box(g,.07,h+.09,.17,MAT.trim,x-w/2-.045,y,z);box(g,.07,h+.09,.17,MAT.trim,x+w/2+.045,y,z);box(g,.62,.60,.08,MAT.glass,x,y+.42,z-.075);cyl(g,.045,.07,MAT.yellow,x+w*.31,y,z-.12,10).rotation.z=Math.PI/2}
function gutter(g,x,z,h){box(g,.12,h,.12,MAT.trim,x,h/2+.25,z);box(g,.75,.10,.11,MAT.trim,x-.35,h+.25,z)}
function exteriorAC(g,x,y,z){box(g,1.25,.68,.52,MAT.metal,x,y,z);box(g,1.03,.33,.08,MAT.dark,x,y,z-.28);for(let i=-3;i<=3;i++)box(g,.045,.25,.07,MAT.yellow,x+i*.14,y,z-.34)}
function porch(g,x,z,w){box(g,w,.13,.75,MAT.wood,x,.78,z);for(let i=0;i<3;i++)box(g,.10,.55,.10,MAT.trim,x-w/2+.18+i*(w-.36)/2,.33,z+.22)}
function roofCap(g,w,d,y){box(g,w+.35,.25,d+.35,MAT.trim,0,y,0);box(g,w+.1,.10,d+.1,MAT.roof,0,y+.16,0)}
function signBoard(g,x,y,z,w,h){box(g,w,h,.12,MAT.wood,x,y,z);box(g,w+.08,.06,.15,MAT.trim,x,y+h/2+.03,z-.01);box(g,w+.08,.06,.15,MAT.trim,x,y-h/2-.03,z-.01)}
function windowGrid(g,x,y,z,w,h,cols,rows){const panelW=w/cols,panelH=h/rows;for(let c=0;c<cols;c++)for(let r=0;r<rows;r++)windowUnit(g,x-w/2+panelW/2+c*panelW,y-h/2+panelH/2+r*panelH,z,panelW-.16,panelH-.16)}

function buildHouse(x,z,style=0,front=-1){
  const g=new THREE.Group();g.position.set(x,0,z);city.add(g);detailGroups.push(g);
  const w=10+(style%2)*2,d=8.5+(style%3),h=4.1;
  addSolid(g,x,z,w,d,h);
  slab(g,w+1.5,d+1.5,MAT.concrete,0,0,.11);
  box(g,w,h,d,style===1?MAT.siding:MAT.brick,0,h/2,0);
  roofCap(g,w,d,h+.02);
  // shallow pitched roof silhouette without enormous camera-blocking geometry
  const ridge=new THREE.Mesh(new THREE.BufferGeometry(),MAT.roof);
  // low-profile two-slope proxy: two boxes, not giant planes
  box(g,w+.25,.16,d*.52,MAT.roof,0,h+.28,-d*.24,-.10,0,0);
  box(g,w+.25,.16,d*.52,MAT.roof,0,h+.28,d*.24,.10,0,0);
  const zf=front*(d/2+.065);
  windowUnit(g,-w*.27,2.55,zf,1.65,1.35);windowUnit(g,w*.27,2.55,zf,1.65,1.35);door(g,0,1.28,zf-.045,1.02,2.3);
  porch(g,0,zf-front*.40,3.2);gutter(g,-w/2-.28,front>0?d/2-.08:-d/2+.08,h);gutter(g,w/2+.28,front>0?d/2-.08:-d/2+.08,h);
  exteriorAC(g,w/2+.55,2.0,.65*front);box(g,1.25,.70,.65,MAT.wood,w/2+.55,.38,.9);
  // side windows
  windowUnit(g,w/2+.055,2.45,-1.3,1.25,1.25,MAT.dark);windowUnit(g,-w/2-.055,2.45,1.2,1.25,1.25,MAT.dark);
  return g;
}
function buildShop(x,z,brick=true,front=-1){
  const g=new THREE.Group();g.position.set(x,0,z);city.add(g);detailGroups.push(g);
  const w=18,d=12,h=5.2;addSolid(g,x,z,w,d,h);slab(g,w+1.4,d+1.4,MAT.concrete,0,0,.11);box(g,w,h,d,brick?MAT.brick:MAT.siding,0,h/2,0);roofCap(g,w,d,h+.02);
  const fz=front*(d/2+.065);box(g,12.8,3.0,.11,MAT.glass,0,2.65,fz);for(let i=-6;i<=6;i+=2)box(g,.08,3.2,.15,MAT.trim,i,2.65,fz-.035);door(g,-6.7,1.5,fz-.04,.95,2.6);door(g,6.7,1.5,fz-.04,.95,2.6);box(g,13.0,.12,.85,MAT.wood,0,4.25,fz-.42);signBoard(g,0,4.72,fz-.15,7.0,.72);
  // interior cues visible through glass
  for(let x1=-5;x1<=5;x1+=2.5){box(g,.28,2.0,.35,MAT.trim,x1,1.25,fz+1.0);for(let y1=.55;y1<=1.7;y1+=.55)box(g,1.25,.09,.30,MAT.wood,x1,y1,fz+.72)}
  exteriorAC(g,w/2+.5,3.9,1.2);gutter(g,-w/2-.22,front>0?d/2-.1:-d/2+.1,h);gutter(g,w/2+.22,front>0?d/2-.1:-d/2+.1,h);
  return g;
}
function buildMotel(x,z,front=-1){
  const g=new THREE.Group();g.position.set(x,0,z);city.add(g);detailGroups.push(g);const w=27,d=10,h=5.8;addSolid(g,x,z,w,d,h);slab(g,w+1.5,d+2,MAT.concrete,0,0,.11);box(g,w,h,d,MAT.brick,0,h/2,0);roofCap(g,w,d,h+.02);const fz=front*(d/2+.07);box(g,w-1.2,3.0,.10,MAT.trim,0,2.95,fz);for(let i=-11;i<=11;i+=5){windowUnit(g,i,3.55,fz,2.7,1.35);door(g,i,1.22,fz-.05,1.0,2.2);box(g,3.2,.12,1.0,MAT.wood,i,.72,fz-front*.55)}exteriorAC(g,w/2+.55,4.2,0);for(let i=-11;i<=11;i+=5)box(g,.09,5.0,.09,MAT.trim,i,2.8,-fz);return g;
}
function buildWarehouse(x,z,front=-1){
  const g=new THREE.Group();g.position.set(x,0,z);city.add(g);detailGroups.push(g);const w=25,d=16,h=7.5;addSolid(g,x,z,w,d,h);slab(g,w+1.4,d+1.4,MAT.concrete,0,0,.11);box(g,w,h,d,MAT.brick,0,h/2,0);roofCap(g,w,d,h+.02);const fz=front*(d/2+.07);box(g,7.5,5.0,.12,MAT.dark,-4,3.1,fz);for(let i=-7;i<=-1;i+=1.5)box(g,.08,5.2,.15,MAT.trim,i,3.1,fz-.04);box(g,5.8,4.8,.13,MAT.rust,6.6,2.75,fz);exteriorAC(g,-9,5.4,1);exteriorAC(g,9,5.4,1);for(let i=-8;i<=8;i+=2)box(g,1.0,.10,.45,MAT.wood,i,1.15,-d/2+.6);return g;
}

function car(x,z,rot=0,pick=false){const g=new THREE.Group();g.position.set(x,.03,z);g.rotation.y=rot;city.add(g);const body=new THREE.MeshStandardMaterial({color:pick?0x67655d:0x4e5558,roughness:.7,metalness:.05});box(g,4.7,.72,1.85,body,0,.55,0);box(g,pick?1.9:2.45,.72,1.58,MAT.dark,.35,1.10,0);for(const xx of [-1.6,1.6]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.20,16),MAT.black);w.rotation.z=Math.PI/2;w.position.set(xx,.30,0);g.add(w)}}
function lamp(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);cyl(g,.085,7.0,MAT.trim,0,3.5,0,12);box(g,1.45,.09,.09,MAT.trim,.66,6.85,0);box(g,.32,.18,.24,MAT.yellow,1.28,6.76,0)}
function pole(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);cyl(g,.14,8.8,MAT.trim,0,4.4,0,12);box(g,3.0,.11,.11,MAT.trim,0,7.8,0);for(let i=-1;i<=1;i++)box(g,.17,.16,.17,MAT.trim,i*1.1,7.60,0)}
function hydrant(x,z){cyl(city,.18,.95,MAT.rust,x,.48,z,12);cyl(city,.28,.18,MAT.rust,x,.93,z,12);cyl(city,.09,.22,MAT.rust,x+.23,.7,z,10).rotation.z=Math.PI/2}
function dumpster(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);box(g,3.2,1.5,1.9,MAT.rust,0,.78,0);box(g,3.3,.12,2.05,MAT.trim,0,1.57,0)}
function tree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);city.add(g);cyl(g,.18,2.2,MAT.wood,0,1.1,0,10);const crown=new THREE.Mesh(new THREE.SphereGeometry(1.35,14,10),MAT.grass);crown.position.y=2.65;crown.scale.y=1.25;crown.castShadow=true;g.add(crown)}
function fence(x,z,len,axis='x'){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);for(let i=-len/2;i<=len/2;i+=2.5){if(axis==='x')box(g,.08,1.15,.08,MAT.trim,i,.58,0);else box(g,.08,1.15,.08,MAT.trim,0,.58,i)}if(axis==='x')box(g,len,.08,.08,MAT.trim,0,1.05,0);else box(g,.08,.08,len,MAT.trim,0,1.05,0)}
function streetMark(x,z,w,d){slab(city,w,d,MAT.yellow,x,z,.065)}

const ROAD_SP=54, ROAD_W=13, BLOCK=ROAD_SP-ROAD_W, GRID_MIN=-162, GRID_MAX=162;
function makeGroundAndRoads(){
  // One continuous opaque asphalt base: roads cannot overlap or become transparent.
  slab(city,GRID_MAX-GRID_MIN+40,GRID_MAX-GRID_MIN+40,MAT.asphalt,0,0,-.04);
  const coords=[];for(let i=-3;i<=3;i++)coords.push(i*ROAD_SP);
  // sidewalks as four strips around each usable block; no huge walls.
  for(let ix=-3;ix<3;ix++)for(let iz=-3;iz<3;iz++){
    const cx=ix*ROAD_SP+ROAD_SP/2,cz=iz*ROAD_SP+ROAD_SP/2;
    slab(city,BLOCK,3.0,MAT.concrete,cx,cz-BLOCK/2+.8,.055);
    slab(city,BLOCK,3.0,MAT.concrete,cx,cz+BLOCK/2-.8,.056);
    slab(city,3.0,BLOCK,MAT.concrete,cx-BLOCK/2+.8,cz,.057);
    slab(city,3.0,BLOCK,MAT.concrete,cx+BLOCK/2-.8,cz,.058);
    // grass/interior of lot, with driveway cuts kept inside lot.
    slab(city,BLOCK-4,BLOCK-4,MAT.grass,cx,cz,.048);
    slab(city,5.2,8,MAT.concrete,cx-9,cz-BLOCK/2+3.6,.065);
    slab(city,8,5.2,MAT.concrete,cx-BLOCK/2+3.6,cz+9,.066);
  }
  // lane markings: no centerline at intersection squares, only road spans.
  for(const z of coords)for(let x=GRID_MIN-20;x<GRID_MAX+20;x+=11)slab(city,4.0,.10,MAT.yellow,x,z,.06);
  for(const x of coords)for(let z=GRID_MIN-20;z<GRID_MAX+20;z+=11)slab(city,.10,4.0,MAT.yellow,x,z,.061);
  // crosswalk bars, narrow and flush to road.
  for(const x of coords)for(const z of coords){for(let k=-3;k<=3;k++)slab(city,.75,5.5,MAT.white,x+k*1.35,z-4.0,.067);for(let k=-3;k<=3;k++)slab(city,5.5,.75,MAT.white,x-4.0,z+k*1.35,.068)}
}

function populateCity(){
  makeGroundAndRoads();
  // Residential blocks: two buildings per block with clear setbacks and no overlap.
  for(let ix=-3;ix<3;ix++)for(let iz=-3;iz<3;iz++){
    const cx=ix*ROAD_SP+ROAD_SP/2,cz=iz*ROAD_SP+ROAD_SP/2;
    const central=Math.abs(cx)<82&&Math.abs(cz)<82;
    const industrial=cz>86;
    const motel=cz>86&&ix===2;
    const commercial=central&&((ix+iz)%3===0);
    if(motel) buildMotel(cx,cz,-1);
    else if(industrial&&ix===1) buildWarehouse(cx,cz,-1);
    else if(commercial) buildShop(cx,cz,(ix+iz)&1,-1);
    else {
      buildHouse(cx-7.8,cz-6.8,(ix*2+iz+8)%3,-1);
      if((ix+iz)%2===0) buildHouse(cx+7.8,cz+6.6,(ix+iz+10)%3,1);
      else buildHouse(cx+7.8,cz+6.4,(ix+iz+5)%3,-1);
    }
    // service/life objects remain inside each lot.
    if((ix+iz)%2===0){fence(cx-7,cz+10,14,'x');dumpster(cx+10.0,cz+8.2);tree(cx-10.5,cz-10.5,.85);tree(cx+10.0,cz-10,.72)}
    hydrant(cx-BLOCK/2+1.15,cz-BLOCK/2+1.15);
  }
  // Dedicated street parking. Vehicles are kept on asphalt and never embedded in buildings.
  const parked=[[-136,-10,0,0],[-81,-10,Math.PI,0],[-27,-10,0,1],[27,-10,Math.PI,0],[81,-10,0,0],[136,-10,Math.PI,1],[-136,44,Math.PI/2,0],[136,44,-Math.PI/2,1],[-136,98,Math.PI/2,0],[136,98,-Math.PI/2,0]];
  for(const p of parked)car(...p);
  for(let i=-2;i<=2;i++){lamp(i*ROAD_SP+ROAD_SP/2,-ROAD_W/2-2.2);lamp(i*ROAD_SP+ROAD_SP/2,ROAD_SP*3-ROAD_W/2+2.2)}
  for(let i=-3;i<=3;i++){pole(i*ROAD_SP-18,-148);pole(i*ROAD_SP+18,148)}
  // distant neighborhoods: separate low-rise buildings with actual gaps, never giant wall planes.
  for(let ix=-4;ix<=4;ix++)for(let iz=-4;iz<=4;iz++){
    if(ix>=-3&&ix<3&&iz>=-3&&iz<3)continue;
    const x=ix*ROAD_SP+ROAD_SP/2,z=iz*ROAD_SP+ROAD_SP/2;const g=new THREE.Group();g.position.set(x,0,z);city.add(g);
    const w=12+((ix*7+iz*3)%7+7)%7,d=11+((ix*5+iz*9)%6+6)%6,h=3.6+((ix*3+iz*11)%4+4)%4;
    box(g,w,h,d,((ix+iz)&1)?MAT.siding:MAT.brick,0,h/2,0);roofCap(g,w,d,h+.02);windowUnit(g,0,2.1,-d/2-.06,1.7,1.1);
  }
}
populateCity();

function updateDetailLOD(){
  const p=camera.position;
  for(const g of detailGroups){const dx=g.position.x-p.x,dz=g.position.z-p.z;const d2=dx*dx+dz*dz;g.traverse(o=>{if(o===g||!o.isMesh)return; if(d2>230*230 && o.geometry?.parameters?.width!==undefined && o.geometry.parameters.width<1.0)o.visible=false; else o.visible=true})}
}
function blocked(nx,nz){
  const r=.48;
  for(const g of buildings){const b=g.userData.solid;if(!b)continue;if(nx+r>b.minX&&nx-r<b.maxX&&nz+r>b.minZ&&nz-r<b.maxZ)return true}
  return false;
}
function moveCamera(dx,dz){
  const nx=camera.position.x+dx,nz=camera.position.z+dz;
  if(nx<GRID_MIN-14||nx>GRID_MAX+14||nz<GRID_MIN-14||nz>GRID_MAX+14)return;
  if(!blocked(nx,camera.position.z))camera.position.x=nx;
  if(!blocked(camera.position.x,nz))camera.position.z=nz;
}

const st={yaw:0,pitch:0,vy:0,ground:true,run:false};let ax=0,ay=0,jid=null,jx=0,jy=0,lid=null,lx=0,ly=0;
joyEl.onpointerdown=e=>{jid=e.pointerId;jx=e.clientX;jy=e.clientY;joyEl.setPointerCapture(jid)};
joyEl.onpointermove=e=>{if(e.pointerId!==jid)return;const dx=e.clientX-jx,dy=e.clientY-jy,k=Math.min(1,Math.hypot(dx,dy)/48),a=Math.atan2(dy,dx);ax=Math.cos(a)*k;ay=Math.sin(a)*k;stickEl.style.transform=`translate(${Math.cos(a)*k*42}px,${Math.sin(a)*k*42}px)`};
function joyEnd(){jid=null;ax=ay=0;stickEl.style.transform='translate(0,0)'}joyEl.onpointerup=joyEnd;joyEl.onpointercancel=joyEnd;
lookEl.onpointerdown=e=>{lid=e.pointerId;lx=e.clientX;ly=e.clientY;lookEl.setPointerCapture(lid)};
lookEl.onpointermove=e=>{if(e.pointerId!==lid)return;st.yaw-=(e.clientX-lx)*.004;st.pitch-=(e.clientY-ly)*.003;lx=e.clientX;ly=e.clientY;st.pitch=Math.max(-1.15,Math.min(1.05,st.pitch))};lookEl.onpointerup=()=>lid=null;lookEl.onpointercancel=()=>lid=null;
runEl.onpointerdown=()=>st.run=true;runEl.onpointerup=()=>st.run=false;runEl.onpointercancel=()=>st.run=false;
jumpEl.onpointerdown=()=>{if(st.ground){st.vy=5.4;st.ground=false}};
fireEl.onpointerdown=()=>fireEl.textContent='FIRE •';fireEl.onpointerup=()=>fireEl.textContent='FIRE';
reloadEl.onpointerdown=()=>{reloadEl.textContent='RELOADING';setTimeout(()=>reloadEl.textContent='RELOAD',650)};
const keys={};window.onkeydown=e=>keys[e.code]=1;window.onkeyup=e=>keys[e.code]=0;

let last=performance.now(),frames=0,fpsT=performance.now(),lodTick=0;
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.033,(t-last)/1000);last=t;let sx=ax+(keys.KeyD?1:0)-(keys.KeyA?1:0),sz=ay+(keys.KeyS?1:0)-(keys.KeyW?1:0);const n=Math.hypot(sx,sz);if(n>1){sx/=n;sz/=n}const sp=(st.run||keys.ShiftLeft)?7.6:4.25;const f=new THREE.Vector3(Math.sin(st.yaw),0,Math.cos(st.yaw)),r=new THREE.Vector3(Math.cos(st.yaw),0,-Math.sin(st.yaw));moveCamera((r.x*sx+f.x*sz)*sp*dt,(r.z*sx+f.z*sz)*sp*dt);st.vy-=15*dt;camera.position.y+=st.vy*dt;if(camera.position.y<1.72){camera.position.y=1.72;st.vy=0;st.ground=true}camera.rotation.order='YXZ';camera.rotation.y=st.yaw;camera.rotation.x=st.pitch;if((lodTick++&7)===0)updateDetailLOD();frames++;if(t-fpsT>500){fpsEl.textContent=Math.round(frames*1000/(t-fpsT))+' FPS';frames=0;fpsT=t}const axz=Math.abs(camera.position.x),azz=Math.abs(camera.position.z);zoneEl.textContent=axz<80&&azz<80?'RESIDENTIAL / COMMERCIAL':azz>85?(axz>85?'MOTEL / INDUSTRIAL':'COMMERCIAL'):'RESIDENTIAL';renderer.render(scene,camera)}
requestAnimationFrame(loop);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
if(bootStatus)bootStatus.textContent='CITY ONLINE — REAL STREET GRID / OPAQUE ROADS / PBR / LOD';
setTimeout(()=>{if(boot)boot.style.opacity='.28'},1200);
