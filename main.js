
(() => {
"use strict";
const canvas=document.getElementById("game");
const gl=canvas.getContext("webgl2",{antialias:true,alpha:false,preserveDrawingBuffer:false});
if(!gl){document.body.innerHTML="<div style='padding:24px;color:#fff;font-family:sans-serif'>このブラウザはWebGL2に対応していません。</div>";return;}

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
out vec4 outColor;
void main(){
 vec4 tex=texture(atlas,vUV);
 float lam=max(dot(normalize(vN),normalize(sunDir)),0.0);
 float hemi=.46+.54*lam;
 vec3 c=tex.rgb*vTint.rgb*hemi;
 // Windows carry a warm emissive lift.
 float warm=smoothstep(.56,.8,tex.r)*vTint.a;
 c+=vec3(.10,.065,.025)*warm;
 float fog=smoothstep(115.0,180.0,length(vW-cam));
 c=mix(c,vec3(.40,.43,.45),fog*.72);
 outColor=vec4(c,1.0);
}`;

function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const vpLoc=gl.getUniformLocation(prog,"vp"), sunLoc=gl.getUniformLocation(prog,"sunDir"), camLoc=gl.getUniformLocation(prog,"cam");

const atlas=new Image(); atlas.src="city_atlas.png";
let texture=null,ready=false;
atlas.onload=()=>{texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);ready=true};

const A={concrete:[0,.0,.25,.25],brick:[.25,0,.5,.25],glass:[.5,0,.75,.25],window:[.75,0,1,.25],
asphalt:[0,.25,.25,.5],sidewalk:[.25,.25,.5,.5],roof:[.5,.25,.75,.5],dark:[.75,.25,1,.5],
metal:[0,.5,.25,.75],grass:[.25,.5,.5,.75],sign_red:[.5,.5,.75,.75],sign_blue:[.75,.5,1,.75],
lane:[0,.75,.25,1],light:[.25,.75,.5,1],wood:[.5,.75,.75,1],leaf:[.75,.75,1,1]};

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
 for(let i=0;i<6;i++){P.push(...vs[i]);C.push(...n);UV.push(us[i][0],us[i][1]);COL.push(...tint,1)}
}
function addBox(x,y,z,sx,sy,sz,material="#ffffff",yaw=0,solid=false){
 let t=A[material]||A.concrete, tint=material==="#ffffff"?[1,1,1]:rgb(material);
 if(Array.isArray(material)){t=A[material[0]]||A.concrete;tint=material[1]}
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
 const tint=A[material]||A.metal;
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
  const x1=x+Math.cos(a)*r,z1=z+Math.sin(a)*r,x2=x+Math.cos(b)*r,z2=z+Math.sin(b)*r;
  face([x1,y-h,z1],[x2,y-h,z2],[x2,y,z2],[x1,y,z1],[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],tint,[.9,.9,.9,1]);
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
const buildingMats=["concrete","brick","glass"];
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
    addBox(wx,wy,z-d/2-.035,ww,.68,.025,on?"window":"dark");
    addBox(wx,wy,z+d/2+.035,ww,.68,.025,on?"window":"dark");
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

// Populate every block with irregular footprints. Some blocks are low-rise
// commercial, others contain a taller anchor building.
for(let bx=-HALF;bx<HALF;bx++)for(let bz=-HALF;bz<HALF;bz++){
  const x0=roads[bx+HALF],x1=roads[bx+HALF+1];
  const z0=roads[bz+HALF],z1=roads[bz+HALF+1];
  const cx=(x0+x1)/2,cz=(z0+z1)/2;
  const local=rand((bx+12)*9283+(bz+17)*17389+seed);
  const central=Math.abs(cx)<80&&Math.abs(cz)<80;
  const commercial=(Math.abs(cx)<45||Math.abs(cz)<45);
  const count=central?3:2;
  for(let n=0;n<count;n++){
    const w=9+local()*9,d=9+local()*9;
    const px=cx+(local()-.5)*14, pz=cz+(local()-.5)*14;
    const h=(central?13:9)+local()*(commercial?18:12);
    building(px,pz,w,d,h,Math.floor(local()*20));
  }
  // Low-rise shop row on major-road facing blocks.
  if(commercial){
    const face=local()>.5;
    const yy=face?z0+4.4:z1-4.4;
    for(let n=-1;n<=1;n++){
      const px=cx+n*8.5;
      building(px,yy,7.2,5.0,5.5+local()*3.5,Math.floor(local()*20));
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

// Camera + controls.
const player={x:0,y:1.72,z:31,yaw:0,pitch:0};
const keys={}, stick={active:false,id:null,x:0,y:0}, look={active:false,id:null,x:0,y:0};
let running=false, locked=false;
addEventListener("keydown",e=>{keys[e.code]=true});
addEventListener("keyup",e=>{keys[e.code]=false});
document.addEventListener("pointerlockchange",()=>locked=document.pointerLockElement===canvas);
document.addEventListener("mousemove",e=>{if(!locked)return;player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.42,Math.min(1.42,player.pitch-e.movementY*.0018))});

const stickEl=document.getElementById("stick"),knob=document.getElementById("knob"),runBtn=document.getElementById("runBtn");
function stickSet(t){
 const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 let dx=t.clientX-cx,dy=t.clientY-cy,m=Math.hypot(dx,dy)||1,max=34,k=Math.min(1,max/m);
 dx*=k;dy*=k;knob.style.transform=`translate(${dx}px,${dy}px)`;stick.x=dx/max;stick.y=dy/max;
}
stickEl.addEventListener("touchstart",e=>{e.preventDefault();const t=e.changedTouches[0];stick.active=true;stick.id=t.identifier;stickSet(t)},{passive:false});
stickEl.addEventListener("touchmove",e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===stick.id)stickSet(t)},{passive:false});
function endStick(e){for(const t of e.changedTouches)if(t.identifier===stick.id){stick.active=false;stick.id=null;stick.x=stick.y=0;knob.style.transform="translate(0,0)"}}
stickEl.addEventListener("touchend",endStick,{passive:false});stickEl.addEventListener("touchcancel",endStick,{passive:false});
runBtn.addEventListener("touchstart",e=>{e.preventDefault();running=true;runBtn.classList.add("pressed")},{passive:false});
runBtn.addEventListener("touchend",e=>{e.preventDefault();running=false;runBtn.classList.remove("pressed")},{passive:false});
runBtn.addEventListener("touchcancel",()=>{running=false;runBtn.classList.remove("pressed")},{passive:false});

canvas.addEventListener("touchstart",e=>{
 for(const t of e.changedTouches)if(t.clientX>innerWidth*.34&&!look.active){look.active=true;look.id=t.identifier;look.x=t.clientX;look.y=t.clientY}
 e.preventDefault();
},{passive:false});
canvas.addEventListener("touchmove",e=>{
 for(const t of e.changedTouches)if(look.active&&t.identifier===look.id){
   player.yaw-= (t.clientX-look.x)*.006;
   player.pitch=Math.max(-1.42,Math.min(1.42,player.pitch-(t.clientY-look.y)*.0048));
   look.x=t.clientX;look.y=t.clientY;
 }
 e.preventDefault();
},{passive:false});
function endLook(e){for(const t of e.changedTouches)if(look.active&&t.identifier===look.id){look.active=false;look.id=null}}
canvas.addEventListener("touchend",endLook,{passive:false});canvas.addEventListener("touchcancel",endLook,{passive:false});
canvas.addEventListener("click",()=>{if(matchMedia("(pointer:fine)").matches)canvas.requestPointerLock()});

document.getElementById("enter").onclick=()=>{
 document.getElementById("start").style.display="none";
 if(matchMedia("(pointer:fine)").matches)canvas.requestPointerLock();
};
addEventListener("contextmenu",e=>e.preventDefault());
for(const n of ["gesturestart","gesturechange","gestureend"])addEventListener(n,e=>e.preventDefault(),{passive:false});

function blocked(nx,nz){
 const r=.48;
 for(const c of colliders){
   if(Math.abs(nx-c.x)<c.sx+r && Math.abs(nz-c.z)<c.sz+r)return true;
 }
 return Math.abs(nx)>142||Math.abs(nz)>142;
}
function update(dt){
 let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
 if(stick.active||stick.x||stick.y){s=stick.x;f=-stick.y}
 const len=Math.hypot(f,s);if(len>1){f/=len;s/=len}
 const speed=(running||keys.ShiftLeft||keys.ShiftRight)?8.2:4.5;
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
 const dx=(sy*f+cy*s)*speed*dt,dz=(-cy*f+sy*s)*speed*dt;
 if(!blocked(player.x+dx,player.z))player.x+=dx;
 if(!blocked(player.x,player.z+dz))player.z+=dz;
}
function persp(fov,asp,n,f){
 const t=1/Math.tan(fov/2),m=new Float32Array(16);
 m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=(2*f*n)/(n-f);return m;
}
function view(){
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
 const fx=sy*cp,fy=sp,fz=-cy*cp,rx=cy,rz=sy,uy=-sy*sp,vy=cp,uz=cy*sp;
 const m=new Float32Array(16);
 m[0]=rx;m[1]=uy;m[2]=-fx;m[3]=0;
 m[4]=0;m[5]=vy;m[6]=-fy;m[7]=0;
 m[8]=rz;m[9]=uz;m[10]=-fz;m[11]=0;m[15]=1;
 m[12]=-(rx*player.x+rz*player.z);
 m[13]=-(vy*player.y);
 m[14]=-((-fx)*player.x+(-fy)*player.y+(-fz)*player.z);
 return m;
}
function mul(a,b){
 const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
 return o;
}
function resize(){
 const d=Math.min(devicePixelRatio||1,1.5),w=Math.floor(innerWidth*d),h=Math.floor(innerHeight*d);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
}
addEventListener("resize",resize);resize();
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
gl.clearColor(.34,.38,.40,1);

let last=performance.now(),fps=60,frames=0,ft=last;
function render(){
 if(!ready)return;
 const pv=mul(persp(Math.PI/3,canvas.width/canvas.height,.05,220),view());
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(prog);gl.bindVertexArray(vao);
 gl.uniformMatrix4fv(vpLoc,false,pv);gl.uniform3f(sunLoc,-.42,.84,.36);gl.uniform3f(camLoc,player.x,player.y,player.z);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.drawArrays(gl.TRIANGLES,0,count);
}
function loop(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();
 frames++;if(now-ft>600){fps=Math.round(frames*1000/(now-ft));frames=0;ft=now;document.getElementById("stats").textContent=fps+" FPS  |  CITY "+Math.round(count/36)+" tris/box-equivalent";}
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
