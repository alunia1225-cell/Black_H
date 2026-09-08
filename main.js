(() => {
"use strict";
const canvas = document.getElementById("game");
const gl = canvas.getContext("webgl2", { antialias:true, alpha:false, preserveDrawingBuffer:false });
if (!gl) { document.body.innerHTML = "<div style='padding:24px;color:#fff;font-family:sans-serif'>このブラウザはWebGL2に対応していません。</div>"; return; }

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 p;
layout(location=1) in vec3 n;
layout(location=2) in vec2 uv;
layout(location=3) in vec4 tint;
uniform mat4 vp;
out vec3 vN;
out vec2 vUV;
out vec4 vTint;
out vec3 vW;
void main(){
  vec4 w=vec4(p,1.0);
  vW=w.xyz; vN=n; vUV=uv; vTint=tint;
  gl_Position=vp*w;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec2 vUV;
in vec4 vTint;
in vec3 vW;
uniform sampler2D atlas;
uniform vec3 sunDir;
uniform vec3 cam;
out vec4 outColor;
void main(){
  vec4 tex=texture(atlas,vUV);
  vec3 N=normalize(vN);
  float sun=max(dot(N,normalize(sunDir)),0.0);
  // Keep streets and building sides readable even when they face away from the sun.
  float hemi=0.70+0.30*sun;
  vec3 c=tex.rgb*vTint.rgb*hemi;
  // Soft warm lift for bright window pixels.
  float warm=smoothstep(0.50,0.78,tex.r)*smoothstep(0.34,0.70,tex.g)*vTint.a;
  c+=vec3(0.035,0.022,0.010)*warm;
  // Very light distance haze; never crushes the city to black.
  float fog=smoothstep(135.0,210.0,length(vW-cam));
  c=mix(c,vec3(0.44,0.50,0.54),fog*0.34);
  outColor=vec4(c,1.0);
}`;

function compile(type,src){
  const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
  return s;
}
const prog=gl.createProgram();
gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));
gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const vpLoc=gl.getUniformLocation(prog,"vp"), sunLoc=gl.getUniformLocation(prog,"sunDir"), camLoc=gl.getUniformLocation(prog,"cam");

const atlas=new Image();
atlas.src="city_atlas.png";
let texture=null,ready=false;
atlas.onload=()=>{
  texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,atlas);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D); ready=true;
};

const A={
  concrete:[0,.0,.25,.25], brick:[.25,0,.5,.25], glass:[.5,0,.75,.25], window:[.75,0,1,.25],
  asphalt:[0,.25,.25,.5], sidewalk:[.25,.25,.5,.5], roof:[.5,.25,.75,.5], dark:[.75,.25,1,.5],
  metal:[0,.5,.25,.75], grass:[.25,.5,.5,.75], sign_red:[.5,.5,.75,.75], sign_blue:[.75,.5,1,.75],
  lane:[0,.75,.25,1], light:[.25,.75,.5,1], wood:[.5,.75,.75,1], leaf:[.75,.75,1,1]
};
const T={
  concrete:[0.74,0.75,0.73,1], concreteWarm:[0.79,0.74,0.67,1], concreteDark:[0.46,0.48,0.49,1],
  brick:[0.78,0.62,0.56,1], brickDark:[0.50,0.42,0.39,1], glass:[0.53,0.70,0.78,1], glassBlue:[0.38,0.58,0.72,1],
  window:[0.92,0.90,0.78,1], windowDark:[0.25,0.29,0.32,1], asphalt:[0.25,0.27,0.29,1], asphaltLight:[0.31,0.32,0.32,1],
  sidewalk:[0.67,0.66,0.62,1], sidewalkLight:[0.76,0.74,0.69,1], roof:[0.30,0.27,0.26,1], roofLight:[0.42,0.40,0.37,1],
  metal:[0.54,0.57,0.59,1], metalDark:[0.23,0.25,0.26,1], grass:[0.43,0.51,0.38,1], sign_red:[0.82,0.18,0.14,1],
  sign_blue:[0.14,0.38,0.62,1], lane:[0.92,0.86,0.62,1], light:[1.0,0.90,0.64,1], wood:[0.44,0.30,0.20,1], leaf:[0.33,0.46,0.28,1], black:[0.06,0.07,0.08,1], white:[0.92,0.92,0.88,1]
};

const P=[],N=[],UV=[],COL=[];
const colliders=[];
const rand=(seed)=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=t;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296}};
const R=rand(398172);

function face(a,b,c,d,n,uv,tint){
  const [u0,v0,u1,v1]=uv;
  const vs=[a,b,c,a,c,d], us=[[u0,v0],[u1,v0],[u1,v1],[u0,v0],[u1,v1],[u0,v1]];
  for(let i=0;i<6;i++){ P.push(...vs[i]); N.push(...n); UV.push(...us[i]); COL.push(...tint); }
}
function resolveMaterial(material,tintOverride){
  if(Array.isArray(material)) return {uv:A[material[0]]||A.concrete,tint:material[1]||T.concrete};
  return {uv:A[material]||A.concrete,tint:tintOverride||T[material]||T.concrete};
}
function addBox(x,y,z,sx,sy,sz,material="concrete",yaw=0,solid=false,tintOverride=null){
  const {uv,tint}=resolveMaterial(material,tintOverride);
  const [c,s]=[Math.cos(yaw),Math.sin(yaw)];
  const local=[[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz],[sx,-sy,-sz],[-sx,-sy,-sz],[-sx,sy,-sz],[sx,sy,-sz]];
  const tr=q=>[x+q[0]*c-q[2]*s,y+q[1],z+q[0]*s+q[2]*c];
  const p=local.map(tr);
  const f=[
    [p[0],p[1],p[2],p[3],[0,0,1]], [p[4],p[5],p[6],p[7],[0,0,-1]],
    [p[1],p[4],p[7],p[2],[1,0,0]], [p[5],p[0],p[3],p[6],[-1,0,0]],
    [p[3],p[2],p[7],p[6],[0,1,0]], [p[5],p[4],p[1],p[0],[0,-1,0]]
  ];
  for(const q of f){
    let nn=q[4];
    if(yaw!==0){ const nx=nn[0]*c+nn[2]*s, nz=-nn[0]*s+nn[2]*c; nn=[nx,nn[1],nz]; }
    face(q[0],q[1],q[2],q[3],nn,uv,tint);
  }
  if(solid) colliders.push({x,z,sx:Math.abs(sx),sz:Math.abs(sz),y,sy,yaw});
}
function addCylinder(x,y,z,r,h,material="metal",segments=8,tintOverride=null){
  const {uv,tint}=resolveMaterial(material,tintOverride);
  for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    const x1=x+Math.cos(a)*r,z1=z+Math.sin(a)*r,x2=x+Math.cos(b)*r,z2=z+Math.sin(b)*r;
    face([x1,y-h,z1],[x2,y-h,z2],[x2,y,z2],[x1,y,z1],[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],uv,tint);
  }
}

// --- City layout: a real street grid with separate roadway / curb / sidewalk / lots. ---
const ROAD_W=14, BLOCK=36, EXTENT=110;
const streets=[-54,-18,18,54];
addBox(0,-0.08,0,110,.08,110,"asphalt",0,false,T.asphalt);
// Cross streets and main roads as explicit layers.
for(const x of streets) addBox(x,0.00,0,ROAD_W/2,.035,110,"asphalt",0,false,T.asphaltLight);
for(const z of streets) addBox(0,0.005,z,110,.035,ROAD_W/2,"asphalt",0,false,T.asphaltLight);
// Center/edge road markings.
for(const x of streets){
  for(let z=-103;z<=103;z+=8) addBox(x,0.045,z,0.055,.012,2.45,"lane",0,false,T.lane);
  addBox(x-ROAD_W/2+0.55,0.047,0,0.045,.014,110,"lane",0,false,T.white);
  addBox(x+ROAD_W/2-0.55,0.047,0,0.045,.014,110,"lane",0,false,T.white);
}
for(const z of streets){
  for(let x=-103;x<=103;x+=8) addBox(x,0.05,z,2.45,.012,0.055,"lane",0,false,T.lane);
  addBox(0,0.052,z,110,.014,0.045,"lane",0,false,T.white);
}
// Curbs and sidewalks around every street.
for(const x of streets){
  addBox(x-ROAD_W/2-1.0,0.18,0,0.55,.18,110,"concrete",0,false,T.concreteDark);
  addBox(x+ROAD_W/2+1.0,0.18,0,0.55,.18,110,"concrete",0,false,T.concreteDark);
  addBox(x-ROAD_W/2-3.2,0.09,0,1.7,.09,110,"sidewalk",0,false,T.sidewalk);
  addBox(x+ROAD_W/2+3.2,0.09,0,1.7,.09,110,"sidewalk",0,false,T.sidewalkLight);
}
for(const z of streets){
  addBox(0,0.18,z-ROAD_W/2-1.0,110,.18,.55,"concrete",0,false,T.concreteDark);
  addBox(0,0.18,z+ROAD_W/2+1.0,110,.18,.55,"concrete",0,false,T.concreteDark);
  addBox(0,0.09,z-ROAD_W/2-3.2,110,.09,1.7,"sidewalk",0,false,T.sidewalk);
  addBox(0,0.09,z+ROAD_W/2+3.2,110,.09,1.7,"sidewalk",0,false,T.sidewalkLight);
}
// Crosswalk stripes at major intersections.
for(const sx of streets) for(const sz of streets){
  for(let k=-4;k<=4;k++){
    addBox(sx+k*1.2,0.075,sz-9.4,.34,.012,1.35,"lane",0,false,T.white);
    addBox(sx+k*1.2,0.075,sz+9.4,.34,.012,1.35,"lane",0,false,T.white);
    addBox(sx-9.4,0.075,sz+k*1.2,1.35,.012,.34,"lane",0,false,T.white);
    addBox(sx+9.4,0.075,sz+k*1.2,1.35,.012,.34,"lane",0,false,T.white);
  }
}

function building(x,z,w,d,h,kind=0,rot=0){
  const mats=["concrete","brick","glass","concrete","brick"][kind%5];
  const tint=[T.concrete,T.brick,T.glassBlue,T.concreteWarm,T.brickDark][kind%5];
  addBox(x,h/2,z,w/2,h/2,d/2,mats,rot,true,tint);
  addBox(x,h+0.12,z,w/2+0.18,.10,d/2+0.18,"roof",rot,false,(kind%3===0)?T.roofLight:T.roof);
  const rows=Math.max(2,Math.floor((h-1.4)/3.1));
  const cols=Math.max(2,Math.floor((w-1.6)/2.8));
  const sideCols=Math.max(2,Math.floor((d-1.6)/2.8));
  for(let r=0;r<rows;r++){
    const wy=1.8+r*3.05;
    if(wy>h-0.75) continue;
    for(let c=0;c<cols;c++){
      const wx=x-w/2+0.9+(c*(w-1.8)/Math.max(1,cols-1));
      const lit=((c*11+r*7+kind*5)%5)!==0;
      const wm=lit?"window":"dark";
      addBox(wx,wy,z-d/2-0.035,Math.min(.82,(w/cols)*.28),.62,.03,wm,rot,false,lit?T.window:T.windowDark);
      // Opposite facade also gets windows.
      addBox(wx,wy,z+d/2+0.035,Math.min(.82,(w/cols)*.28),.62,.03,wm,rot,false,lit?T.window:T.windowDark);
    }
    for(let c=0;c<sideCols;c++){
      const wz=z-d/2+0.9+(c*(d-1.8)/Math.max(1,sideCols-1));
      const lit=((c*13+r*3+kind)%4)!==0;
      addBox(x-w/2-0.035,wy,wz,.03,.62,Math.min(.82,(d/sideCols)*.28),lit?"glass":"dark",rot,false,lit?T.glass:T.windowDark);
      addBox(x+w/2+0.035,wy,wz,.03,.62,Math.min(.82,(d/sideCols)*.28),lit?"glass":"dark",rot,false,lit?T.glass:T.windowDark);
    }
  }
  // Ground-floor shopfronts, overhang and entrance.
  addBox(x,1.25,z-d/2-.06,1.4,1.20,.08,"glass",rot,false,T.glassBlue);
  addBox(x,2.85,z-d/2-.08,2.2,.16,.07,(kind%2)?"sign_blue":"sign_red",rot,false,(kind%2)?T.sign_blue:T.sign_red);
  addBox(x,1.05,z-d/2-.09,.62,.94,.025,"dark",rot,false,T.black);
}

function storefront(x,z,w,d,h,kind=0){
  addBox(x,h/2,z,w/2,h/2,d/2,kind%2?"brick":"concrete",0,true,kind%2?T.brick:T.concreteWarm);
  addBox(x,h+.06,z,w/2+.12,.08,d/2+.12,"roof",0,false,T.roof);
  addBox(x,1.3,z-d/2-.08,w*.36,1.25,.05,"glass",0,false,T.glass);
  addBox(x,2.65,z-d/2-.10,w*.42,.19,.07,kind%2?"sign_blue":"sign_red",0,false,kind%2?T.sign_blue:T.sign_red);
  for(let k=0;k<3;k++) addBox(x-w/2+0.8+k*(w-1.6)/2,1.15,z-d/2-.11,.16,.88,.03,"dark",0,false,T.black);
}

// 16 blocks, varied building footprints. Roads remain clearly walkable between them.
const blockCenters=[-72,-36,0,36,72];
for(let ix=0;ix<4;ix++) for(let iz=0;iz<4;iz++){
  const cx=(blockCenters[ix]+blockCenters[ix+1])/2, cz=(blockCenters[iz]+blockCenters[iz+1])/2;
  const n=(ix*17+iz*31)%5;
  const margin=3.2;
  const bx0=cx-14+margin, bx1=cx+14-margin, bz0=cz-14+margin, bz1=cz+14-margin;
  if((ix+iz)%3===0){
    storefront(cx-6,cz+4,10,8,5+n, n);
    building(cx+7,cz-4,8,12,9+n*3,(n+2)%5);
  } else if((ix+iz)%3===1){
    building(bx0+5,bz0+4,10,9,8+n*3,n);
    building(bx1-5,bz1-4,10,9,6+n*2,(n+1)%5);
  } else {
    building(cx,cz,17,17,10+n*3,(n+3)%5);
  }
  // Small parking / service yard in some blocks.
  if((ix*2+iz)%2===0){
    addBox(cx+9,0.035,cz+8,3.8,.035,3.8,"asphalt",0,false,T.asphalt);
    for(let k=-2;k<=2;k++) addBox(cx+9+k*1.25,0.082,cz+8,0.035,.01,3.15,"lane",0,false,T.white);
    addBox(cx+12.2,.75,cz+8,.55,.75,.7,"metal",0,true,T.metalDark);
    addBox(cx+12.2,1.45,cz+8,.42,.06,.55,"metal",0,false,T.metal);
  }
}

// Low-rise row along major roads: this breaks the skyline and gives Schedule-I-like scale transitions.
for(const z of [-72,-36,0,36,72]) for(const side of [-1,1]){
  const x=side*82;
  if(Math.abs(z)>72) continue;
  storefront(x,z,10,9,4+(Math.abs(z)%3),Math.abs(z)%2);
}

// Garages/warehouse strip at the south-east edge.
for(let i=0;i<5;i++){
  const x=30+i*13,z=86;
  addBox(x,3.0,z,5.4,3.0,5.5,"brick",0,true,T.brickDark);
  addBox(x,2.2,z-5.56,3.3,2.0,.08,"dark",0,false,T.black);
  addBox(x,4.8,z-5.62,4.1,.16,.06,"sign_blue",0,false,T.sign_blue);
}

// Street furniture.
function streetLamp(x,z,rot=0){
  addCylinder(x,2.8,z,.09,5.6,"metal",8,T.metalDark);
  addBox(x+Math.cos(rot)*.85,5.45,z+Math.sin(rot)*.85,.82,.055,.055,"metal",rot,false,T.metal);
  addBox(x+Math.cos(rot)*1.55,5.18,z+Math.sin(rot)*1.55,.18,.11,.11,"light",rot,false,T.light);
}
for(const x of streets) for(const z of [-90,-62,-46,-26,-10,10,26,46,62,90]){
  streetLamp(x-10,z,0); streetLamp(x+10,z,Math.PI);
}

function hydrant(x,z){ addCylinder(x,.65,z,.16,.72,"metal",8,T.sign_red); addCylinder(x,.92,z,.22,.12,"metal",8,T.metal); }
for(const p of [[-64,-64],[-8,-64],[64,-64],[-64,64],[8,64],[64,64],[-64,8],[64,-8]]) hydrant(...p);

// Utility poles and overhead cables in a few service corridors.
function pole(x,z){
  addCylinder(x,4.3,z,.12,8.6,"wood",8,T.wood);
  addBox(x,8.55,z,1.05,.09,.10,"wood",0,false,T.wood);
}
function cable(a,b,y){
  const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  addBox(x,y,z,len/2,.025,.025,"dark",Math.atan2(dz,dx),false,T.black);
}
for(const [x,z] of [[-81,-12],[-81,12],[81,-12],[81,12],[-12,-81],[12,-81],[-12,81],[12,81]]) pole(x,z);
cable([-81,-12],[81,-12],8.6); cable([-81,12],[81,12],8.6); cable([-12,-81],[-12,81],8.6); cable([12,-81],[12,81],8.6);

// Cars parked beside curbs. Their XZ colliders prevent walking through them.
function car(x,z,yaw,bodyTint){
  addBox(x,.55,z,1.05,.50,2.15,"metal",yaw,true,bodyTint);
  addBox(x,1.02,z,.76,.30,1.30,"glass",yaw,false,T.glass);
  addBox(x,.27,z-1.64,.34,.22,.22,"dark",yaw,false,T.black);
  addBox(x,.27,z+1.64,.34,.22,.22,"dark",yaw,false,T.black);
  addBox(x,.70,z-2.03,.50,.12,.035,"light",yaw,false,T.light);
}
car(-8,-12,0,[0.16,0.18,0.20,1]);
car(8,-12,Math.PI,[0.56,0.18,0.15,1]);
car(-12,8,Math.PI/2,[0.18,0.32,0.46,1]);
car(12,-8,-Math.PI/2,[0.48,0.42,0.19,1]);
car(-26,-6,0,[0.33,0.34,0.35,1]);
car(26,6,Math.PI,[0.26,0.27,0.29,1]);
car(6,44,Math.PI/2,[0.53,0.53,0.50,1]);
car(-6,-44,-Math.PI/2,[0.35,0.23,0.18,1]);

// Trees, benches, dumpsters and planters make sidewalks readable.
function tree(x,z,s=1){
  addCylinder(x,1.05*s,z,.17*s,2.1*s,"wood",8,T.wood);
  addBox(x,2.25*s,z,.82*s,.85*s,.82*s,"leaf",0,false,T.leaf);
  addBox(x+.34*s,2.85*s,z-.10*s,.48*s,.48*s,.48*s,"leaf",0,false,T.leaf);
}
for(const p of [[-14,-42,1],[-14,42,.9],[14,-42,.9],[14,42,1],[-42,-14,.9],[42,14,1],[-42,14,.8],[42,-14,.85]]) tree(...p);
for(const [x,z] of [[-10,-8],[10,-8],[-8,10],[8,-10]]){
  addBox(x,.44,z,1.15,.08,.30,"wood",0,false,T.wood);
  addBox(x,.22,z-.22,.08,.22,.08,"metal",0,false,T.metalDark);
  addBox(x,.22,z+.22,.08,.22,.08,"metal",0,false,T.metalDark);
}
for(const [x,z] of [[-5,-8.8],[5,-8.8],[-8.8,5],[8.8,-5]]) addBox(x,.52,z,.32,.52,.32,"metal",0,true,T.metalDark);

// Ground edge and modest skyline. Avoid the giant black wall effect from the previous build.
addBox(0,-.40,-112,112,.40,.5,"dark",0,false,T.black);
addBox(0,-.40,112,112,.40,.5,"dark",0,false,T.black);
addBox(-112,-.40,0,.5,.40,112,"dark",0,false,T.black);
addBox(112,-.40,0,.5,.40,112,"dark",0,false,T.black);
const skyline=rand(8941);
for(let x=-108;x<=108;x+=9){
  const side=(x%18===0)?1:-1;
  const z=side*104,h=13+Math.floor(skyline()*22),w=4+skyline()*4,d=4+skyline()*4;
  addBox(x,h/2,z,w/2,h/2,d/2,skyline()>.45?"concrete":"brick",0,false,skyline()>.45?T.concreteDark:T.brickDark);
}

// Pack geometry.
const stride=12, count=P.length/3;
const data=new Float32Array(count*stride);
for(let i=0;i<count;i++){
  const o=i*stride;
  data[o]=P[i*3]; data[o+1]=P[i*3+1]; data[o+2]=P[i*3+2];
  data[o+3]=N[i*3]; data[o+4]=N[i*3+1]; data[o+5]=N[i*3+2];
  data[o+6]=UV[i*2]; data[o+7]=UV[i*2+1];
  data[o+8]=COL[i*4]; data[o+9]=COL[i*4+1]; data[o+10]=COL[i*4+2]; data[o+11]=COL[i*4+3];
}
const vao=gl.createVertexArray(),buf=gl.createBuffer();
gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride*4,0);
gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride*4,12);
gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride*4,24);
gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.FLOAT,false,stride*4,32);

// --- Mobile-only FPS controller ---
const eyeHeight=1.72;
const player={x:0,y:eyeHeight,z:8,yaw:0,pitch:-0.04,grounded:true};
const stickEl=document.getElementById("stick"),knob=document.getElementById("knob");
const lookZone=document.getElementById("lookZone"),runBtn=document.getElementById("runBtn"),enterBtn=document.getElementById("enter"),start=document.getElementById("start");
const stick={active:false,id:null,x:0,y:0};
const look={active:false,id:null,x:0,y:0};
let running=false;

function pointerIsTouch(e){return e.pointerType==="touch" || e.pointerType==="pen";}
function setStick(clientX,clientY){
  const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=clientX-cx,dy=clientY-cy,m=Math.hypot(dx,dy)||1,max=40,k=Math.min(1,max/m);
  dx*=k;dy*=k;knob.style.transform=`translate(${dx}px,${dy}px)`;stick.x=dx/max;stick.y=dy/max;
}
stickEl.addEventListener("pointerdown",e=>{
  if(!pointerIsTouch(e)) return; e.preventDefault();
  stick.active=true; stick.id=e.pointerId; stickEl.setPointerCapture?.(e.pointerId); setStick(e.clientX,e.clientY);
});
stickEl.addEventListener("pointermove",e=>{if(stick.active&&e.pointerId===stick.id){e.preventDefault();setStick(e.clientX,e.clientY);}});
function endStick(e){if(stick.active&&e.pointerId===stick.id){stick.active=false;stick.id=null;stick.x=stick.y=0;knob.style.transform="translate(0,0)";}}
stickEl.addEventListener("pointerup",endStick);stickEl.addEventListener("pointercancel",endStick);stickEl.addEventListener("lostpointercapture",()=>{if(stick.active){stick.active=false;stick.id=null;stick.x=stick.y=0;knob.style.transform="translate(0,0)";}});

lookZone.addEventListener("pointerdown",e=>{
  if(!pointerIsTouch(e) || look.active) return; e.preventDefault();
  look.active=true;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;lookZone.setPointerCapture?.(e.pointerId);
});
lookZone.addEventListener("pointermove",e=>{
  if(!look.active||e.pointerId!==look.id) return; e.preventDefault();
  player.yaw-= (e.clientX-look.x)*0.0042;
  player.pitch=Math.max(-1.30,Math.min(1.22,player.pitch-(e.clientY-look.y)*0.0034));
  look.x=e.clientX;look.y=e.clientY;
});
function endLook(e){if(look.active&&e.pointerId===look.id){look.active=false;look.id=null;}}
lookZone.addEventListener("pointerup",endLook);lookZone.addEventListener("pointercancel",endLook);lookZone.addEventListener("lostpointercapture",()=>{look.active=false;look.id=null;});

for(const ev of ["pointerdown","pointerup","pointercancel"]){
  runBtn.addEventListener(ev,e=>{
    if(!pointerIsTouch(e)) return; e.preventDefault();
    if(ev==="pointerdown"){running=true;runBtn.classList.add("pressed");runBtn.setPointerCapture?.(e.pointerId);}
    else {running=false;runBtn.classList.remove("pressed");}
  });
}

function startGame(e){ if(e){e.preventDefault();} start.style.display="none"; }
enterBtn.addEventListener("click",startGame);
enterBtn.addEventListener("pointerup",e=>{if(pointerIsTouch(e)) startGame(e);});
for(const n of ["gesturestart","gesturechange","gestureend"]) addEventListener(n,e=>e.preventDefault(),{passive:false});
addEventListener("contextmenu",e=>e.preventDefault());

function circleBoxHit(nx,nz,r,c){
  // Axis-aligned conservative footprint is deliberate: stable, cheap collision on phones.
  return Math.abs(nx-c.x) < c.sx+r && Math.abs(nz-c.z) < c.sz+r;
}
function blocked(nx,nz){
  const r=.52;
  if(Math.abs(nx)>106-r || Math.abs(nz)>106-r) return true;
  for(const c of colliders) if(circleBoxHit(nx,nz,r,c)) return true;
  return false;
}
function groundHeight(){return 0;}
function update(dt){
  let f=-stick.y,s=stick.x;
  const len=Math.hypot(f,s); if(len>1){f/=len;s/=len;}
  const speed=running?8.0:4.35;
  const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
  const dx=(sy*f+cy*s)*speed*dt;
  const dz=(-cy*f+sy*s)*speed*dt;
  // Separate-axis resolution provides natural sliding instead of sticking to corners.
  const nx=player.x+dx,nz=player.z+dz;
  if(!blocked(nx,player.z)) player.x=nx;
  if(!blocked(player.x,nz)) player.z=nz;
  // No jumping / no flying: eye height is anchored to the current ground surface.
  player.y=groundHeight(player.x,player.z)+eyeHeight;
  player.grounded=true;
}
function persp(fov,asp,n,f){
  const t=1/Math.tan(fov/2),m=new Float32Array(16);
  m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=(2*f*n)/(n-f);return m;
}
function view(){
  const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
  const fx=sy*cp,fy=sp,fz=-cy*cp;
  const rx=cy,rz=sy;
  const ux=-sy*sp,uy=cp,uz=cy*sp;
  const m=new Float32Array(16);
  // Proper rigid FPS view matrix: pitch changes direction only; camera position never changes with look.
  m[0]=rx;m[1]=ux;m[2]=-fx;m[3]=0;
  m[4]=0;m[5]=uy;m[6]=-fy;m[7]=0;
  m[8]=rz;m[9]=uz;m[10]=-fz;m[11]=0;m[15]=1;
  m[12]=-(rx*player.x+rz*player.z);
  m[13]=-(ux*player.x+uy*player.y+uz*player.z);
  m[14]= fx*player.x+fy*player.y+fz*player.z;
  return m;
}
function mul(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function resize(){
  const d=Math.min(devicePixelRatio||1,1.5),w=Math.floor(innerWidth*d),h=Math.floor(innerHeight*d);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}
addEventListener("resize",resize);resize();
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.46,.53,.57,1);

let last=performance.now(),frames=0,ft=last,fps=60;
function render(){
  if(!ready) return;
  const pv=mul(persp(Math.PI/3,canvas.width/canvas.height,.05,230),view());
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(prog);gl.bindVertexArray(vao);
  gl.uniformMatrix4fv(vpLoc,false,pv);gl.uniform3f(sunLoc,-.42,.86,.30);gl.uniform3f(camLoc,player.x,player.y,player.z);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.drawArrays(gl.TRIANGLES,0,count);
}
function loop(now){
  const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);render();
  frames++; if(now-ft>700){fps=Math.round(frames*1000/(now-ft));frames=0;ft=now;document.getElementById("stats").textContent=`${fps} FPS  |  CITY ${Math.round(count/36)} tris/box-equivalent`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
