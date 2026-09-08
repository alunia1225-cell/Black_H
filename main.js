import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";

const $ = id => document.getElementById(id);
const boot = $("boot"), bootStatus = $("bootStatus"), fpsEl = $("fps"), zoneEl = $("zone");
const joyEl=$("joy"), stickEl=$("stick"), lookEl=$("look"), runEl=$("run"), jumpEl=$("jump"), fireEl=$("fire"), reloadEl=$("reload");
function showFatal(title,detail){boot.innerHTML=`<strong>${title}</strong><span style="white-space:pre-wrap;max-width:92vw">${detail}</span>`;boot.style.background="#430b0b";boot.style.color="#fff"}
window.addEventListener("error",e=>showFatal("JAVASCRIPT ERROR",e.error?.stack||e.message||String(e)));
window.addEventListener("unhandledrejection",e=>showFatal("PROMISE ERROR",e.reason?.stack||e.reason||String(e)));

let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"})}catch(e){showFatal("WEBGL START FAILED",String(e));throw e}
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x66706f);
scene.fog=new THREE.Fog(0x66706f,145,430);
const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.05,520);
camera.position.set(0,1.72,16);
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xe7eceb,0x514a43,2.05);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe4c4,2.55);sun.position.set(-120,150,80);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-230;sun.shadow.camera.right=230;sun.shadow.camera.top=230;sun.shadow.camera.bottom=-230;scene.add(sun);
const fill=new THREE.DirectionalLight(0xc6d5ff,.75);fill.position.set(100,60,-100);scene.add(fill);

const world=new THREE.Group();scene.add(world);const city=new THREE.Group();world.add(city);
const loaderTex=new THREE.TextureLoader();
const texCache=new Map();
function tex(name){if(!texCache.has(name)){const t=loaderTex.load(name);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;texCache.set(name,t)}return texCache.get(name)}
function pbr(base,rough,normal,ao,repeat=1,metal=0){const m=new THREE.MeshStandardMaterial({map:tex(base),roughnessMap:tex(rough),normalMap:tex(normal),aoMap:tex(ao),metalness:metal,roughness:.88});[m.map,m.roughnessMap,m.normalMap,m.aoMap].forEach(t=>{t.repeat.set(repeat,repeat)});m.normalScale.set(.55,.55);return m}
const siding=pbr("pbr_siding_basecolor.jpg","pbr_siding_roughness.jpg","pbr_siding_normal.jpg","pbr_siding_ao.jpg",2);
const brick=pbr("pbr_brick_basecolor.jpg","pbr_brick_roughness.jpg","pbr_brick_normal.jpg","pbr_brick_ao.jpg",2);
const concrete=pbr("pbr_concrete_basecolor.jpg","pbr_concrete_roughness.jpg","pbr_concrete_normal.jpg","pbr_concrete_ao.jpg",2);
const asphalt=pbr("pbr_asphalt_basecolor.jpg","pbr_asphalt_roughness.jpg","pbr_asphalt_normal.jpg","pbr_asphalt_ao.jpg",5);
const rust=pbr("pbr_rust_basecolor.jpg","pbr_rust_roughness.jpg","pbr_rust_normal.jpg","pbr_rust_ao.jpg",2,.12);
const simple=(c,r=.9,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const curb=simple(0x8a8880,.96), roof=simple(0x303231,.96), trim=simple(0x363735,.82), dark=simple(0x1e292c,.25), glass=new THREE.MeshStandardMaterial({color:0x78909a,roughness:.15,metalness:.08,transparent:false,opacity:1}), dirt=simple(0x49453e,.98), wood=simple(0x66564a,.92), sign=simple(0x8e7754,.82), grass=simple(0x465440,.98), lane=simple(0xb3a76e,.82);

function meshBox(parent,w,h,d,material,x,y,z,rx=0,ry=0,rz=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function slab(parent,w,d,material,x,z,y=.02){return meshBox(parent,w,.05,d,material,x,y,z)}
function cyl(parent,r,h,material,x,y,z,seg=12){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function windowUnit(g,x,y,z,w=1.5,h=1.35,front=true){const zz=z+(front?-.06:.06);meshBox(g,w,h,.10,dark,x,y,zz);meshBox(g,w+.18,.10,.16,trim,x,y+h/2+.06,zz);meshBox(g,w+.18,.10,.16,trim,x,y-h/2-.06,zz);meshBox(g,.10,h+.18,.16,trim,x-w/2-.06,y,zz);meshBox(g,.10,h+.18,.16,trim,x+w/2+.06,y,zz);meshBox(g,.055,h-.12,.13,trim,x,y,zz-.04);meshBox(g,w-.12,.055,.13,trim,x,y,zz-.04)}
function door(g,x,y,z,w=1.05,h=2.25){meshBox(g,w,h,.14,wood,x,y,z);meshBox(g,.08,h+.08,.18,trim,x-w/2-.05,y,z);meshBox(g,.08,h+.08,.18,trim,x+w/2+.05,y,z);meshBox(g,.65,.62,.08,glass,x,y+.48,z-.08);cyl(g,.055,.07,lane,x+w*.30,y,z-.13,10).rotation.z=Math.PI/2}
function gutter(g,x,z,h=5){meshBox(g,.12,h,.12,trim,x,h/2+.25,z);meshBox(g,.75,.10,.10,trim,x-.35,h+.25,z)}
function awning(g,x,z,w){meshBox(g,w,.10,.9,sign,x,3.75,z-.42,-.18,0,0)}
function ac(g,x,y,z){meshBox(g,1.35,.72,.58,trim,x,y,z);meshBox(g,1.02,.38,.08,dark,x,y,z-.31);for(let i=-3;i<=3;i++)meshBox(g,.05,.28,.10,lane,x+i*.14,y,z-.38)}
function grime(g,x,y,z,w,h,rot=0){const m=meshBox(g,w,h,.025,dirt,x,y,z,0,0,rot);m.castShadow=false}
function roofDetails(g,w,d,y){for(const x of [-w*.32,w*.32]){meshBox(g,.28,.45,.28,trim,x,y+.25,0);meshBox(g,.42,.08,.42,dirt,x,y+.48,0)}for(const z of [-d*.32,d*.32])meshBox(g,.65,.10,.25,trim,0,y+.12,z)}

function house(x,z,variant=0){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);registerBuilding(g);const w=10+(variant%2)*1.5,d=9,h=4.2;slab(g,w+1,d+1,concrete,0,0,.18);meshBox(g,w,h,d,siding,0,2.3,0);meshBox(g,w+.35,.32,d+.35,trim,0,4.48,0);const r=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2.45,4),roof);r.rotation.y=Math.PI/4;r.position.y=5.7;r.scale.z=.88;r.castShadow=true;g.add(r);windowUnit(g,-w*.27,2.75,-d/2,1.65,1.35);windowUnit(g,w*.27,2.75,-d/2,1.65,1.35);door(g,0,1.3,-d/2-.08);gutter(g,-w/2-.25,-d/2-.02,h);gutter(g,w/2+.25,-d/2-.02,h);ac(g,w/2+.42,2.0,-.8);meshBox(g,2.4,.12,.8,wood,0,.78,-d/2-.66);for(let i=0;i<3;i++)meshBox(g,2.7,.10,.25,concrete,0,.56-i*.15,-d/2-.69);meshBox(g,.7,.6,.5,trim,w/2+.55,.35,.9);for(let i=0;i<3;i++)cyl(g,.28,.5,dirt,w/2+.85+(i%2)*.35,.28,-d/2-.25+(i%2)*.2,10);grime(g,-w*.33,1.0,-d/2-.08,.9,1.4,-.03);roofDetails(g,w,d,4.5);return g}
function shop(x,z,kind=0){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);registerBuilding(g);const w=16,d=11,h=5.3;slab(g,w+1,d+1,concrete,0,0,.18);meshBox(g,w,h,d,kind?brick:siding,0,2.85,0);meshBox(g,w+.3,.32,d+.3,roof,0,5.55,0);meshBox(g,11.8,3.05,.12,glass,0,2.55,-d/2-.08);for(let i=-5;i<=5;i+=2)meshBox(g,.08,3.2,.16,trim,i,2.55,-d/2-.13);door(g,-5.7,1.45,-d/2-.16,.95,2.55);door(g,5.7,1.45,-d/2-.16,.95,2.55);awning(g,0,-d/2-0.1,12);meshBox(g,4.8,.7,.12,sign,0,4.72,-d/2-.22);ac(g,6.9,4.15,1.8);gutter(g,-w/2-.18,d/2-.15,h);gutter(g,w/2+.18,d/2-.15,h);for(let sx=-4;sx<=4;sx+=2){meshBox(g,.08,2.2,.45,trim,sx,1.45,-d/2+.35);for(let sy=0;sy<3;sy++)meshBox(g,.9,.12,.38,wood,sx,.65+sy*.65,-d/2+.1)}for(let i=0;i<5;i++)meshBox(g,.35,.22,.35,dirt,-5+i*2.5,.18,d/2+.7);grime(g,-5.8,2.2,-d/2-.12,.8,1.9,.02);return g}
function motel(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);registerBuilding(g);const w=23,d=9,h=6;slab(g,w+1,d+1,concrete,0,0,.18);meshBox(g,w,h,d,brick,0,3,0);meshBox(g,w+.4,.35,d+.4,roof,0,6.15,0);for(let i=-9;i<=9;i+=4){windowUnit(g,i,3.45,-d/2,2.1,1.5);door(g,i,1.35,-d/2-.12,.9,2.35);meshBox(g,2.6,.10,1.1,trim,i,.72,-d/2-.72)}ac(g,w/2+.3,4.3,0);for(let i=-8;i<=8;i+=4)meshBox(g,.12,5.2,.12,trim,i,2.8,d/2+.1);return g}
function warehouse(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);registerBuilding(g);const w=23,d=15,h=8;slab(g,w+1,d+1,concrete,0,0,.18);meshBox(g,w,h,d,brick,0,4.1,0);meshBox(g,w+.5,.42,d+.5,roof,0,8.25,0);meshBox(g,7,5.4,.12,dark,0,3.45,-d/2-.08);for(let i=-2;i<=2;i++)meshBox(g,.11,5.4,.18,trim,i*1.4,3.45,-d/2-.13);meshBox(g,4.2,4.9,.14,rust,7.9,3.0,-d/2-.12);ac(g,-9,5.8,0);ac(g,9,5.8,0);for(let i=0;i<8;i++)meshBox(g,.8,.12,.5,wood,-7+i*2,1.2,d/2-.2);return g}

const streetObjects=[];
const detailGroups=[];
function registerBuilding(g){detailGroups.push(g);return g}
function streetLight(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);cyl(g,.10,7.2,trim,0,3.6,0,10);meshBox(g,1.8,.10,.10,trim,.78,7.0,0);meshBox(g,.38,.20,.25,lane,1.62,6.9,0)}
function utilityPole(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);cyl(g,.15,9,trim,0,4.5,0,12);meshBox(g,3.6,.12,.12,trim,0,8.0,0);for(const x2 of [-1.2,0,1.2])meshBox(g,.18,.16,.18,trim,x2,7.78,0)}
function car(x,z,rot=0,pickup=false){const g=new THREE.Group();g.position.set(x,.02,z);g.rotation.y=rot;city.add(g);const body=simple(pickup?0x5b5a55:0x4a4e50,.68,.05);meshBox(g,4.6,.72,1.8,body,0,.62,0);meshBox(g,pickup?2.0:2.5,.78,1.55,dark,.45,1.17,0);for(const xx of [-1.55,1.55]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.20,16),trim);w.rotation.z=Math.PI/2;w.position.set(xx,.36,0);g.add(w)}return g}
function dumpster(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);meshBox(g,3.1,1.5,1.9,rust,0,.78,0);meshBox(g,3.25,.10,2.05,trim,0,1.57,0)}
function tree(x,z){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);cyl(g,.16,2.2,wood,0,1.1,0,10);const crown=new THREE.Mesh(new THREE.SphereGeometry(1.45,12,9),grass);crown.position.y=2.7;crown.scale.y=1.25;crown.castShadow=true;g.add(crown)}
function hydrant(x,z){cyl(city,.18,.9,rust,x,.45,z,10);cyl(city,.26,.18,rust,x,.86,z,10);}
function bench(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;city.add(g);meshBox(g,1.8,.12,.42,wood,0,.65,0);meshBox(g,.10,.6,.10,trim,-.72,.3,0);meshBox(g,.10,.6,.10,trim,.72,.3,0)}

const citySize=7*58; // 406m planning envelope
function buildRoadNetwork(){
  const roadCenters=[];for(let i=-3;i<=3;i++)roadCenters.push(i*58);
  // single ground, roads are separate non-transparent slabs; no coplanar crossing slabs
  slab(city,citySize+36,citySize+36,grass,0,0,-.10);
  const min=-203,max=203, roadW=14;
  for(let ri=0;ri<roadCenters.length;ri++){
    const c=roadCenters[ri];
    // horizontal street split around intersections
    for(let j=0;j<roadCenters.length-1;j++){
      const a=roadCenters[j]+roadW/2,b=roadCenters[j+1]-roadW/2;slab(city,b-a,roadW,asphalt,(a+b)/2,c,.00);
      slab(city,b-a,.10,lane,(a+b)/2,c-.0,.035);
    }
    // vertical street split around intersections
    for(let j=0;j<roadCenters.length-1;j++){
      const a=roadCenters[j]+roadW/2,b=roadCenters[j+1]-roadW/2;slab(city,roadW,b-a,asphalt,c,(a+b)/2,.002);
    }
    // intersections: one square each, no road-over-road overlap
    for(const cz of roadCenters)slab(city,roadW,roadW,asphalt,c,cz,.004);
    // curbs on both sides of every street; no giant perimeter strips
    slab(city,citySize+2,.22,curb,0,c-roadW/2-.02,.065);slab(city,citySize+2,.22,curb,0,c+roadW/2+.02,.065);
    slab(city,.22,citySize+2,curb,c-roadW/2-.02,0,.066);slab(city,.22,citySize+2,curb,c+roadW/2+.02,0,.066);
  }
  // dashed center markings on each street segment
  for(const z of roadCenters)for(let x=-195;x<195;x+=9)slab(city,4,.10,lane,x,z,.065);
  for(const x of roadCenters)for(let z=-195;z<195;z+=9)slab(city,.10,4,lane,x,z,.066);
  // crosswalk bars at every intersection, positioned inside road footprint
  for(const x of roadCenters)for(const z of roadCenters){for(let k=-3;k<=3;k++)slab(city,.65,6,curb,x+k*1.45,z-5.1,.07);for(let k=-3;k<=3;k++)slab(city,6,.65,curb,x-5.1,z+k*1.45,.071)}
}

const lots=[];
function buildLot(ix,iz){
  const cx=ix*58+29,cz=iz*58+29; // 44x44 interior between 14m roads
  const lot={ix,iz,cx,cz};lots.push(lot);
  // sidewalk around each block, with controlled gaps for driveways
  slab(city,44,2.5,concrete,cx,cz-20.6,.075);slab(city,44,2.5,concrete,cx,cz+20.6,.075);slab(city,2.5,44,concrete,cx-20.6,cz,.075);slab(city,2.5,44,concrete,cx+20.6,cz,.075);
  // patched asphalt drive strips, never extending into building footprints
  for(const dx of [-13,13])slab(city,5,8,asphalt,cx+dx,cz-17,.085);
  for(const dz of [-13,13])slab(city,8,5,asphalt,cx-17,cz+dz,.086);
}
function populateLots(){
  for(let ix=-3;ix<=2;ix++)for(let iz=-3;iz<=2;iz++)buildLot(ix,iz);
  const near=[];
  for(const l of lots){
    const central=Math.abs(l.cx)<95&&Math.abs(l.cz)<95;
    const south=l.cz>70;
    if(central&&((l.ix+l.iz)%3===0)){shop(l.cx,l.cz,((l.ix+l.iz)&1));near.push("commercial");}
    else if(south&&l.ix===1){warehouse(l.cx,l.cz);near.push("industrial");}
    else if(south&&l.ix===2){motel(l.cx,l.cz);near.push("motel");}
    else if((l.ix+l.iz)%5===0){shop(l.cx-3,l.cz+2,1);house(l.cx+9,l.cz+8,1);near.push("mixed");}
    else {house(l.cx-8,l.cz+5,(l.ix+l.iz+5)%3);house(l.cx+9,l.cz-7,(l.ix*2+l.iz+6)%3);near.push("residential");}
    // lot-level life: fences, bins, mailbox, trees kept inside lot bounds
    if((l.ix*7+l.iz)%2===0){for(let f=-12;f<=12;f+=6)meshBox(city,.10,1.05,.10,trim,l.cx+f,.53,l.cz+16);meshBox(city,25,.10,.10,trim,l.cx,.98,l.cz+16)}
    dumpster(l.cx+15,l.cz+13);
    tree(l.cx-16,l.cz-14);tree(l.cx+15,l.cz-15);
    if((l.ix+l.iz)%3===0)hydrant(l.cx-18,l.cz+10);
    bench(l.cx-17,l.cz+4,(l.ix&1)*Math.PI/2);
  }
  // a few parked vehicles on dedicated road-side spaces, never on building footprints
  const cars=[[-145,-27,0,0],[-88,-27,Math.PI,0],[-29,-27,0,1],[29,-27,Math.PI/2,0],[87,-27,Math.PI/2,1],[145,-27,-Math.PI/2,0],[-145,85,Math.PI/2,0],[-87,85,-Math.PI/2,1],[87,85,Math.PI/2,0],[145,85,-Math.PI/2,1]];
  for(const c of cars)car(...c);
  for(let i=-2;i<=2;i++){streetLight(i*58+29,-7);streetLight(i*58+29,109)}
  for(let i=-3;i<=3;i++){utilityPole(i*58-20,-150);utilityPole(i*58+20,150)}
}
function addFarCity(){
  // No giant wall planes. Far blocks are separated buildings with roofs and street gaps.
  for(let ix=-4;ix<=4;ix++)for(let iz=-4;iz<=4;iz++){
    if(ix>=-3&&ix<=2&&iz>=-3&&iz<=2)continue;
    const x=ix*58+29,z=iz*58+29;const h=5+((ix*13+iz*7)%5+5)%5;
    const w=18+((ix*5+iz*3)%9+9)%9,d=16+((ix*4+iz*6)%8+8)%8;
    const g=new THREE.Group();g.position.set(x,0,z);city.add(g);meshBox(g,w,h,d,((ix+iz)&1)?brick:siding,0,h/2,0);meshBox(g,w+.25,.28,d+.25,roof,0,h+.14,0);
    if(Math.abs(ix)%2===0)windowUnit(g,0,h*.55,-d/2,2.2,1.2);
  }
}
function buildCity(){buildRoadNetwork();populateLots();addFarCity();}
buildCity();
for(const g of detailGroups)g.traverse(o=>{if(o.geometry?.boundingSphere===null)o.geometry.computeBoundingSphere();const b=o.geometry?.boundingSphere;if(o!==g&&b)o.userData.lodSmall=b.radius<1.05;});

const st={yaw:0,pitch:0,vy:0,ground:true,run:false};let ax=0,ay=0,jid=null,jx=0,jy=0,lid=null,lx=0,ly=0;
joyEl.onpointerdown=e=>{jid=e.pointerId;jx=e.clientX;jy=e.clientY;joyEl.setPointerCapture(jid)};
joyEl.onpointermove=e=>{if(e.pointerId!==jid)return;const dx=e.clientX-jx,dy=e.clientY-jy,k=Math.min(1,Math.hypot(dx,dy)/48),a=Math.atan2(dy,dx);ax=Math.cos(a)*k;ay=Math.sin(a)*k;stickEl.style.transform=`translate(${Math.cos(a)*k*42}px,${Math.sin(a)*k*42}px)`};
function joyEnd(){jid=null;ax=ay=0;stickEl.style.transform="translate(0,0)"}joyEl.onpointerup=joyEnd;joyEl.onpointercancel=joyEnd;
lookEl.onpointerdown=e=>{lid=e.pointerId;lx=e.clientX;ly=e.clientY;lookEl.setPointerCapture(lid)};
lookEl.onpointermove=e=>{if(e.pointerId!==lid)return;st.yaw-=(e.clientX-lx)*.004;st.pitch-=(e.clientY-ly)*.003;lx=e.clientX;ly=e.clientY;st.pitch=Math.max(-1.3,Math.min(1.2,st.pitch))};lookEl.onpointerup=()=>lid=null;lookEl.onpointercancel=()=>lid=null;
runEl.onpointerdown=()=>st.run=true;runEl.onpointerup=()=>st.run=false;runEl.onpointercancel=()=>st.run=false;
jumpEl.onpointerdown=()=>{if(st.ground){st.vy=5.5;st.ground=false}};fireEl.onpointerdown=()=>fireEl.textContent="FIRE •";fireEl.onpointerup=()=>fireEl.textContent="FIRE";reloadEl.onpointerdown=()=>{reloadEl.textContent="RELOADING";setTimeout(()=>reloadEl.textContent="RELOAD",650)};
const keys={};window.onkeydown=e=>keys[e.code]=1;window.onkeyup=e=>keys[e.code]=0;
let last=performance.now(),frames=0,fpsT=performance.now(),lodTick=0;
function updateLOD(){
  for(const g of detailGroups){
    const dx=g.position.x-camera.position.x,dz=g.position.z-camera.position.z;
    const d2=dx*dx+dz*dz;
    const far=d2>210*210,mid=d2>105*105;
    g.traverse(o=>{if(o===g)return;if(o.userData.lodSmall===undefined){const b=o.geometry?.boundingSphere;if(b)o.userData.lodSmall=b.radius<1.05;}if(o.userData.lodSmall)o.visible=!far;});
  }
}
function loop(t){requestAnimationFrame(loop);const d=Math.min(.033,(t-last)/1000);last=t;let x=ax+(keys.KeyD?1:0)-(keys.KeyA?1:0),z=ay+(keys.KeyS?1:0)-(keys.KeyW?1:0);const n=Math.hypot(x,z);if(n>1){x/=n;z/=n}const sp=(st.run||keys.ShiftLeft)?8:4.5;const f=new THREE.Vector3(Math.sin(st.yaw),0,Math.cos(st.yaw)),rr=new THREE.Vector3(Math.cos(st.yaw),0,-Math.sin(st.yaw));camera.position.addScaledVector(rr,x*sp*d);camera.position.addScaledVector(f,z*sp*d);st.vy-=15*d;camera.position.y+=st.vy*d;if(camera.position.y<1.72){camera.position.y=1.72;st.vy=0;st.ground=true}camera.rotation.order="YXZ";camera.rotation.y=st.yaw;camera.rotation.x=st.pitch;if((lodTick++&7)===0)updateLOD();frames++;if(t-fpsT>500){fpsEl.textContent=Math.round(frames*1000/(t-fpsT))+" FPS";frames=0;fpsT=t}const axz=Math.abs(camera.position.x),azz=Math.abs(camera.position.z);zoneEl.textContent=axz<105&&azz<105?"RESIDENTIAL / COMMERCIAL":(camera.position.z>115?"MOTEL / INDUSTRIAL":"OUTSKIRTS");renderer.render(scene,camera)}
requestAnimationFrame(loop);
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
bootStatus.textContent="CITY ONLINE — REAL STREET LAYOUT / PBR / LOD-READY";
setTimeout(()=>boot.style.opacity=".28",1200);
