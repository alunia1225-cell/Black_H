
(() => {
"use strict";
const canvas=document.getElementById("game");
const gl=canvas.getContext("webgl2",{antialias:true,alpha:false,preserveDrawingBuffer:false});
if(!gl){document.body.innerHTML="<div style='padding:24px;color:#fff;font-family:sans-serif'>このブラウザはWebGL2に対応していません。</div>";return;}

// Bind the boot button before heavy city generation. This prevents the start
// overlay from becoming a dead UI while the procedural district is building.
const startEl=document.getElementById("start");
const enterEl=document.getElementById("enter");
let startPressed=false;
enterEl?.addEventListener("click",()=>{
  startPressed=true;
  startEl.style.display="none";
},{passive:true});

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;
layout(location=1) in vec3 n;
layout(location=2) in vec2 uv;
layout(location=3) in vec4 tint;
uniform mat4 vp;
out vec3 vN; out vec2 vUV; out vec4 vTint; out vec3 vW;
void main(){vec4 w=vec4(p,1.0);vW=w.xyz;vN=n;vUV=uv;vTint=tint;gl_Position=vp*w;}`;

const FS=`#version 300 es
precision highp float;
in vec3 vN; in vec2 vUV; in vec4 vTint; in vec3 vW;
uniform sampler2D atlas;
uniform vec3 sunDir;
uniform vec3 cam;
uniform float dayFactor;
uniform float nightFactor;
out vec4 outColor;
void main(){
 vec4 tex=texture(atlas,vUV);
 float lam=max(dot(normalize(vN),normalize(sunDir)),0.0);
 float hemi=(.16+.84*lam)*(.30+.70*dayFactor);
 vec3 c=tex.rgb*vTint.rgb*hemi;
 // Windows carry a warm emissive lift.
 float emissiveMask=vTint.a;
 c+=vec3(1.0,.55,.16)*emissiveMask*nightFactor*1.15;
 float fog=smoothstep(115.0,180.0,length(vW-cam));
 vec3 sky=mix(vec3(.48,.52,.56),vec3(.055,.065,.085),nightFactor);
 c=mix(c,sky,fog*.52);
 outColor=vec4(c,1.0);
}`;

function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const vpLoc=gl.getUniformLocation(prog,"vp"), sunLoc=gl.getUniformLocation(prog,"sunDir"), camLoc=gl.getUniformLocation(prog,"cam"), dayLoc=gl.getUniformLocation(prog,"dayFactor"), nightLoc=gl.getUniformLocation(prog,"nightFactor");

const atlas=new Image();
atlas.src="city_atlas.png";
let texture=null,ready=false;
atlas.onload=()=>{
  texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  // Keep image coordinates predictable: the atlas is authored top-to-bottom.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  ready=true;
};
atlas.onerror=()=>{console.error("city_atlas.png could not be loaded");};

// ATLAS: 1024x1024, 16x16 cells, 100 authored procedural materials.
const ATW=1024, ATH=1024, TILE=64;
function tileId(id){const col=id%16,row=Math.floor(id/16);return [col*TILE/ATW,1-(row*TILE+TILE)/ATH,(col*TILE+TILE)/ATW,1-row*TILE/ATH];}
const A={}; for(let i=0;i<100;i++) A['t'+i]=tileId(i);
const REAL={
 concrete_light:'t10',concrete_stain:'t11',plaster_cream:'t20',plaster_old:'t21',brick_red:'t0',brick_dark:'t1',
 tile_blue:'t60',tile_green:'t61',stone:'t14',metal_panel:'t40',paint_worn:'t28',paint_blue:'t25',paint_green:'t27',paint_brown:'t23',
 window:'t30',window_reflect:'t31',window_dark:'t34',window_lit:'t94',glass:'t33',shop_glass:'t32',office_glass:'t37',dirty_glass:'t38',
 roof:'t68',roof_tar:'t67',roof_metal:'t69',dark:'t79',asphalt:'t70',asphalt_patch:'t78',sidewalk:'t13',curb:'t12',lane:'t89',
 metal:'t43',wood:'t53',leaf:'t72',sign_red:'t81',sign_blue:'t82',sign_white:'t85',sign_yellow:'t83',light:'t95',
 awning:'t62',canopy:'t64',ac_unit:'t45',rollup:'t46',door_metal:'t47',door_wood:'t58',warehouse_panel:'t48',warehouse_door:'t49',
 utility_wood:'t52',utility_metal:'t43',neon_base:'t90',parking_mark:'t86',bollard:'t91',wall_graffiti:'t88',wall_moss:'t18',wall_water:'t19',
 shutter:'t41',roof_tile:'t60',roof_rust:'t42',stone_dark:'t9',concrete_dark:'t16',plaster_grey:'t22',plaster_blue:'t24',plaster_beige:'t29'
};
const P=[],C=[],COL=[];
const colliders=[];
const rand=(seed)=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=t;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296}};
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
function pushFace(a,b,c,d,n,uv,tint){
 const [u0,v0,u1,v1]=uv;
 const q=[[a,u0,v0],[b,u1,v0],[c,u1,v1],[d,u0,v1]],ix=[0,1,2,0,2,3];
 for(const i of ix){const p=q[i];P.push(p[0][0],p[0][1],p[0][2]);C.push(n[0],n[1],n[2]);COL.push(tint[0],tint[1],tint[2],tint[3]||1,COL.length%4===0?0:0)}
 // UV separately to keep array layout deterministic
}
const UV=[];
function face(a,b,c,d,n,uv,tint){
 const [u0,v0,u1,v1]=uv;
 const vs=[a,b,c,a,c,d], us=[[u0,v0],[u1,v0],[u1,v1],[u0,v0],[u1,v1],[u0,v1]];
 for(let i=0;i<6;i++){P.push(...vs[i]);C.push(...n);UV.push(us[i][0],us[i][1]);COL.push(tint[0],tint[1],tint[2],tint[3] ?? 0)}
}
const MATERIAL_ALIAS={
 concrete:"t10", brick:"t0", plaster:"t20", metal:"t43", wood:"t53", leaf:"t72",
 glass:"t33", dark:"t79", asphalt:"t70", sidewalk:"t13", curb:"t12", lane:"t89",
};
function resolveMaterial(material){
 if(Array.isArray(material)){
   const name=material[0];
   const key=REAL[name]||MATERIAL_ALIAS[name]||name;
   return {uv:A[key]||A.t10,tint:material[1]||[1,1,1,0],source:name};
 }
 if(typeof material!=="string") return {uv:A.t10,tint:[1,1,1,0],source:"concrete"};
 if(material[0]==="#") return {uv:A.t10,tint:[...rgb(material),0],source:material};
 const key=REAL[material]||MATERIAL_ALIAS[material]||material;
 return {uv:A[key]||A.t10,tint:[1,1,1,0],source:material};
}
function addBox(x,y,z,sx,sy,sz,material="#ffffff",yaw=0,solid=false){
 const resolved=resolveMaterial(material);
 const sourceMaterial=resolved.source;
 let t=resolved.uv, tint=resolved.tint;
 if(typeof sourceMaterial==='string' && /^(window_lit|light)$/.test(sourceMaterial)) tint=[1,1,1,1];
 if(typeof sourceMaterial==='string' && sourceMaterial==='neon_base') tint=[1,1,1,.8];
 const [c,s]=[Math.cos(yaw),Math.sin(yaw)];
 const local=[
  [-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz],
  [sx,-sy,-sz],[-sx,-sy,-sz],[-sx,sy,-sz],[sx,sy,-sz]
 ];
 const tr=q=>[x+q[0]*c-q[2]*s,y+q[1],z+q[0]*s+q[2]*c];
 const p=local.map(tr);
 face(p[0],p[1],p[2],p[3],[0,0,1],t,tint);
 face(p[4],p[5],p[6],p[7],[0,0,-1],t,tint);
 face(p[1],p[4],p[7],p[2],[1,0,0],t,tint);
 face(p[5],p[0],p[3],p[6],[-1,0,0],t,tint);
 face(p[3],p[2],p[7],p[6],[0,1,0],t,tint);
 face(p[5],p[4],p[1],p[0],[0,-1,0],t,tint);
 if(solid)colliders.push({x,z,sx,sz,y,sy,yaw});
}
function addCylinder(x,y,z,r,h,material,segments=10){
 const resolved=resolveMaterial(material);
 const uv=resolved.uv;
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
  const x1=x+Math.cos(a)*r,z1=z+Math.sin(a)*r,x2=x+Math.cos(b)*r,z2=z+Math.sin(b)*r;
  face([x1,y-h,z1],[x2,y-h,z2],[x2,y,z2],[x1,y,z1],[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],uv,[.9,.9,.9,0]);
 }
}
function roadBox(){addBox(0,-.07,0,110,.07,110,"asphalt");}
roadBox();

// CITY DISTRICT ------------------------------------------------------------
// A much larger continuous district: 7 x 7 street grid, varied blocks,
// commercial frontage, residential streets, alleys, parking and skyline.
// All geometry is procedural/local; no external assets or network calls.

const DIST=308, ROAD=7.6, BLOCK=38.5, HALF=5;
addBox(0,-.07,0,DIST/2,.07,DIST/2,"asphalt");

// 7x7 street grid. Main streets are wider and sidewalks/curbs are built
// around every carriageway rather than using a single giant flat plane.
const roads=[];
for(let i=-HALF;i<=HALF;i++){
  const p=i*BLOCK;
  roads.push(p);
  addBox(p,.0,0,ROAD/2,.045,DIST/2,"asphalt");
  addBox(0,.0,p,DIST/2,.045,ROAD/2,"asphalt");
  // paired curbs
  addBox(p-ROAD/2-.18,.12,0,.13,.12,DIST/2,"concrete");
  addBox(p+ROAD/2+.18,.12,0,.13,.12,DIST/2,"concrete");
  addBox(0,.12,p-ROAD/2-.18,DIST/2,.12,.13,"concrete");
  addBox(0,.12,p+ROAD/2+.18,DIST/2,.12,.13,"concrete");
  // dashed center lines
  for(let q=-90;q<=90;q+=9){
    addBox(p,.055,q,.055,.01,2.2,"lane");
    addBox(q,.056,p,2.2,.01,.055,"lane");
  }
}
// Sidewalk slabs occupy each urban block. The center of each slab is later
// filled with buildings, leaving realistic setbacks and service lanes.
for(let bx=-HALF;bx<HALF;bx++)for(let bz=-HALF;bz<HALF;bz++){
  const cx=(roads[bx+HALF]+roads[bx+HALF+1])/2;
  const cz=(roads[bz+HALF]+roads[bz+HALF+1])/2;
  addBox(cx,.035,cz,BLOCK/2-ROAD/2-.22,.035,BLOCK/2-ROAD/2-.22,"sidewalk");
}

// Crosswalks at the busiest intersections.
for(const p of roads){
  for(let k=-3;k<=3;k++){
    addBox(p+k*.95,.11,-ROAD/2-.7,.34,.015,1.7,"lane");
    addBox(p+k*.95,.11, ROAD/2+.7,.34,.015,1.7,"lane");
    addBox(-ROAD/2-.7,.11,p+k*.95,1.7,.015,.34,"lane");
    addBox( ROAD/2+.7,.11,p+k*.95,1.7,.015,.34,"lane");
  }
}

// Building generator.
const buildingMats=["concrete_light","brick_red","plaster_cream","brick_dark","plaster_old","metal_panel","tile_blue","tile_green","stone","paint_worn","paint_blue","paint_green","paint_brown","warehouse_panel"];
let seed=92317;
const R=rand(seed);
function building(x,z,w,d,h,style){
  const mat=buildingMats[style%buildingMats.length];
  addBox(x,h/2,z,w/2,h/2,d/2,mat,0,true);
  // Floor plates / parapets give silhouettes more structure than boxes.
  for(let y=3.1;y<h-.65;y+=3.1)addBox(x,y,z,w/2+.025,.045,d/2+.025,"dark");
  addBox(x,h+.08,z,w/2+.12,.08,d/2+.12,"roof");

  const cols=Math.max(2,Math.floor(w/2.45));
  const rows=Math.max(2,Math.floor((h-2)/2.9));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const wx=x-w/2+(c+.5)*w/cols, wy=2+r*2.9;
    if(wy>h-.7)continue;
    const ww=Math.min(1.05,w/cols*.54);
    const on=((c*17+r*13+style*7)%9)<6;
    const wmat=on?(style%5===0?"window_lit":style%5===1?"window_reflect":"window"):"window_dark";
    addBox(wx,wy,z-d/2-.035,ww,.68,.025,wmat);
    addBox(wx,wy,z+d/2+.035,ww,.68,.025,wmat);
  }
  const sc=Math.max(2,Math.floor(d/3.0));
  for(let r=0;r<rows;r++)for(let c=0;c<sc;c++){
    const wz=z-d/2+(c+.5)*d/sc,wy=2+r*2.9;
    if(wy>h-.7)continue;
    addBox(x-w/2-.035,wy,wz,.025,.68,Math.min(1.0,d/sc*.45),"glass");
    addBox(x+w/2+.035,wy,wz,.025,.68,Math.min(1.0,d/sc*.45),"glass");
  }
  // Ground-floor entrance / storefront.
  addBox(x,1.15,z-d/2-.055,1.35,1.15,.08,"dark");
  addBox(x,1.15,z-d/2-.09,.82,.93,.025,"glass");
  if(style%3===0)addBox(x,3.25,z-d/2-.09,2.3,.18,.08,"sign_red");
  if(style%5===0)addBox(x-.8,h+.48,z,.5,.42,.5,"metal");
}

// Populate every block with irregular footprints. Buildings stay inside the block
// interior so no collider can overlap the surrounding street lanes.
const INNER=(BLOCK-ROAD)/2-1.25;
for(let bx=-HALF;bx<HALF;bx++)for(let bz=-HALF;bz<HALF;bz++){
  const x0=roads[bx+HALF],x1=roads[bx+HALF+1],z0=roads[bz+HALF],z1=roads[bz+HALF+1];
  const cx=(x0+x1)/2,cz=(z0+z1)/2;
  const local=rand((bx+12)*9283+(bz+17)*17389+seed);
  const central=Math.abs(cx)<80&&Math.abs(cz)<80;
  const commercial=(Math.abs(cx)<45||Math.abs(cz)<45);
  const count=central?2:1;
  for(let n=0;n<count;n++){
    const w=7+local()*8,d=7+local()*8,h=(central?10:7)+local()*(commercial?16:10);
    const maxC=INNER-Math.max(w,d)/2;
    const px=cx+(local()*2-1)*Math.max(1,maxC-1.0), pz=cz+(local()*2-1)*Math.max(1,maxC-1.0);
    building(px,pz,w,d,h,Math.floor(local()*20));
  }
  // Ground-floor storefront strip, also kept clear of traffic lanes.
  if(commercial){
    const side=local()>.5 ? 1 : -1;
    const yy=cz+side*(ROAD/2+3.25);
    for(let n=-1;n<=1;n++){
      const px=cx+n*7.0;
      building(px,yy,5.8,4.6,5.0+local()*3.0,Math.floor(local()*20));
    }
  }
}

// Alleys / service strips between selected buildings.
for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
  if((i+j)%2===0){
    const x=i*BLOCK+BLOCK/2,z=j*BLOCK+BLOCK/2;
    addBox(x,.045,z,1.15,.045,15.5,"asphalt");
  }
}

// Street lamps throughout the district.
function streetLamp(x,z,flip=1){
  addCylinder(x,2.7,z,.075,5.4,"metal",8);
  addBox(x+.55*flip,5.25,z,.65,.055,.055,"metal");
  addBox(x+1.12*flip,5.05,z,.16,.10,.10,"light");
}
for(const p of roads){
  streetLamp(p-5.3,-5.3,1);streetLamp(p+5.3,5.3,-1);
  streetLamp(-5.3,p,-1);streetLamp(5.3,p,1);
}

// Utility poles on selected residential edges.
function pole(x,z){
  addCylinder(x,4,z,.11,8,"wood",8);
  addBox(x,8.05,z,.95,.09,.09,"wood");
  for(let i=-2;i<=2;i++)addCylinder(x+i*.46,8.18,z,.028,.12,"metal",6);
}
function wire(x1,z1,x2,z2,y){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),ang=Math.atan2(dz,dx);
  addBox((x1+x2)/2,y,(z1+z2)/2,len/2,.025,.025,"dark",ang);
}
for(const p of roads){
  if(Math.abs(p)>70){
    pole(p-4,-HALF*BLOCK+5); pole(p+4,HALF*BLOCK-5);
    wire(p-4,-HALF*BLOCK+5,p+4,-HALF*BLOCK+5,8.2);
  }
}

// Parking lots and parked cars.
function car(x,z,yaw,body){
  addBox(x,.55,z,1.0,.5,2.15,body,yaw,true);
  addBox(x,1.0,z,.76,.32,1.25,"glass",yaw);
  addBox(x,.3,z-1.65,.34,.22,.25,"dark",yaw);
  addBox(x,.3,z+1.65,.34,.22,.25,"dark",yaw);
}
const carColors=["#4c5254","#6f6459","#3d4548","#747777","#50555a","#6a514b"];
for(let i=-3;i<=3;i++){
  const x=i*BLOCK+BLOCK/2;
  car(x,-7.0,0,carColors[(i+4)%carColors.length]);
  car(x,7.0,Math.PI,carColors[(i+6)%carColors.length]);
}
for(let i=-3;i<=3;i++){
  const z=i*BLOCK+BLOCK/2;
  car(-7.0,z,Math.PI/2,carColors[(i+3)%carColors.length]);
  car(7.0,z,-Math.PI/2,carColors[(i+5)%carColors.length]);
}

// Trees, planters, benches and bins.
function tree(x,z,scale=1){
  addCylinder(x,1.0*scale,z,.16*scale,2*scale,"wood",8);
  addBox(x,2.4*scale,z,.8*scale,1.1*scale,.8*scale,"leaf");
  addBox(x+.35*scale,3.0*scale,z-.15*scale,.55*scale,.55*scale,.55*scale,"leaf");
}
for(const p of [[-5,-5],[5,-5],[-5,5],[5,5],[-44,-44],[44,-44],[-44,44],[44,44],
                [-82,-82],[82,-82],[-82,82],[82,82]])tree(p[0],p[1],.9);
for(const [x,z] of [[-5,-8],[5,-8],[-8,5],[8,-5]])addBox(x,.45,z,.35,.45,.35,"metal");

// Distant skyline beyond the playable district.
const skylineR=rand(4401);
for(let x=-130;x<=130;x+=8)for(let z=-130;z<=130;z+=10){
  if(Math.abs(x)<104&&Math.abs(z)<104)continue;
  const h=12+Math.floor(skylineR()*38),w=3+skylineR()*4,d=3+skylineR()*4;
  addBox(x,h/2,z,w/2,h/2,d/2,(skylineR()>.5)?"concrete":"brick");
}
addBox(0,-.4,-145,145,.4,.5,"dark");addBox(0,-.4,145,145,.4,.5,"dark");
addBox(-145,-.4,0,.5,.4,145,"dark");addBox(145,-.4,0,.5,.4,145,"dark");

// Pack geometry into one static draw call.
const stride=3+3+2+4, count=P.length/3;
const data=new Float32Array(count*stride);
for(let i=0;i<count;i++){
 data[i*stride+0]=P[i*3];data[i*stride+1]=P[i*3+1];data[i*stride+2]=P[i*3+2];
 data[i*stride+3]=C[i*3];data[i*stride+4]=C[i*3+1];data[i*stride+5]=C[i*3+2];
 data[i*stride+6]=UV[i*2];data[i*stride+7]=UV[i*2+1];
 data[i*stride+8]=COL[i*4];data[i*stride+9]=COL[i*4+1];data[i*stride+10]=COL[i*4+2];data[i*stride+11]=1;
}
const vao=gl.createVertexArray(),buf=gl.createBuffer();
gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride*4,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride*4,12);
gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride*4,24);
gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,stride*4,32);

// FPS PLAYER / CONTROLS -----------------------------------------------------
// One canonical player state drives BOTH movement and camera. There are no
// secondary camera/player variables, so mobile and desktop input end up in the
// exact same update path.
const player={x:0,y:1.72,z:0,yaw:0,pitch:0};
const keys=Object.create(null);
const stick={active:false,id:null,x:0,y:0};
const look={active:false,id:null,x:0,y:0};
let running=false,started=startPressed;
const stickEl=document.getElementById('stick'),knob=document.getElementById('knob'),runBtn=document.getElementById('runBtn');
const lookSurface=document.getElementById('lookSurface');
function setKnob(dx,dy){knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;}
function stickSetXY(clientX,clientY){
 const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 let dx=clientX-cx,dy=clientY-cy,max=Math.max(24,r.width*.34),m=Math.hypot(dx,dy)||1;
 if(m>max){dx*=max/m;dy*=max/m;} setKnob(dx,dy); stick.x=dx/max; stick.y=dy/max;
}
function resetStick(){stick.active=false;stick.id=null;stick.x=0;stick.y=0;setKnob(0,0);}
function setLook(lastX,lastY){look.x=lastX;look.y=lastY;}
function applyLook(dx,dy){player.yaw-=dx*.005;player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-dy*.004));}
function begin(e){
 if(!started)return; e.preventDefault();
 const x=e.clientX,y=e.clientY;
 if(x<innerWidth*.42){ if(e.pointerId!==undefined){stick.active=true;stick.id=e.pointerId;stickEl.setPointerCapture?.(e.pointerId);} stickSetXY(x,y); }
 else {look.active=true;look.id=e.pointerId;setLook(x,y);lookSurface.setPointerCapture?.(e.pointerId);}
}
function move(e){
 if(!started)return; e.preventDefault();
 if(stick.active && e.pointerId===stick.id){stickSetXY(e.clientX,e.clientY);return;}
 if(look.active && e.pointerId===look.id){applyLook(e.clientX-look.x,e.clientY-look.y);setLook(e.clientX,e.clientY);}
}
function end(e){if(e.pointerId===stick.id)resetStick();if(e.pointerId===look.id){look.active=false;look.id=null;}}
for(const el of [canvas,lookSurface,stickEl]){el.addEventListener('pointerdown',begin,{passive:false});el.addEventListener('pointermove',move,{passive:false});el.addEventListener('pointerup',end,{passive:false});el.addEventListener('pointercancel',end,{passive:false});}
// iOS Safari fallback: direct TouchEvents, allowing two simultaneous touches.
let touchStickId=null,touchLookId=null,touchLastX=0,touchLastY=0;
document.addEventListener('touchstart',e=>{
 if(window.PointerEvent)return;
 if(!started)return; e.preventDefault();
 for(const t of e.changedTouches){if(touchStickId===null && t.clientX<innerWidth*.42){touchStickId=t.identifier;stickSetXY(t.clientX,t.clientY);} else if(touchLookId===null && t.clientX>=innerWidth*.42){touchLookId=t.identifier;touchLastX=t.clientX;touchLastY=t.clientY;}}
},{passive:false});
document.addEventListener('touchmove',e=>{
 if(window.PointerEvent)return;
 if(!started)return; e.preventDefault();
 for(const t of e.changedTouches){if(t.identifier===touchStickId)stickSetXY(t.clientX,t.clientY);if(t.identifier===touchLookId){applyLook(t.clientX-touchLastX,t.clientY-touchLastY);touchLastX=t.clientX;touchLastY=t.clientY;}}
},{passive:false});
function endTouch(id){if(id===touchStickId){touchStickId=null;resetStick();}if(id===touchLookId){touchLookId=null;look.active=false;}}
document.addEventListener('touchend',e=>{if(window.PointerEvent)return;for(const t of e.changedTouches)endTouch(t.identifier);},{passive:false});
document.addEventListener('touchcancel',e=>{if(window.PointerEvent)return;for(const t of e.changedTouches)endTouch(t.identifier);},{passive:false});
runBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();running=true;runBtn.classList.add('pressed');},{passive:false});
for(const ev of ['pointerup','pointercancel','pointerleave'])runBtn.addEventListener(ev,()=>{running=false;runBtn.classList.remove('pressed')},{passive:false});
runBtn.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();running=true;runBtn.classList.add('pressed')},{passive:false});
runBtn.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();running=false;runBtn.classList.remove('pressed')},{passive:false});

// Desktop: click to capture the mouse and use true FPS mouse look.
let pointerLocked=false;
document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===canvas;});
canvas.addEventListener('click',()=>{if(started && matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();});
document.addEventListener('mousemove',e=>{
 if(!pointerLocked)return;
 player.yaw-=e.movementX*.0024;
 player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-e.movementY*.0020));
});

// ENTER CITY is bound at boot; only desktop pointer-lock is requested here.
enterEl?.addEventListener('click',()=>{
 started=true;
 if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();
},{once:true});
addEventListener('contextmenu',e=>e.preventDefault());
for(const n of ['gesturestart','gesturechange','gestureend'])addEventListener(n,e=>e.preventDefault(),{passive:false});

function collides(nx,nz){
 const r=.42;
 if(Math.abs(nx)>142||Math.abs(nz)>142)return true;
 for(const c of colliders){
   if(Math.abs(nx-c.x)<c.sx+r && Math.abs(nz-c.z)<c.sz+r)return true;
 }
 return false;
}
function update(dt){
 let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
 let str=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
 if(stick.active || Math.abs(stick.x)+Math.abs(stick.y)>.02){str=stick.x;f=-stick.y;}
 const mag=Math.hypot(f,str);
 if(mag>1){f/=mag;str/=mag;}
 const speed=(running||keys.ShiftLeft||keys.ShiftRight)?8.4:4.6;
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
 const dx=(sy*f+cy*str)*speed*dt;
 const dz=(-cy*f+sy*str)*speed*dt;
 const nx=player.x+dx,nz=player.z+dz;
 // Small stepwise collision lets the player slide along walls instead of
 // getting stuck when both axes hit an obstacle.
 if(!collides(nx,player.z))player.x=nx;
 if(!collides(player.x,nz))player.z=nz;
}

function persp(fov,asp,n,f){
 const t=1/Math.tan(fov/2),m=new Float32Array(16);
 m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=(2*f*n)/(n-f);
 return m;
}
function lookAtView(){
 const yaw=player.yaw,pitch=player.pitch;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 // Right / up / forward basis, row-major basis packed into column-major WebGL matrix.
 const fx=sy*cp,fy=sp,fz=-cy*cp;
 const rx=cy,ry=0,rz=sy;
 const ux=-sy*sp,uy=cp,uz=cy*sp;
 const m=new Float32Array(16);
 m[0]=rx;m[1]=ux;m[2]=-fx;m[3]=0;
 m[4]=ry;m[5]=uy;m[6]=-fy;m[7]=0;
 m[8]=rz;m[9]=uz;m[10]=-fz;m[11]=0;m[15]=1;
 m[12]=-(rx*player.x+ry*player.y+rz*player.z);
 m[13]=-(ux*player.x+uy*player.y+uz*player.z);
 m[14]=-((-fx)*player.x+(-fy)*player.y+(-fz)*player.z);
 return m;
}
function mul(a,b){
 const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++){
  o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
 }
 return o;
}
function resize(){
 const d=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}
addEventListener('resize',resize);resize();

gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);

let last=performance.now(),fps=60,frames=0,ft=last;
let worldTime=12.0;
const DAY_LENGTH=180.0; // one full 24h cycle = 3 real minutes
function timeLighting(t){
 const a=(t/24)*Math.PI*2-Math.PI/2;
 const sun=Math.max(0,Math.sin(a));
 const day=Math.max(.12,Math.min(1,sun));
 const night=1-day;
 const az=a-.35;
 const sunDir=[Math.cos(az)*.72,Math.max(.08,sun),Math.sin(az)*.72];
 return {sun,day,night,sunDir};
}
function formatWorldTime(t){
 const h=Math.floor(t)%24,m=Math.floor((t%1)*60);
 return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function render(){
 if(!ready)return;
 const light=timeLighting(worldTime);
 const pv=mul(persp(Math.PI/3,canvas.width/canvas.height,.05,220),lookAtView());
 // Keep the sky itself synchronized with time-of-day.
 const skyDay=[.46,.57,.68], skyNight=[.025,.035,.06];
 const q=light.night;
 gl.clearColor(
  skyDay[0]*(1-q)+skyNight[0]*q,
  skyDay[1]*(1-q)+skyNight[1]*q,
  skyDay[2]*(1-q)+skyNight[2]*q,1
 );
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(prog);gl.bindVertexArray(vao);
 gl.uniformMatrix4fv(vpLoc,false,pv);
 gl.uniform3f(sunLoc,light.sunDir[0],light.sunDir[1],light.sunDir[2]);
 gl.uniform3f(camLoc,player.x,player.y,player.z);
 gl.uniform1f(dayLoc,light.day);
 gl.uniform1f(nightLoc,light.night);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(prog,'atlas'),0);
 gl.drawArrays(gl.TRIANGLES,0,count);
}
function loop(now){
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 worldTime=(worldTime+dt*24/DAY_LENGTH)%24;
 update(dt);render();
 const stats=document.getElementById('stats');
 stats.textContent=`${fps} FPS  |  ${formatWorldTime(worldTime)}  |  POS ${player.x.toFixed(1)}, ${player.z.toFixed(1)}`;
 frames++;if(now-ft>700){fps=Math.round(frames*1000/(now-ft));frames=0;ft=now;}
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
