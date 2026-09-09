import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";

const $=id=>document.getElementById(id);
const boot=$("boot"), bootStatus=$("bootStatus"), fpsEl=$("fps"), zoneEl=$("zone");
const joyEl=$("joy"), stickEl=$("stick"), lookEl=$("look"), runEl=$("run"), jumpEl=$("jump"), fireEl=$("fire"), reloadEl=$("reload");
function fatal(t,d){if(boot){boot.innerHTML=`<strong>${t}</strong><span>${d}</span>`;boot.style.background="#520d0d";boot.style.color="#fff";}}
addEventListener("error",e=>fatal("JAVASCRIPT ERROR",e.error?.stack||e.message));
addEventListener("unhandledrejection",e=>fatal("PROMISE ERROR",String(e.reason)));

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",depth:true,stencil:false});}
catch(e){fatal("WEBGL START FAILED",String(e));throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.42;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x68706f);scene.fog=new THREE.Fog(0x68706f,190,520);
const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.05,650);camera.position.set(0,1.72,42);
const world=new THREE.Group();scene.add(world);const city=new THREE.Group();world.add(city);
scene.add(new THREE.HemisphereLight(0xf2f5f1,0x4f514a,2.25));
const sun=new THREE.DirectionalLight(0xffecd2,3.5);sun.position.set(-120,180,100);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-190;sun.shadow.camera.right=190;sun.shadow.camera.top=190;sun.shadow.camera.bottom=-190;scene.add(sun);
const fill=new THREE.DirectionalLight(0xb8d2ff,.9);fill.position.set(120,70,-120);scene.add(fill);

const C={road:0x252826,sidewalk:0x918d83,curb:0x5c5b55,concrete:0x858077,brick:0x765044,redbrick:0x6b4036,siding:0x777b77,wood:0x665242,stucco:0x9b988e,roof:0x242623,dark:0x181a19,glass:0x527079,metal:0x666964,rust:0x70473b,sign:0xb7a25f,green:0x53614e,trim:0x30322f,door:0x34322e,white:0xd7d3c8,yellow:0xd0ad4b};
const M={};for(const[k,v]of Object.entries(C))M[k]=new THREE.MeshStandardMaterial({color:v,roughness:k==='glass'||k==='glass2'?.24:.78,metalness:k==='metal'?.52:0});M.glass.transparent=true;M.glass.opacity=.72;M.glass2=new THREE.MeshStandardMaterial({color:0x26393c,roughness:.2,metalness:.05});M.glass2.transparent=true;M.glass2.opacity=.9;
const texLoader=new THREE.TextureLoader();
for(const key of ['siding','brick','asphalt','concrete','rust']){const b=texLoader.load(`pbr_${key}_basecolor.jpg`),r=texLoader.load(`pbr_${key}_roughness.jpg`),n=texLoader.load(`pbr_${key}_normal.jpg`),a=texLoader.load(`pbr_${key}_ao.jpg`);for(const t of[b,r,n,a]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(key==='asphalt'?7:4,key==='asphalt'?7:4);}M[key].map=b;M[key].roughnessMap=r;M[key].normalMap=n;M[key].aoMap=a;M[key].normalScale.set(.48,.48);M[key].needsUpdate=true;}
const decalTex={rain:texLoader.load('decal_rain_streaks.png'),grime:texLoader.load('decal_foundation_grime.png'),oil:texLoader.load('decal_oil_stain.png')};for(const t of Object.values(decalTex)){t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;}
const decalMat={rain:new THREE.MeshBasicMaterial({map:decalTex.rain,transparent:true,depthWrite:false,opacity:.55}),grime:new THREE.MeshBasicMaterial({map:decalTex.grime,transparent:true,depthWrite:false,opacity:.65}),oil:new THREE.MeshBasicMaterial({map:decalTex.oil,transparent:true,depthWrite:false,opacity:.5})};

// High-density procedural architecture: BufferGeometry only. No BoxGeometry for buildings.
function meshFromData(name,verts,normals,uvs,indices,mat,parent=city){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));if(normals?.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else g.computeVertexNormals();if(uvs?.length){g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('uv2',new THREE.Float32BufferAttribute(uvs,2));}g.setIndex(indices);g.computeBoundingSphere();const m=new THREE.Mesh(g,M[mat]||mat);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function quad(a,b,c,d,verts,normals,uvs,idx,uvscale=1){const base=verts.length/3;for(const p of[a,b,c,d])verts.push(...p);const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a))).normalize();for(let i=0;i<4;i++)normals.push(n.x,n.y,n.z);uvs.push(0,0,uvscale,0,uvscale,uvscale,0,uvscale);idx.push(base,base+1,base+2,base,base+2,base+3);}
function prismRect(x,z,w,d,y0,y1,mat,bevel=.12,parent=city){const v=[],n=[],u=[],i=[];const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;const yb=y0,yt=y1;quad([x0,yb,z0],[x1,yb,z0],[x1,yt,z0],[x0,yt,z0],v,n,u,i,w/3);quad([x1,yb,z1],[x0,yb,z1],[x0,yt,z1],[x1,yt,z1],v,n,u,i,w/3);quad([x0,yb,z1],[x0,yb,z0],[x0,yt,z0],[x0,yt,z1],v,n,u,i,d/3);quad([x1,yb,z0],[x1,yb,z1],[x1,yt,z1],[x1,yt,z0],v,n,u,i,d/3);quad([x0,yt,z0],[x1,yt,z0],[x1,yt,z1],[x0,yt,z1],v,n,u,i,w/3);quad([x1,yb,z0],[x0,yb,z0],[x0,yb,z1],[x1,yb,z1],v,n,u,i,w/3);return meshFromData('ARCH_'+mat,v,n,u,i,mat,parent);}
function slab(x,z,w,d,y,mat,th=.16,parent=city){return prismRect(x,z,w,d,y,y+th,mat,.05,parent);}
function beam(x,z,w,d,y,h,mat,parent=city){return prismRect(x,z,w,d,y,y+h,mat,.04,parent);}
function facadePanel(x,z,w,d,y,h,mat,parent=city){return prismRect(x,z,w,d,y,y+h,mat,.08,parent);}
function thinPanel(x,z,w,d,y,h,mat,parent=city){return prismRect(x,z,w,d,y,y+h,mat,.035,parent);}
function windowUnit(x,z,y,w,h,rot=0,parent=city){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);thinPanel(0,0,w,.06,0,h,'glass2',g);return g;}

// Thin facade geometry with depth: sill, head, jambs, mullions, inset glass.
function windowFront(x,z,y,w=1.65,h=1.7,rot=0,kind='glass',parent=city){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);const dep=.10;thinPanel(0,0,w,.08,0,h,'glass2',g);beam(0,-h/2-.10,w+.22,dep,0,.12,'trim',g);beam(0,h/2+.10,w+.22,dep,0,.12,'trim',g);beam(-w/2-.10,0,dep,h+.22,0,.12,'trim',g);beam(w/2+.10,0,dep,h+.22,0,.12,'trim',g);beam(0,0,.07,h,0,.07,'trim',g);beam(0,0,w,.07,0,.07,'trim',g);return g;}
function doorFront(x,z,y,w=1.15,h=2.45,rot=0,parent=city){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);thinPanel(0,0,w,.10,0,h,'door',g);beam(0,-h/2-.12,w+.24,.14,0,.14,'trim',g);beam(0,h/2+.12,w+.24,.14,0,.14,'trim',g);beam(-w/2-.10,0,.12,h+.25,0,.14,'trim',g);beam(w/2+.10,0,.12,h+.25,0,.14,'trim',g);facadePanel(0,.35,.62,.55,0,.04,'glass2',g);cyl(0.045,.13,w*.31,.02,h*.05,'metal',g).rotation.z=Math.PI/2;return g;}
function cyl(r,h,x,y,z,mat,parent=city){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),M[mat]||mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function decal(g,w,h,x,y,z,kind,rx=0,ry=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),decalMat[kind]);m.position.set(x,y,z);m.rotation.set(rx,ry,0);g.add(m);return m;}
function AC(g,x,y,z){facadePanel(x,z,1.55,.65,y,1.0,'metal',g);beam(x,z,1.2,.08,y+.25,.55,'dark',g);cyl(.07,.9,x-.9,y+.15,z,'rust',g);}
function gutter(g,x,z,h,side=0){cyl(.075,h,x,h/2+.35,z,'metal',g);beam(x+side*.2,z,.08,.08,h+.1,.08,'metal',g);}
function roofSystem(g,x,z,w,d,h,style=0){if(style===0){slab(x,z,w+1,d+1,h,'roof',.24,g);beam(x,z-d*.46,w+.4,.16,h+.22,.16,'dark',g);for(let i=-1;i<=1;i++)cyl(.12,.65,x+i*w*.2,h+.58,z,'metal',g);}else{slab(x,z-d*.22,w+1,d*.55,h,'roof',.25,g);slab(x,z+d*.22,w+1,d*.55,h,'roof',.25,g);beam(x,z,w+1,.18,h+.32,.14,'dark',g);}}
function porch(g,x,z,w=6,d=2.8){for(const dx of[-w/2+.3,w/2-.3]){cyl(.13,3.0,x+dx,1.5,z+d/2,'wood',g);cyl(.13,3.0,x+dx,1.5,z-d/2,'wood',g);}slab(x,z,w,d,3.0,'wood',.16,g);slab(x,z+d*.55,w,d*.3,.18,'concrete',.12,g);for(let k=0;k<5;k++)cyl(.07,1.0,x-w/2+.5+k*(w-1)/4,.65,z+d/2,'metal',g);}
function weather(g,w,d,h){decal(g,3.2,1.15,-w*.25,.68,d/2+.08,'grime');decal(g,2.0,3.0,w*.24,h*.52,d/2+.08,'rain');}

function sidingCourses(g,w,d,h,front=true){for(let y=.85;y<h-.2;y+=.62){beam(0,front?d/2+.045:-d/2-.045,w-.35,.045,y,.035,'trim',g);}for(let x=-w/2+.5;x<w/2-.1;x+=.75){beam(x,front?d/2+.05:-d/2-.05,.035,.045,.35,.035,'trim',g);}}
function brickCourses(g,w,d,h){for(let y=.55;y<h-.15;y+=.42){beam(0,d/2+.055,w-.25,.035,y,.025,'rust',g);beam(0,-d/2-.055,w-.25,.035,y,.025,'rust',g);}for(let x=-w/2+.35;x<w/2;x+=1.05){beam(x,d/2+.065,.025,.035,.3,.025,'dark',g);}}
function houseAsset(x,z,rot=0,variant=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=[15,17,13.5,19][variant%4],d=[12,11,14,10][variant%4],h=variant===3?8.2:7.0;const wall=['siding','brick','stucco','siding'][variant%4];facadePanel(0,0,w,d,0,h,wall,g); // structural base
  if(wall==='brick')brickCourses(g,w,d,h); else sidingCourses(g,w,d,h,true);
  // facade articulation: plinth, corner boards, horizontal breaks
  beam(0,d/2+.02,w,.24,0,.55,'concrete',g);for(const sx of[-w/2+.14,w/2-.14])beam(sx,d/2+.04,.20,.20,0,h+.05,'trim',g);
  const cols=variant===1?4:3;for(let i=0;i<cols;i++){const xx=(i-(cols-1)/2)*(w/(cols+.2));windowFront(xx,d/2+.08,3.65,2.45,2.25,0,'glass',g);}doorFront(0,d/2+.11,1.35,1.25,2.6,0,g);
  for(let i=0;i<3;i++)windowFront(-w/2-.07,-3.2+i*3.0,3.55,2.2,2.15,Math.PI/2,'glass',g);
  porch(g,0,d/2+1.4,variant===3?7:6,2.7);roofSystem(g,0,0,w,d,h,variant%2);gutter(g,-w/2-.2,d/2-.3,h);gutter(g,w/2+.2,d/2-.3,h);AC(g,w/2+.65,3.0,-2.4);beam(-w/2-.7,-d/2-.4,.8,.8,.9,.6,'metal',g);weather(g,w,d,h);return g;}
function duplexAsset(x,z,rot=0){const g=houseAsset(x,z,rot,3);g.scale.set(1.08,1,1.02);for(const sx of[-2.9,2.9])doorFront(sx,6.0,1.35,1.0,2.45,0,g);beam(0,6.05,.16,10,.0,7.5,'trim',g);return g;}
function rowhouseAsset(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);for(let i=-1;i<=1;i++){const q=new THREE.Group();g.add(q);facadePanel(i*7.4,0,7.1,10,0,8.2,i===0?'brick':'siding',q);for(const xx of[i*7.4-2.0,i*7.4+2.0])windowFront(xx,5.05,4.2,1.7,2.0,0,'glass',q);doorFront(i*7.4,5.08,1.35,1.0,2.5,0,q);porch(q,i*7.4,6.0,4.8,2.0);roofSystem(q,i*7.4,0,7.5,10,8.35,i===1?1:0);}return g;}
function storefrontAsset(x,z,rot=0,type=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=22,d=15,h=7.2;facadePanel(0,0,w,d,0,h,type?'brick':'stucco',g);slab(0,d/2+.05,w-1,3.7,.55,'concrete',.12,g);for(let i=-4;i<=4;i+=2){windowFront(i*2.0,d/2+.10,2.8,2.9,4.0,0,'glass',g);}doorFront(0,d/2+.13,1.5,1.25,2.9,0,g);roofSystem(g,0,0,w,d,h,0);beam(0,d/2+.55,w*.86,.7,h+.65,.9,'sign',g);for(let i=-3;i<=3;i++){beam(i*2.6,-d/2-.12,.08,1.0,.8,.12,'metal',g);cyl(.35,.18,i*2.6,.32,-d/2-.65,'metal',g);}AC(g,-w/2-.65,3.1,-2.5);AC(g,w/2+.65,3.1,2.2);weather(g,w,d,h);return g;}
function dinerAsset(x,z,rot=0){const g=storefrontAsset(x,z,rot,1);beam(0,8.0,16,.9,7.2,1.0,'sign',g);return g;}
function apartmentAsset(x,z,rot=0,floors=4){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=floors>=5?30:24,d=18,h=floors*3.45;facadePanel(0,0,w,d,0,h,'brick',g);for(let f=0;f<floors;f++){const y=1.85+f*3.45;beam(0,d/2+.04,w,.18,y-.95,.16,'trim',g);for(let c=-3;c<=3;c++)windowFront(c*3.8,d/2+.08,y,2.25,2.05,0,'glass',g);for(let c=-2;c<=2;c++)windowFront(-w/2-.07,c*3.0,y,1.9,2.0,Math.PI/2,'glass',g);}doorFront(0,d/2+.12,1.55,1.55,3.0,0,g);slab(0,d/2+1.0,w*.45,2.2,1.0,'concrete',.12,g);roofSystem(g,0,0,w,d,h,1);for(const xx of[-w/2-.5,w/2+.5])AC(g,xx,3.0,-4);for(let i=0;i<3;i++)roofSystem(g,-7+i*7,0,2.4,2.4,h+.4,0);weather(g,w,d,h);return g;}
function officeAsset(x,z,rot=0,floors=6){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=28,d=20,h=floors*3.6;facadePanel(0,0,w,d,0,h,'concrete',g);for(let f=0;f<floors;f++){const y=1.9+f*3.6;beam(0,d/2+.04,w,.16,y-1.05,.14,'metal',g);for(let c=-4;c<=4;c++)windowFront(c*3.0,d/2+.08,y,2.0,2.25,0,'glass',g);for(let c=-2;c<=2;c++)windowFront(-w/2-.07,c*3.2,y,2.0,2.2,Math.PI/2,'glass',g);}doorFront(0,d/2+.12,1.8,2.2,3.5,0,g);for(let f=0;f<floors;f+=2){beam(0,d/2+.48,19,.5,4.0+f*3.6,.65,'sign',g);}roofSystem(g,0,0,w,d,h,1);for(const xx of[-9,0,9]){roofSystem(g,xx,0,3.4,3.0,h+.4,0);AC(g,xx,3.0,-d/2-.7);}weather(g,w,d,h);return g;}
function motelAsset(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=34,d=12,h=6.8;facadePanel(0,0,w,d,0,h,'stucco',g);for(let i=-5;i<=5;i++){windowFront(i*3.0,d/2+.08,3.0,2.2,2.0,0,'glass',g);doorFront(i*3.0,d/2+.11,1.25,1.0,2.4,0,g);}slab(0,d/2+1.1,w,2.2,.9,'concrete',.12,g);beam(0,d/2+.7,w,.5,h+.45,.8,'sign',g);roofSystem(g,0,0,w,d,h,0);for(let i=-3;i<=3;i+=2)AC(g,i*4.5,3,-d/2-.65);weather(g,w,d,h);return g;}
function warehouseAsset(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);const w=34,d=25,h=11;facadePanel(0,0,w,d,0,h,'brick',g);for(let i=-2;i<=2;i++){beam(i*6.0,d/2+.08,4.8,.2,.3,6.8,'metal',g);windowFront(i*6.0,d/2+.11,6.9,4.6,2.0,0,'dark',g);}for(let i=-2;i<=2;i++)beam(i*6.0,-d/2-.2,4.5,1.0,2.6,5.6,'metal',g);roofSystem(g,0,0,w,d,h,1);for(const xx of[-10,-3,4,11])AC(g,xx,6,-d/2-.8);weather(g,w,d,h);return g;}
function autoShopAsset(x,z,rot=0){const g=storefrontAsset(x,z,rot,1);for(const xx of[-6,0,6])beam(xx,7.7,5.0,.35,2.0,5.0,'dark',g);return g;}
function gasAsset(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);facadePanel(0,0,20,13,0,5.7,'stucco',g);for(const xx of[-6,0,6])windowFront(xx,6.58,2.3,4.2,3.1,0,'glass',g);slab(0,0,20,13,5.85,'roof',.3,g);for(const xx of[-6,0,6]){cyl(.14,5.7,xx,2.85,0,'metal',g);beam(xx,0,.14,.14,5.55,5.0,'metal',g);}beam(0,7.0,14,.8,5.9,.7,'sign',g);return g;}

// Solid street network first. Roads are one opaque surface per corridor; buildings never overlap it.
const roadXs=[-112,0,112],roadZs=[-112,0,112];
const ground=slab(0,0,520,520,-.12,'concrete',.08,city);
for(const x of roadXs)slab(x,0,18,500,0,'road',.16,city);
for(const z of roadZs)slab(0,z,500,18,0,'road',.16,city);
for(const x of roadXs){slab(x-11,0,3.8,500,.04,'sidewalk',.10,city);slab(x+11,0,3.8,500,.04,'sidewalk',.10,city);}
for(const z of roadZs){slab(0,z-11,500,3.8,.04,'sidewalk',.10,city);slab(0,z+11,500,3.8,.04,'sidewalk',.10,city);}
function mark(x,z,w,d,mat='yellow'){slab(x,z,w,d,.16,mat,.04,city);}
for(const x of roadXs)for(let z=-238;z<238;z+=12)if(Math.abs((z+112)%112)>19)mark(x,z,.14,5);
for(const z of roadZs)for(let x=-238;x<238;x+=12)if(Math.abs((x+112)%112)>19)mark(x,z,5,.14);
function crosswalk(x,z,orient){const g=new THREE.Group();city.add(g);for(let i=-4;i<=4;i++){if(orient==='ew')slab(x+i*1.35,z,1.0,8,.19,'white',.035,g);else slab(x,z+i*1.35,8,1.0,.19,'white',.035,g);}}
for(const x of roadXs)for(const z of roadZs){crosswalk(x-12,z,'ew');crosswalk(x+12,z,'ew');crosswalk(x,z-12,'ns');crosswalk(x,z+12,'ns');}

// Dense lots: 3x3 blocks, mixed frontage, deliberate clearance from streets.
const lots=[
  [houseAsset,-82,-82,0,0],[duplexAsset,-48,-82,.02],[rowhouseAsset,-20,-78,0,1],[houseAsset,52,-82,0,2],[houseAsset,82,-82,Math.PI,3],
  [storefrontAsset,-82,-48,0,0],[dinerAsset,-45,-47,.0],[houseAsset,48,-48,0,1],[storefrontAsset,82,-48,Math.PI,1],
  [apartmentAsset,-78,48,0,4],[houseAsset,-42,50,0,0],[storefrontAsset,42,50,0,1],[apartmentAsset,78,48,Math.PI,5],
  [motelAsset,-48,82,0],[warehouseAsset,48,82,0],[autoShopAsset,0,82,0],
  [officeAsset,-82,-172,0,6],[apartmentAsset,-42,-170,0,5],[storefrontAsset,10,-170,0,0],[motelAsset,64,-170,0],
  [officeAsset,-170,-78,Math.PI/2,5],[apartmentAsset,-170,-35,Math.PI/2,4],[storefrontAsset,-170,30,Math.PI/2,1],[warehouseAsset,-170,82,Math.PI/2],
  [houseAsset,170,-78,-Math.PI/2,2],[storefrontAsset,170,-35,-Math.PI/2,0],[apartmentAsset,170,38,-Math.PI/2,5],[warehouseAsset,170,82,-Math.PI/2],
  [officeAsset,-82,170,0,6],[apartmentAsset,-35,170,0,4],[storefrontAsset,28,170,Math.PI/2,1],[motelAsset,78,170,Math.PI/2]
];
for(const p of lots){const fn=p[0];if(fn===houseAsset)fn(p[1],p[2],p[3],p[4]);else if(fn===apartmentAsset||fn===officeAsset)fn(p[1],p[2],p[3],p[4]);else if(fn===storefrontAsset)fn(p[1],p[2],p[3],p[4]);else fn(p[1],p[2],p[3]);}

// Urban props: hydrants, poles, bins, parked cars, fences, signs, vegetation. Kept as instanced/simple meshes for mobile performance.
function tree(x,z){const g=new THREE.Group();city.add(g);cyl(.18,3.0,x,1.5,z,'wood',g);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.65,2),new THREE.MeshStandardMaterial({color:0x465448,roughness:1}));crown.position.set(x,3.9,z);crown.castShadow=true;g.add(crown);}
function hydrant(x,z){cyl(.22,.9,x,.45,z,'rust');cyl(.34,.13,x,.95,z,'rust');cyl(.13,.2,x,1.05,z,'rust');}
function pole(x,z){cyl(.10,9,x,4.5,z,'metal');beam(x,z,.10,.10,8.8,1.0,'metal');beam(x+.42,z,.7,.12,8.55,.12,'yellow');}
function bin(x,z){prismRect(x,z,1.4,1.1,.1,1.35,'dark',.08);}
function car(x,z,r=0,pick=false){const g=new THREE.Group();g.position.set(x,.0,z);g.rotation.y=r;city.add(g);prismRect(0,0,pick?5.0:4.5,2.0,.35,1.25,'dark',.12,g);prismRect(.25,0,pick?2.6:2.2,1.75,1.25,2.05,'metal',.10,g);for(const xx of[-1.55,1.55])for(const zz of[-1.0,1.0]){const w=cyl(.3,.22,xx,.3,zz,'dark',g);w.rotation.z=Math.PI/2;}windowFront(.35,-.88,1.62,1.0,.55,0,'glass',g);return g;}
for(const p of[[-98,-72],[98,-72],[-72,-96],[72,-96],[-98,72],[98,72],[-72,96],[72,96],[-96,150],[96,150],[-150,-96],[150,-96]])car(p[0],p[1],0,Math.random()>.75);
for(const p of[[-99,-99],[99,-99],[-99,99],[99,99],[-99,45],[99,45],[-45,-99],[45,-99]]){pole(p[0],p[1]);hydrant(p[0]+2,p[1]+2);bin(p[0]+4,p[1]-3);}
for(const p of[[-58,-58],[58,-58],[-58,58],[58,58],[-145,0],[145,0],[0,-145],[0,145]])tree(p[0],p[1]);

// Distance tiers: hide secondary facade detail past 150m while retaining building silhouettes.
const detailObjects=[];city.traverse(o=>{if(o.isMesh&&o.name.startsWith('ARCH_'))detailObjects.push(o);});
function updateLOD(){const px=camera.position.x,pz=camera.position.z;for(const o of detailObjects){const dx=o.position.x-px,dz=o.position.z-pz;const d=Math.hypot(dx,dz);o.visible=d<205;}}

let yaw=0,pitch=0,ax=0,ay=0,running=false,fire=false;const keys={};addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
function bindHold(el,down,up=down){if(!el)return;el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);down(e)});el.addEventListener('pointerup',e=>{e.preventDefault();up(e)});el.addEventListener('pointercancel',up);}
bindHold(runEl,()=>running=true,()=>running=false);bindHold(fireEl,()=>fire=true,()=>fire=false);bindHold(reloadEl,()=>{if(bootStatus)bootStatus.textContent='RELOAD'});bindHold(jumpEl,()=>{camera.position.y=2.2;setTimeout(()=>camera.position.y=1.72,180)});
if(joyEl){joyEl.addEventListener('pointerdown',e=>joyEl.setPointerCapture(e.pointerId));joyEl.addEventListener('pointermove',e=>{const r=joyEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/(r.width*.42),dy=(e.clientY-cy)/(r.height*.42),l=Math.hypot(dx,dy),s=Math.min(1,l);if(l){dx=dx/l*s;dy=dy/l*s;}ax=dx;ay=dy;if(stickEl)stickEl.style.transform=`translate(${dx*34}px,${dy*34}px)`});['pointerup','pointercancel','pointerleave'].forEach(ev=>joyEl.addEventListener(ev,()=>{ax=ay=0;if(stickEl)stickEl.style.transform='translate(0,0)'}));}
let looking=false,lx=0,ly=0;if(lookEl){lookEl.addEventListener('pointerdown',e=>{looking=true;lx=e.clientX;ly=e.clientY;lookEl.setPointerCapture(e.pointerId)});lookEl.addEventListener('pointermove',e=>{if(!looking)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;yaw-=dx*.004;pitch-=dy*.003;pitch=Math.max(-1.15,Math.min(1.15,pitch));});['pointerup','pointercancel'].forEach(ev=>lookEl.addEventListener(ev,()=>looking=false));}
const clock=new THREE.Clock();let frames=0,last=performance.now();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);let sx=ax,sy=ay;if(keys.KeyA)sx=-1;if(keys.KeyD)sx=1;if(keys.KeyW)sy=-1;if(keys.KeyS)sy=1;const sp=running?12:6.2;const f=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));camera.position.addScaledVector(f,-sy*sp*dt);camera.position.addScaledVector(r,sx*sp*dt);camera.position.x=Math.max(-235,Math.min(235,camera.position.x));camera.position.z=Math.max(-235,Math.min(235,camera.position.z));camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;updateLOD();const zone=Math.abs(camera.position.x)<115&&Math.abs(camera.position.z)<115?'DOWNTOWN / MIXED USE':Math.abs(camera.position.x)>145||Math.abs(camera.position.z)>145?'OUTSKIRTS / INDUSTRIAL':'RESIDENTIAL / COMMERCIAL';if(zoneEl)zoneEl.textContent=zone;if(bootStatus)bootStatus.textContent='CITY ONLINE — HIGH DENSITY ARCHITECTURE';renderer.render(scene,camera);frames++;const now=performance.now();if(now-last>500){if(fpsEl)fpsEl.textContent=Math.round(frames*1000/(now-last))+' FPS';frames=0;last=now;}}
animate();if(boot)boot.remove();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
