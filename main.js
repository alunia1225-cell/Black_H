
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
 float hemi=.78+.22*lam;
 vec3 c=tex.rgb*vTint.rgb*hemi;
 // Windows carry a warm emissive lift.
 float warm=smoothstep(.56,.8,tex.r)*vTint.a;
 c+=vec3(.12,.075,.025)*warm;
 float fog=smoothstep(115.0,180.0,length(vW-cam));
 c=mix(c,vec3(.48,.52,.54),fog*.45);
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

const A={
concrete:[0,.0,.125,.125],brick:[.125,0,.25,.125],glass:[.25,0,.375,.125],window:[.375,0,.5,.125],
asphalt:[0,.125,.125,.25],sidewalk:[.125,.125,.25,.25],roof:[.25,.125,.375,.25],dark:[.375,.125,.5,.25],
metal:[0,.25,.125,.375],grass:[.125,.25,.25,.375],sign_red:[.25,.25,.375,.375],sign_blue:[.375,.25,.5,.375],
lane:[0,.375,.125,.5],light:[.125,.375,.25,.5],wood:[.25,.375,.375,.5],leaf:[.375,.375,.5,.5],
brick_red:[.5,0,.625,.125],brick_dark:[.625,0,.75,.125],stucco_warm:[.75,0,.875,.125],concrete_dirty:[.875,0,1,.125],
painted_concrete:[.5,.125,.625,.25],metal_corrugated:[.625,.125,.75,.25],metal_rusted:[.75,.125,.875,.25],roof_tar:[.875,.125,1,.25],
roof_shingle:[.5,.25,.625,.375],wood_siding:[.625,.25,.75,.375],plywood:[.75,.25,.875,.375],stone_block:[.875,.25,1,.375],
granite:[.5,.375,.625,.5],glass_blue:[.625,.375,.75,.5],glass_green:[.75,.375,.875,.5],window_dirty:[.875,.375,1,.5],
asphalt_worn:[.5,.5,.625,.625],asphalt_patch:[.625,.5,.75,.625],sidewalk_paver:[.75,.5,.875,.625],curb_worn:[.875,.5,1,.625],
tile_dirty:[.5,.625,.625,.75],graffiti_wall:[.625,.625,.75,.75],plaster_stain:[.75,.625,.875,.75],dark_glass:[.875,.625,1,.75]};

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
 let t=A.concrete, tint=[1,1,1];
 if(Array.isArray(material)){t=A[material[0]]||A.concrete;tint=material[1]||[1,1,1]}
 else if(typeof material==="string" && A[material]){t=A[material];tint=[1,1,1]}
 else if(typeof material==="string" && material[0]==="#"){t=A.concrete;tint=rgb(material)}
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
function roadBox(){
 // Base terrain: the city blocks sit on a neutral ground plane.
 addBox(0,-.08,0,110,.08,110,"concrete_dirty");
}
roadBox();

// Actual street grid: asphalt corridors are continuous, with sidewalks/buildings kept inside blocks.
const roadW=11.5;
for(const x of [-36,0,36]) addBox(x,.005,0,roadW/2,.025,55,"asphalt");
for(const z of [-36,0,36]) addBox(0,.008,z,55,.025,roadW/2,"asphalt");

// Sidewalk blocks between the streets.
const blocks=[[-54,-54,30,30],[-18,-54,30,30],[18,-54,30,30],[54,-54,30,30],
 [-54,-18,30,30],[-18,-18,30,30],[18,-18,30,30],[54,-18,30,30],
 [-54,18,30,30],[-18,18,30,30],[18,18,30,30],[54,18,30,30],
 [-54,54,30,30],[-18,54,30,30],[18,54,30,30],[54,54,30,30]];
for(const [x,z,w,d] of blocks) addBox(x,.04,z,w/2,.045,d/2,"sidewalk");

// Lane markings and intersections.
for(const x of [-36,0,36]){
 for(let z=-49;z<=49;z+=5.5) addBox(x,.055,z,.08,.012,1.55,"lane");
}
for(const z of [-36,0,36]){
 for(let x=-49;x<=49;x+=5.5) addBox(x,.058,z,1.55,.012,.08,"lane");
}
// Curbs around the three main vertical/horizontal corridors.
for(const x of [-36,0,36]){ addBox(x-roadW/2-.12,.16,0,.12,.14,55,"concrete"); addBox(x+roadW/2+.12,.16,0,.12,.14,55,"concrete"); }
for(const z of [-36,0,36]){ addBox(0,.16,z-roadW/2-.12,55,.14,.12,"concrete"); addBox(0,.16,z+roadW/2+.12,55,.14,.12,"concrete"); }
// Crosswalk bars at each major intersection.
for(const x of [-36,0,36]) for(const z of [-36,0,36]){
 for(let i=-4;i<=4;i++){ addBox(x+i*1.0,.09,z-roadW/2-.8,.32,.012,.65,"lane"); addBox(x-roadW/2-.8,.09,z+i*1.0,.65,.012,.32,"lane"); }
}

// Building generator.
const buildingMats=["concrete_dirty","brick_red","stucco_warm","painted_concrete","brick_dark","stone_block"];
const facadeTints=["#8d8a83","#6e7272","#565c60","#918477","#64676b","#7a7269"];
let seed=92317,R=rand(seed);
function building(x,z,w,d,h,style){
 const mat=buildingMats[style%buildingMats.length];
 addBox(x,h/2,z,w/2,h/2,d/2,mat,0,true);
 // floor bands and roof mechanical parapet
 for(let y=3.2;y<h-.8;y+=3.2)addBox(x,y,z,w/2+.02,.055,d/2+.02,"dark");
 addBox(x,h+.08,z,w/2+.12,.09,d/2+.12,(style%2)?"roof_shingle":"roof_tar");
 // windows every facade module
 const cols=Math.max(2,Math.floor(w/2.6)), rows=Math.max(2,Math.floor((h-2)/3.0));
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const wx=x-w/2+(c+.5)*w/cols, wy=2+r*3;
   if(wy>h-.8)continue;
   const ww=Math.min(1.05,w/cols*.55);
   const on=((c*17+r*13+style*7)%7)<2;
   addBox(wx,wy,z-d/2-.035,ww,.7,.025,on?(style%3===0?"glass_blue":"window_dirty"):"dark",0,false);
   addBox(wx,wy,z+d/2+.035,ww,.7,.025,on?(style%2?"glass_green":"window_dirty"):"dark",0,false);
 }
 const sideRows=Math.max(2,Math.floor((h-2)/3.0)), sideCols=Math.max(2,Math.floor(d/3.2));
 for(let r=0;r<sideRows;r++)for(let c=0;c<sideCols;c++){
  const wz=z-d/2+(c+.5)*d/sideCols,wy=2+r*3;
  if(wy>h-.8)continue;
  addBox(x-w/2-.035,wy,wz,.025,.7,Math.min(1.05,d/sideCols*.55),style%2?"glass_green":"glass_blue");
  addBox(x+w/2+.035,wy,wz,.025,.7,Math.min(1.05,d/sideCols*.55),style%3?"window_dirty":"glass_blue");
 }
 // entrance + storefront
 addBox(x,1.15,z-d/2-.055,1.35,1.15,.08,"dark");
 addBox(x,1.15,z-d/2-.09,.82,.93,.025,"dark_glass");
 if(style%3===0){addBox(x,3.3,z-d/2-.09,2.3,.18,.08,"sign_red");}
 if(style%4===0){addBox(x+.9,h+.55,z,.55,.48,.55,"metal");addBox(x-.9,h+.35,z+.8,.4,.28,.4,"metal");}
}

const spots=[
 [-54,-54,10,12,14,1],[-18,-54,11,13,21,2],[18,-54,12,11,17,3],[54,-54,10,13,18,4],
 [-54,-18,12,10,16,5],[-18,-18,11,12,27,1],[18,-18,13,10,20,2],[54,-18,10,12,15,3],
 [-54,18,11,13,18,4],[-18,18,13,10,24,5],[18,18,12,12,16,1],[54,18,10,11,22,2],
 [-54,54,11,12,19,3],[-18,54,12,10,14,4],[18,54,10,13,23,5],[54,54,12,11,17,1]
]
for(const b of spots)building(...b);

// Low-rise corner/commercial buildings are already represented by the block layout above.

// Street lamps: poles + horizontal arms + glowing lamp blocks.
function streetLamp(x,z,flip=1){
 addCylinder(x,2.7,z,.075,5.4,"metal",8);
 addBox(x+.55*flip,5.25,z,.65,.055,.055,"metal");
 addBox(x+1.12*flip,5.05,z,.16,.10,.10,"light");
}
for(const [x,z,f] of [[-9,-9,1],[9,-9,-1],[-9,9,1],[9,9,-1],[0,-11,1],[0,11,-1],[-11,0,1],[11,0,-1],
[-32,-7,1],[32,-7,-1],[-32,7,1],[32,7,-1],[-7,-32,1],[7,-32,-1],[-7,32,1],[7,32,-1]])streetLamp(x,z,f);

// Utility poles + simplified overhead wires.
function pole(x,z){
 addCylinder(x,4,z,.11,8,"wood",8);
 addBox(x,8.05,z,.95,.09,.09,"wood");
 for(let i=-2;i<=2;i++)addCylinder(x+i*.46,8.18,z,.028,.12,"metal",6);
}
function wire(x1,z1,x2,z2,y){
 const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),ang=Math.atan2(dz,dx);
 addBox((x1+x2)/2,y,(z1+z2)/2,len/2,.025,.025,"dark",ang);
}
for(const [x,z] of [[-11,-24],[11,-24],[-24,-11],[-24,11],[11,24],[-11,24],[24,-11],[24,11]])pole(x,z);
wire(-11,-24,11,-24,8.2);wire(-24,-11,-24,11,8.2);wire(11,24,-11,24,8.2);wire(24,-11,24,11,8.2);

// Parked cars with roof/glass and wheels represented by dark blocks.
function car(x,z,yaw,body){
 addBox(x,.55,z,1.0,.5,2.15,body,yaw,true);
 addBox(x,1.0,z,0.76,.32,1.25,"glass",yaw);
 addBox(x,.3,z-1.65,.34,.22,.25,"dark",yaw);
 addBox(x,.3,z+1.65,.34,.22,.25,"dark",yaw);
}
car(-10,-10,0,"#4c5254");car(10,-10,0,"#6f6459");car(-10,10,0,"#3d4548");car(10,10,0,"#747777");
car(-10,19,Math.PI/2,"#50555a");car(10,-19,Math.PI/2,"#6a514b");
car(-19,-10,Math.PI/2,"#555b59");car(19,10,Math.PI/2,"#4e5257");

// Trees, planters and street bins.
function tree(x,z,scale=1){
 addCylinder(x,1.0*scale,z,.16*scale,2.0*scale,"wood",8);
 addBox(x,2.4*scale,z,.8*scale,1.1*scale,.8*scale,"leaf");
 addBox(x+.35*scale,3.0*scale,z-.15*scale,.55*scale,.55*scale,.55*scale,"leaf");
}
for(const p of [[-13,-14,1],[13,-14,.9],[-13,14,1.1],[13,14,.9],[-21,-7,.8],[21,7,.8]])tree(...p);
for(const [x,z] of [[-5,-8],[5,-8],[-8,-5],[8,5]])addBox(x,.45,z,.35,.45,.35,"metal");

// Benches / bins / hydrants around sidewalks.
for(const [x,z] of [[-6,-8.2],[6,-8.2],[-8.2,6],[8.2,-6]]){
 addBox(x,.42,z,1.0,.08,.28,"wood");
 addBox(x,.2,z-.22,.08,.2,.08,"metal");addBox(x,.2,z+.22,.08,.2,.08,"metal");
}
for(const [x,z] of [[-5,-8.8],[5,-8.8],[-8.8,5],[8.8,-5]])addBox(x,.5,z,.28,.5,.28,"metal");

// Distant skyline — enough mass to prevent an empty horizon.
const skylineR=rand(4401);
for(let x=-105;x<=105;x+=7)for(let z=-105;z<=105;z+=9){
 if(Math.abs(x)<65&&Math.abs(z)<65)continue;
 const h=10+Math.floor(skylineR()*25),w=3+skylineR()*3,d=3+skylineR()*3;
 addBox(x,h/2,z,w/2,h/2,d/2,(skylineR()>.5)?"concrete":"brick");
}

// Ground edge / horizon blockers.
addBox(0,-.4,-112,112,.4,.5,"dark");addBox(0,-.4,112,112,.4,.5,"dark");
addBox(-112,-.4,0,.5,.4,112,"dark");addBox(112,-.4,0,.5,.4,112,"dark");

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

// Mobile-only FPS controls. No keyboard, mouse or pointer-lock path exists in this build.
const player={x:0,y:1.72,z:28,yaw:0,pitch:0};
const stickEl=document.getElementById("stick"),knob=document.getElementById("knob");
const lookEl=document.getElementById("lookSurface"),runBtn=document.getElementById("runBtn"),startEl=document.getElementById("start"),enterBtn=document.getElementById("enter");
const stick={active:false,id:null,x:0,y:0},look={active:false,id:null,x:0,y:0};
let running=false;
function stickSet(t){
 const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 let dx=t.clientX-cx,dy=t.clientY-cy,m=Math.hypot(dx,dy)||1,max=34,k=Math.min(1,max/m);
 dx*=k;dy*=k;knob.style.transform=`translate(${dx}px,${dy}px)`;stick.x=dx/max;stick.y=dy/max;
}
function endStick(e){for(const t of e.changedTouches||[])if(t.identifier===stick.id){stick.active=false;stick.id=null;stick.x=stick.y=0;knob.style.transform="translate(0,0)"}}
stickEl.addEventListener("touchstart",e=>{e.preventDefault();const t=e.changedTouches[0];if(stick.active)return;stick.active=true;stick.id=t.identifier;stickSet(t)},{passive:false});
stickEl.addEventListener("touchmove",e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===stick.id)stickSet(t)},{passive:false});
stickEl.addEventListener("touchend",endStick,{passive:false});stickEl.addEventListener("touchcancel",endStick,{passive:false});
lookEl.addEventListener("touchstart",e=>{e.preventDefault();const t=[...e.changedTouches].find(q=>q.clientX>innerWidth*.32);if(!t||look.active)return;look.active=true;look.id=t.identifier;look.x=t.clientX;look.y=t.clientY},{passive:false});
lookEl.addEventListener("touchmove",e=>{e.preventDefault();for(const t of e.changedTouches)if(look.active&&t.identifier===look.id){player.yaw-=(t.clientX-look.x)*.006;player.pitch=Math.max(-1.42,Math.min(1.42,player.pitch-(t.clientY-look.y)*.0048));look.x=t.clientX;look.y=t.clientY;}},{passive:false});
function endLook(e){for(const t of e.changedTouches||[])if(look.active&&t.identifier===look.id){look.active=false;look.id=null}}
lookEl.addEventListener("touchend",endLook,{passive:false});lookEl.addEventListener("touchcancel",endLook,{passive:false});
runBtn.addEventListener("touchstart",e=>{e.preventDefault();running=true;runBtn.classList.add("pressed")},{passive:false});
function endRun(e){e.preventDefault();running=false;runBtn.classList.remove("pressed")}
runBtn.addEventListener("touchend",endRun,{passive:false});runBtn.addEventListener("touchcancel",endRun,{passive:false});
enterBtn.addEventListener("touchend",e=>{e.preventDefault();startEl.style.display="none"},{passive:false});
enterBtn.addEventListener("click",()=>{startEl.style.display="none"});
addEventListener("contextmenu",e=>e.preventDefault());
for(const n of ["gesturestart","gesturechange","gestureend"])addEventListener(n,e=>e.preventDefault(),{passive:false});

function blocked(nx,nz){
 const r=.48;
 for(const c of colliders){
   if(Math.abs(nx-c.x)<c.sx+r && Math.abs(nz-c.z)<c.sz+r)return true;
 }
 return Math.abs(nx)>106||Math.abs(nz)>106;
}
function update(dt){
 let f=0,s=0;
 if(stick.active||stick.x||stick.y){s=stick.x;f=-stick.y}
 const len=Math.hypot(f,s);if(len>1){f/=len;s/=len}
 const speed=running?8.2:4.5;
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
gl.clearColor(.55,.62,.65,1);

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
