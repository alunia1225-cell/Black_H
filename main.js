import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";
const $=id=>document.getElementById(id);
const boot=$("boot"), bootStatus=$("bootStatus"), fpsEl=$("fps"), zoneEl=$("zone");
const joyEl=$("joy"), stickEl=$("stick"), lookEl=$("look"), runEl=$("run"), jumpEl=$("jump"), fireEl=$("fire"), reloadEl=$("reload");
function fatal(t,d){ if(boot){boot.innerHTML=`<strong>${t}</strong><span>${d}</span>`;boot.style.background="#520d0d";boot.style.color="#fff";} }
window.addEventListener("error",e=>fatal("JAVASCRIPT ERROR",e.error?.stack||e.message));
window.addEventListener("unhandledrejection",e=>fatal("PROMISE ERROR",String(e.reason)));

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",depth:true,stencil:false});}
catch(e){fatal("WEBGL START FAILED",String(e));throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x4c514f);scene.fog=new THREE.Fog(0x4c514f,150,480);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.05,600);camera.position.set(0,1.72,48);
const world=new THREE.Group();scene.add(world);const city=new THREE.Group();world.add(city);
const hemi=new THREE.HemisphereLight(0xdde4e1,0x51483e,1.9);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffead1,3.1);sun.position.set(-100,150,80);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-160;sun.shadow.camera.right=160;sun.shadow.camera.top=160;sun.shadow.camera.bottom=-160;scene.add(sun);
const fill=new THREE.DirectionalLight(0xaec8ff,0.65);fill.position.set(90,60,-100);scene.add(fill);

const C={road:0x303332,road2:0x383a38,sidewalk:0x817e75,curb:0x5c5b55,asphalt:0x272a28,white:0xd7d4c8,yellow:0xc9a84b,concrete:0x7a766d,brick:0x7a4d3e,redbrick:0x694238,siding:0x7b7d77,wood:0x705947,stucco:0x9a968b,roof:0x30312f,dark:0x252725,glass:0x52676b,glass2:0x26393c,metal:0x5d605c,rust:0x70473b,sign:0xb5a067,green:0x4e5d50,door:0x34332f};
const M={};for(const [k,v] of Object.entries(C))M[k]=new THREE.MeshStandardMaterial({color:v,roughness:k==='glass'||k==='glass2'?.22:.82,metalness:k==='metal'?.55:0});
M.glass.transparent=true;M.glass.opacity=.72;
const texLoader=new THREE.TextureLoader();
const pbrFiles={siding:'pbr_siding',brick:'pbr_brick',asphalt:'pbr_asphalt',concrete:'pbr_concrete',rust:'pbr_rust'};
const pbrTex={};
for(const [key,stem] of Object.entries(pbrFiles)){
  const base=texLoader.load(`${stem}_basecolor.jpg`);const rough=texLoader.load(`${stem}_roughness.jpg`);const normal=texLoader.load(`${stem}_normal.jpg`);const ao=texLoader.load(`${stem}_ao.jpg`);
  for(const t of [base,rough,normal,ao]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(key==='asphalt'?5:3,key==='asphalt'?5:3);}
  if(M[key]){M[key].map=base;M[key].roughnessMap=rough;M[key].normalMap=normal;M[key].aoMap=ao;M[key].normalScale.set(.38,.38);M[key].needsUpdate=true;}
  pbrTex[key]={base,rough,normal,ao};
}
const decalTex={rain:texLoader.load('decal_rain_streaks.png'),grime:texLoader.load('decal_foundation_grime.png'),oil:texLoader.load('decal_oil_stain.png')};
for(const t of Object.values(decalTex)){t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=THREE.SRGBColorSpace;}
const decalMat={
 rain:new THREE.MeshBasicMaterial({map:decalTex.rain,transparent:true,depthWrite:false,opacity:.58}),
 grime:new THREE.MeshBasicMaterial({map:decalTex.grime,transparent:true,depthWrite:false,opacity:.7}),
 oil:new THREE.MeshBasicMaterial({map:decalTex.oil,transparent:true,depthWrite:false,opacity:.58})
};
function uv2(g){if(g.attributes.uv&&!g.attributes.uv2)g.setAttribute('uv2',g.attributes.uv);return g;}
function B(w,h,d,x,y,z,mat,rx=0,ry=0,rz=0,p=city){const geo=uv2(new THREE.BoxGeometry(w,h,d));const m=new THREE.Mesh(geo,M[mat]||mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
function cyl(r,h,x,y,z,mat,p=city){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),M[mat]||mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
function label(text,x,y,z,w=4,h=1.1,rot=0){const c=document.createElement('canvas');c.width=512;c.height=128;const q=c.getContext('2d');q.fillStyle='#191a18';q.fillRect(0,0,512,128);q.strokeStyle='#aaa18b';q.lineWidth=5;q.strokeRect(3,3,506,122);q.fillStyle='#e3d8b9';q.font='bold 42px Arial';q.textAlign='center';q.textBaseline='middle';q.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mm=new THREE.MeshStandardMaterial({map:t,roughness:.55});const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.045),mm);m.position.set(x,y,z);m.rotation.y=rot;city.add(m);return m;}

// ---- Street system: one solid road surface per corridor; no stacked crosswalk slabs ----
const roads=[];
function roadNS(x,width=14){B(width,.08,480,x,.02,0,'road');B(width+.45,.12,480,x,.09,0,'curb');B(4.2,.08,480,x-width/2-2.1,.08,0,'sidewalk');B(4.2,.08,480,x+width/2+2.1,.08,0,'sidewalk');roads.push({x,z:0,dir:'ns',w:width});}
function roadEW(z,width=14){B(480,.08,width,0,.02,z,'road');B(480,.12,width+.45,0,.09,z,'curb');B(480,.08,4.2,0,.08,z-width/2-2.1,'sidewalk');B(480,.08,4.2,0,.08,z+width/2+2.1,'sidewalk');roads.push({x:0,z,dir:'ew',w:width});}
[-96,0,96].forEach(x=>roadNS(x));[-96,0,96].forEach(z=>roadEW(z));
function laneMarksNS(x){for(let z=-225;z<225;z+=12){if(Math.abs(z%96)<18)continue;B(.14,.012,5,x,.095,z,'yellow');}}
function laneMarksEW(z){for(let x=-225;x<225;x+=12){if(Math.abs(x%96)<18)continue;B(5,.012,.14,x,.095,z,'yellow');}}
[-96,0,96].forEach(laneMarksNS);[-96,0,96].forEach(laneMarksEW);
function crosswalk(x,z,orient){const g=new THREE.Group();city.add(g);const n=7, len=10, gap=1.25, stripe=.72;for(let i=0;i<n;i++){if(orient==='ew')B(stripe,.018,len,x+(i-(n-1)/2)*gap,.11,z,'white',0,0,0,g);else B(len,.018,stripe,x,.11,z+(i-(n-1)/2)*gap,'white',0,0,0,g);}return g;}
// Crosswalks sit inside each intersection once, offset from lane centers.
// Crosswalks are added once after the final road layer.

function decal(g,w,h,x,y,z,kind,rx=0,ry=0){const geo=new THREE.PlaneGeometry(w,h);const m=new THREE.Mesh(geo,decalMat[kind]);m.position.set(x,y,z);m.rotation.set(rx,ry,0);g.add(m);return m;}
function facadeWeather(g,w,d,h){decal(g,3.0,1.15,-w*.27,.72,d/2+.07,'grime');decal(g,2.2,2.9,w*.28,3.4,d/2+.075,'rain');decal(g,2.2,2.9,-w*.05,3.6,d/2+.075,'rain');}
function roofHVAC(g,x,z){B(3.2,1.2,2.2,x,.7,z,'metal');B(2.6,.18,1.6,x,.12,z,'dark');B(.18,.9,1.6,x-1.0,.65,z,'rust');}
// ---- architectural helpers ----
function windowsFront(g,x0,y0,z,cols,rows,step,mat='glass2'){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=x0+(c-(cols-1)/2)*step;const y=y0+r*2.75;B(1.65,1.75,.09,x,y,z,mat,0,0,0,g);B(1.78,.11,.12,x,y+1.0,z-.08,'trim',0,0,0,g);B(.10,1.85,.12,x-0.84,y,z-.08,'trim',0,0,0,g);B(.10,1.85,.12,x+0.84,y,z-.08,'trim',0,0,0,g);}}
M.trim=new THREE.MeshStandardMaterial({color:0x2e302d,roughness:.72});
function windowSide(g,x,y,z,rot=0){B(1.55,1.65,.08,x,y,z,'glass2',0,rot,0,g);B(1.7,.1,.11,x,y+.92,z,'trim',0,rot,0,g);}
function roofDetails(g,x,y,z,w,d){B(w*.55,.45,d*.45,x,y,z,'roof');for(let i=-1;i<=1;i++)B(.22,.7,d*.65,x+i*w*.18,y+.45,z,'metal');}
function AC(g,x,y,z){B(1.5,1.0,.65,x,y,z,'metal');B(1.18,.55,.08,x,y,z-.36,'dark');B(.08,.7,.85,x-1.0,y-.1,z,'rust');}
function porch(g,x,z,w=6,d=3){for(const dx of [-w/2+.35,w/2-.35]){B(.3,3.1,.3,x+dx,1.55,z+d/2,'wood',0,0,0,g);B(.3,3.1,.3,x+dx,1.55,z-d/2,'wood',0,0,0,g);}B(w,.3,d,x,3.05,z,'wood',0,0,0,g);B(w,.18,d,x,.2,z,'wood');for(let i=0;i<4;i++)B(.12,1.0,d*.55,x-w/2+.6+i*(w-1.2)/3,.7,z,'metal');}
function roof(g,x,y,z,w,d,style=0){if(style===0){B(w+.5,.28,d+.5,x,y,z,'roof');B(w*.9,.18,d*.9,x,y+.22,z,'dark');}else{B(w+.5,.3,d*.55,x,y,z-d*.2,'roof',.0,0.0,.08);B(w+.5,.3,d*.55,x,y,z+d*.2,'roof',.0,0.0,-.08);}}
function house(type,x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);let w=14,d=12,h=type===1?7.8:6.4;let wall=type===2?'brick':type===3?'stucco':'siding';B(w,h,d,0,h/2,0,wall,0,0,0,g);roof(g,0,h+.2,0,w,d,type===2?1:0);B(3.1,4.8,d/2+.06,0,2.4,0,'door',0,0,0,g);for(const x1 of [-4.4,0,4.4]){B(2.5,2.3,d/2+.08,x1,3.7,0,'glass2',0,0,0,g);B(2.62,.11,.12,x1,4.98,d/2+.02,'trim',0,0,0,g);B(.1,2.4,.12,x1-1.28,3.7,d/2+.02,'trim',0,0,0,g);B(.1,2.4,.12,x1+1.28,3.7,d/2+.02,'trim',0,0,0,g);}if(type===1){windowsFront(g,-4.2,7.1,d/2+.08,3,1,4.2);B(2.2,2.2,d/2+.1,0,7.2,0,'glass2');}else{windowSide(g,-w/2-.05,3.6,-2.2,Math.PI/2);windowSide(g,w/2+.05,3.6,2.2,-Math.PI/2);}porch(g,0,d/2+1.3,6,2.6);AC(g,w/2+.65,3.2,2.3);facadeWeather(g,w,d,h);B(.9,.7,.25,-w/2-0.45,1.2,d/2+1.2,'metal');B(.9,.1,.25,-w/2-.45,1.65,d/2+1.2,'white');return g;}
function duplex(x,z,rot=0){const g=house(1,x,z,rot);g.scale.set(1.18,1.02,1);B(1.0,2.2,12,x-.4,4.1,z,'trim');return g;}
function storefront(x,z,kind=0,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=20,d=15,h=7.5;B(w,h,d,0,h/2,0,kind?'brick':'stucco',0,0,0,g);B(w-.6,3.6,d/2+.08,0,2.25,0,'glass',0,0,0,g);for(let i=-3;i<=3;i++)B(.16,3.8,.14,i*2.65,2.25,d/2+.03,'trim',0,0,0,g);B(w+.5,.35,d+.5,0,h+.18,0,'roof');B(w*.92,.25,.9,0,h+1.0,d/2+.5,'sign');label(kind?'MART 24':'LAUNDROMAT',x,z*0+5.4,z+d/2+.96,8.5,1.35,rot);for(let i=-3;i<=3;i++){B(.9,1.1,1.0,i*2.4,1.0,-d/2-.35,'dark',0,0,0,g);B(.45,.75,.35,i*2.4,2.0,-d/2-.4,'sign',0,0,0,g);}AC(g,-w/2-0.6,3.2,-2);AC(g,w/2+0.6,3.2,2);B(3.2,3.6,.16,-6.5,2.0,d/2+.12,'glass2');facadeWeather(g,w,d,h);return g;}
function apartment(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=26,d=18,h=18;B(w,h,d,0,h/2,0,'brick',0,0,0,g);B(w+.7,.45,d+.7,0,h+.25,0,'roof');B(w-.8,.5,.9,0,1.0,d/2+.45,'concrete');for(let r=0;r<5;r++)for(let c=0;c<5;c++){const xx=-9+c*4.5,yy=3+r*3.0;B(2.5,1.85,.11,xx,yy,d/2+.12,'glass2',0,0,0,g);B(2.62,.1,.13,xx,yy+1.0,d/2+.08,'trim');B(.1,1.95,.13,xx-1.3,yy,d/2+.08,'trim');B(.1,1.95,.13,xx+1.3,yy,d/2+.08,'trim');}for(let r=0;r<4;r++){B(.55,2.5,d-.8,-w/2-.35,3.0+r*3.1,0,'metal',0,0,0,g);B(.55,2.5,d-.8,w/2+.35,3.0+r*3.1,0,'metal',0,0,0,g);}for(let i=-1;i<=1;i++)AC(g,i*7.5,6.0,-d/2-.8);roofHVAC(g,0,0);facadeWeather(g,w,d,h);return g;}
function office(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=30,d=22,h=26;B(w,h,d,0,h/2,0,'concrete',0,0,0,g);B(w+.6,.35,d+.6,0,h+.2,0,'roof');for(let r=0;r<7;r++)for(let c=0;c<6;c++){const xx=-11.5+c*4.6,yy=3.2+r*3.25;B(3.3,2.25,.12,xx,yy,d/2+.15,'glass2',0,0,0,g);B(3.48,.11,.14,xx,yy+1.2,d/2+.08,'trim');B(.1,2.35,.14,xx-1.7,yy,d/2+.08,'trim');B(.1,2.35,.14,xx+1.7,yy,d/2+.08,'trim');}B(6,5,.22,0,2.5,d/2+.2,'dark');B(4,.5,.4,0,h+.75,d/2+.2,'sign');label('NORTH AVE',x,5.2,z+d/2+.45,7,1.0,rot);for(let i=-2;i<=2;i++)B(.5,1.5,.6,i*5,2.0,-d/2-.45,'metal',0,0,0,g);roofHVAC(g,-5,0);roofHVAC(g,5,0);facadeWeather(g,w,d,h);return g;}
function motel(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=34,d=13,h=8;B(w,h,d,0,h/2,0,'stucco',0,0,0,g);roof(g,0,h+.25,0,w,d,0);for(let i=-5;i<=5;i++){B(2.7,2.5,d/2+.08,i*3.0,3.2,0,'glass2',0,0,0,g);B(.12,2.65,.12,i*3.0-1.4,3.2,d/2+.04,'trim');}B(w,0.4,3.0,0,1.0,d/2+1.1,'concrete');for(let i=-5;i<=5;i++)B(2.2,.18,2.0,i*3,1.45,d/2+1.1,'door');B(3.5,2.5,.25,-12,4.1,d/2+.2,'dark');label('SUNSET MOTOR LODGE',x-12,5.0,z+d/2+.45,10,1.2,rot);for(let i=-1;i<=1;i++)AC(g,i*10,3,-d/2-.6);facadeWeather(g,w,d,h);return g;}
function warehouse(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=32,d=25,h=12;B(w,h,d,0,h/2,0,'brick',0,0,0,g);B(w+.8,.5,d+.8,0,h+.3,0,'roof');for(let i=-2;i<=2;i++){B(5.0,6.0,.16,i*6,4.0,d/2+.14,'dark',0,0,0,g);B(.16,6.2,.18,i*6-2.55,4,d/2+.1,'metal');}B(5.5,7,.22,0,4,d/2+.25,'metal');for(let i=-2;i<=2;i++)AC(g,i*7,7,-d/2-.7);for(let i=-2;i<=2;i++)B(3.0,1.0,2.0,i*5,1.0,d/2+2,'metal');roofHVAC(g,-7,0);roofHVAC(g,7,0);facadeWeather(g,w,d,h);return g;}

function diner(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=22,d=15,h=6.6;B(w,h,d,0,h/2,0,'brick',0,0,0,g);B(w+.5,.28,d+.5,0,h+.15,0,'roof');B(w-1,3.2,.12,0,2.4,d/2+.1,'glass');B(w-.5,.35,1.0,0,h+1.0,d/2+.4,'sign');label('BLUE STAR DINER',x,4.9,z+d/2+.55,9.5,1.2,rot);for(let i=-4;i<=4;i+=2)B(.16,3.35,.14,i,2.4,d/2+.04,'trim');B(3.2,3.6,.18,-7,2.0,d/2+.14,'door');for(let i=-1;i<=1;i++)B(2.0,.7,2.4,i*6,1.0,-d/2-1,'metal');AC(g,9,3,-2);facadeWeather(g,w,d,h);return g;}
function gasStation(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);B(18,5.8,12,0,2.9,0,'stucco',0,0,0,g);B(18.5,.3,12.5,0,6.0,0,'roof');B(17,2.8,.12,0,2.2,6.05,'glass');B(7,.35,7,0,5.8,0,'metal');for(const dx of [-5,5]){cyl(.16,6,dx,3.0,0,'metal',g);B(5,.15,1.2,dx,6.0,0,'metal',0,0,0,g);}for(const x1 of [-5,5]){B(3.2,.35,2.0,x1,2.3,8,'sign');label(x1<0?'FUEL':'MARKET',x+x1,3.0,z+8.15,4.4,.8,rot);}for(const x1 of [-5,0,5]){B(2.5,.18,3.8,x1,.12,7.2,'asphalt');}facadeWeather(g,18,12,5.8);return g;}
function rowhomes(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);for(let i=-1;i<=1;i++){const q=new THREE.Group();g.add(q);B(7.5,8,10,i*8,4.0,0,i===0?'brick':'siding',0,0,0,q);roof(q,i*8,8.2,0,7.8,10,0);B(2.0,3.8,5.05,i*8,2.0,0,'door');B(2.4,2.1,5.08,i*8-2.1,4.0,0,'glass2');B(2.4,2.1,5.08,i*8+2.1,4.0,0,'glass2');B(3.0,.22,2.6,i*8,6.1,5.2,'metal');}return g;}
function autoShop(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=24,d=18,h=7;B(w,h,d,0,h/2,0,'concrete',0,0,0,g);B(w+.4,.35,d+.4,0,h+.2,0,'roof');for(let i=-1;i<=1;i++){B(6.0,5.2,.18,i*7,3.1,d/2+.1,'dark');B(.18,5.4,.2,i*7-3.1,3.1,d/2+.06,'metal');}B(w-.8,.4,1.0,0,h+.9,d/2+.4,'sign');label('RIVERSIDE AUTO',x,5.2,z+d/2+.65,8.5,1.1,rot);for(let i=-1;i<=1;i++)AC(g,i*8,3.4,-d/2-.7);facadeWeather(g,w,d,h);return g;}
function smallOffice(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=18,d=14,h=11;B(w,h,d,0,h/2,0,'stucco');B(w+.4,.3,d+.4,0,h+.2,0,'roof');for(let r=0;r<2;r++)for(let c=-2;c<=2;c++)B(2.4,2.0,.1,c*3.3,3.5+r*3.1,d/2+.1,'glass2');B(3,4.4,.16,0,2.2,d/2+.15,'door');B(1.6,.25,.6,-6,1.0,d/2+.5,'sign');label('MASON & CO.',x-6,1.8,z+d/2+.6,5.5,.85,rot);AC(g,7,3,-2);facadeWeather(g,w,d,h);return g;}

// ---- lots: buildings sit inside blocks with explicit clearance from roads ----
const houseA=(x,z,r)=>house(0,x,z,r);
const houseB=(x,z,r)=>house(1,x,z,r);
const houseC=(x,z,r)=>house(2,x,z,r);
const storeA=(x,z,r)=>storefront(x,z,0,r);
const storeB=(x,z,r)=>storefront(x,z,1,r);
const placements=[
 [houseA,-72,-72,0],[duplex,-40,-70,.08],[houseB,40,-70,.03],[houseC,72,-72,Math.PI],[storeA,-70,-40,0],[storeB,70,-40,.02],
 [apartment,-70,40,.02],[houseA,-40,42,0],[houseB,40,42,Math.PI],[storeB,70,42,0],[motel,-48,70,0],[warehouse,48,70,.01],
 [office,-70,145,0],[apartment,-35,145,0],[storeA,35,145,Math.PI/2],[houseC,72,145,0],
 [houseB,-145,-70,0],[storeB,-145,-35,Math.PI/2],[apartment,-145,40,0],[warehouse,-145,75,Math.PI/2],
 [houseA,145,-70,0],[storeA,145,-35,Math.PI/2],[apartment,145,40,0],[warehouse,145,75,Math.PI/2],
 [office,-72,-145,Math.PI/2],[apartment,-30,-145,Math.PI/2],[storeB,35,-145,Math.PI/2],[motel,75,-145,Math.PI/2],
 [diner,38,-38,.01],[gasStation,-38,38,Math.PI/2],[rowhomes,38,72,0],[autoShop,-38,72,0],[smallOffice,-38,-140,0]
];
// High-density architectural assets replace the former box-like procedural buildings.
async function loadAAAArchitecture(){
  try{
    const {GLTFLoader}=await import("https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js");
    const loader=new GLTFLoader();
    const defs=[
      ["house_detail_A.glb",-72,-72,0,1], ["duplex_detail.glb",-40,-70,.08,1],
      ["house_detail_B.glb",40,-70,.03,1], ["house_detail_A.glb",72,-72,Math.PI,1.05],
      ["store_detail.glb",-70,-40,0,1], ["store_detail.glb",70,-40,.02,1.04],
      ["apartment_detail.glb",-70,40,.02,1], ["house_detail_B.glb",-40,42,0,1],
      ["house_detail_A.glb",40,42,Math.PI,1.04], ["store_detail.glb",70,42,0,1],
      ["motel_detail.glb",-48,70,0,.92], ["warehouse_detail.glb",48,70,.01,1],
      ["office_detail.glb",-70,145,0,1], ["apartment_detail.glb",-35,145,0,.86],
      ["store_detail.glb",35,145,Math.PI/2,.92], ["house_detail_B.glb",72,145,0,1],
      ["house_detail_A.glb",-145,-70,0,1], ["store_detail.glb",-145,-35,Math.PI/2,.9],
      ["apartment_detail.glb",-145,40,0,.9], ["warehouse_detail.glb",-145,75,Math.PI/2,.8],
      ["house_detail_B.glb",145,-70,0,1], ["store_detail.glb",145,-35,Math.PI/2,.9],
      ["apartment_detail.glb",145,40,0,.9], ["warehouse_detail.glb",145,75,Math.PI/2,.8],
      ["office_detail.glb",-72,-145,Math.PI/2,.9], ["apartment_detail.glb",-30,-145,Math.PI/2,.82],
      ["diner_detail.glb",38,-38,.01,.92], ["motel_detail.glb",75,-145,Math.PI/2,.78],
      ["auto_shop_detail.glb",-38,72,0,1.25], ["store_detail.glb",-38,-140,0,.72]
    ];
    for(const [file,x,z,r,scale] of defs){
      const gltf=await new Promise((resolve,reject)=>loader.load(file,resolve,undefined,reject));
      const g=gltf.scene;g.position.set(x,0,z);g.rotation.y=r;g.scale.setScalar(scale);
      g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.roughness=Math.min(.9,(o.material.roughness??.8)+.05);}}});
      city.add(g);
    }
  }catch(e){ console.warn("AAA architecture load failed; retaining street shell",e); }
}
loadAAAArchitecture();

// ---- street furniture / lived-in detail ----
function tree(x,z){const g=new THREE.Group();city.add(g);cyl(.22,3.2,x,1.6,z,'wood',g);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1),new THREE.MeshStandardMaterial({color:0x465447,roughness:1}));crown.position.set(x,4,z);crown.castShadow=true;g.add(crown);}
function hydrant(x,z){cyl(.24,.9,x,.55,z,'rust');cyl(.34,.12,x,.98,z,'rust');cyl(.16,.22,x,1.08,z,'rust');}
function dumpster(x,z){B(4.2,1.7,2.2,x,.85,z,'dark');B(4.4,.18,2.4,x,1.76,z,'metal');for(const dx of [-1.5,1.5])cyl(.28,.35,x+dx,.2,z-.7,'metal');}
function pole(x,z){cyl(.11,9,x,4.5,z,'metal');B(.08,.08,3.2,x,8.6,z,'metal');B(.7,.14,.2,x+.35,8.45,z,'yellow');}
for(const x of [-96,0,96])for(const z of [-96,0,96]){hydrant(x-11,z-11);pole(x+11,z+11);}
for(const p of [[-82,-58],[-28,-58],[30,-58],[82,-58],[-82,58],[-28,58],[30,58],[82,58],[-58,-28],[58,-28],[-58,28],[58,28]])tree(p[0],p[1]);
for(const p of [[-58,-52],[58,-52],[-58,52],[58,52],[52,112],[-52,112],[112,52],[-112,52]])dumpster(p[0],p[1]);
// parked vehicles: simple but physically placed in parking bays, never on crosswalks
function car(x,z,rot=0,pick=false){const g=new THREE.Group();g.position.set(x,.35,z);g.rotation.y=rot;city.add(g);B(pick?4.9:4.5,1.0,2.0,0,.65,0,'dark',0,0,0,g);B(pick?2.5:2.1,1.05,1.75,.25,1.55,0,'metal',0,0,0,g);for(const xx of [-1.55,1.55])for(const zz of [-1.02,1.02])cyl(.32,.22,xx,.3,zz,'dark',g).rotation.z=Math.PI/2;B(1.0,.55,.08,.4,1.55,-.89,'glass2',0,0,0,g);return g;}
for(const p of [[-74,-50,0,0],[-42,-50,0,1],[42,-50,Math.PI,0],[74,-50,Math.PI,1],[-74,50,0,1],[42,50,Math.PI,0],[74,50,Math.PI,1],[-42,50,0,0],[-50,-126,Math.PI/2,0],[50,-126,-Math.PI/2,1]])car(...p);

// ground outside the road network; no giant wall-like backdrop
B(520,.05,520,0,-.04,0,'asphalt');
// repaint roads on top of ground so they remain opaque and continuous
for(const x of [-96,0,96])B(14,.10,480,x,.03,0,'road');for(const z of [-96,0,96])B(480,.10,14,0,.03,z,'road');
// reset crosswalks on top of final road surfaces
for(const x of [-96,0,96])for(const z of [-96,0,96]){crosswalk(x-8.5,z,'ew');crosswalk(x+8.5,z,'ew');crosswalk(x,z-8.5,'ns');crosswalk(x,z+8.5,'ns');}
// subtle road wear decals, placed away from crosswalk centers
for(const p of [[-70,-20,0],[55,-20,.35],[-20,55,.1],[20,-55,.2],[110,-20,.3],[-110,25,.15]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(4.5,2.4),decalMat.oil);m.position.set(p[0],.12,p[1]);m.rotation.x=-Math.PI/2;m.rotation.z=p[2];city.add(m);}

// player / touch controls
let yaw=0,pitch=0,ax=0,ay=0,running=false,fire=false;const keys={};addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
function bindHold(el,down,up=down){if(!el)return;el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);down(e)});el.addEventListener('pointerup',e=>{e.preventDefault();up(e)});el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',e=>{if(e.buttons===0)up(e)});}
bindHold(runEl,()=>running=true,()=>running=false);bindHold(fireEl,()=>fire=true,()=>fire=false);bindHold(reloadEl,()=>{if(bootStatus)bootStatus.textContent='RELOAD';});bindHold(jumpEl,()=>{camera.position.y=2.2;setTimeout(()=>camera.position.y=1.72,180)});
if(joyEl){joyEl.addEventListener('pointerdown',e=>{joyEl.setPointerCapture(e.pointerId)});joyEl.addEventListener('pointermove',e=>{const r=joyEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/(r.width*.42),dy=(e.clientY-cy)/(r.height*.42);const l=Math.hypot(dx,dy),s=Math.min(1,l);if(l) {dx=dx/l*s;dy=dy/l*s;}ax=dx;ay=dy;stickEl.style.transform=`translate(${dx*34}px,${dy*34}px)`});['pointerup','pointercancel','pointerleave'].forEach(ev=>joyEl.addEventListener(ev,()=>{ax=ay=0;stickEl.style.transform='translate(0,0)'}));}
let looking=false,lx=0,ly=0;if(lookEl){lookEl.addEventListener('pointerdown',e=>{looking=true;lx=e.clientX;ly=e.clientY;lookEl.setPointerCapture(e.pointerId)});lookEl.addEventListener('pointermove',e=>{if(!looking)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;yaw-=dx*.004;pitch-=dy*.003;pitch=Math.max(-1.15,Math.min(1.15,pitch));});['pointerup','pointercancel'].forEach(ev=>lookEl.addEventListener(ev,()=>looking=false));}

const clock=new THREE.Clock();let frames=0,last=performance.now();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);let sx=ax,sy=ay;if(keys.KeyA)sx=-1;if(keys.KeyD)sx=1;if(keys.KeyW)sy=-1;if(keys.KeyS)sy=1;const sp=running?12:6.5;const f=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));camera.position.addScaledVector(f,-sy*sp*dt);camera.position.addScaledVector(r,sx*sp*dt);camera.position.x=Math.max(-235,Math.min(235,camera.position.x));camera.position.z=Math.max(-235,Math.min(235,camera.position.z));camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
const zone=Math.abs(camera.position.x)<110&&Math.abs(camera.position.z)<110?'DOWNTOWN / MIXED USE':camera.position.x>110||camera.position.z>110?'OUTSKIRTS / INDUSTRIAL':'RESIDENTIAL / COMMERCIAL';if(zoneEl)zoneEl.textContent=zone;if(bootStatus)bootStatus.textContent='CITY ONLINE — STREET / BUILDINGS';renderer.render(scene,camera);frames++;const now=performance.now();if(now-last>500){if(fpsEl)fpsEl.textContent=Math.round(frames*1000/(now-last))+' FPS';frames=0;last=now;}}
animate();if(boot)boot.remove();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
