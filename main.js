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
  vec3 base=tex.rgb*vTint.rgb;
  vec3 N=normalize(vN);
  vec3 L=normalize(sunDir);
  vec3 V=normalize(cam-vW);
  float ndl=max(dot(N,L),0.0);
  float sky=0.76+0.24*max(N.y,0.0);
  float diffuse=0.34+0.66*ndl;
  float spec=pow(max(dot(reflect(-L,N),V),0.0),32.0)*0.055;
  vec3 c=base*(sky*diffuse)+vec3(spec);
  float dist=length(vW-cam);
  float fog=smoothstep(145.0,230.0,dist);
  c=mix(c,vec3(0.43,0.50,0.54),fog*0.28);
  c=pow(max(c,vec3(0.0)),vec3(0.88));
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
  concrete:[0,0,.125,.125], brick:[.125,0,.25,.125], glass:[.25,0,.375,.125], window:[.375,0,.5,.125],
  asphalt:[0,.125,.125,.25], sidewalk:[.125,.125,.25,.25], roof:[.25,.125,.375,.25], dark:[.375,.125,.5,.25],
  metal:[0,.25,.125,.375], grass:[.125,.25,.25,.375], sign_red:[.25,.25,.375,.375], sign_blue:[.375,.25,.5,.375],
  lane:[0,.375,.125,.5], light:[.125,.375,.25,.5], wood:[.25,.375,.375,.5], leaf:[.375,.375,.5,.5],
  brick_red:[.5,0,.625,.125], brick_dark:[.625,0,.75,.125], stucco:[.75,0,.875,.125], stone:[.875,0,1,.125],
  glass_blue:[.5,.125,.625,.25], glass_green:[.625,.125,.75,.25], dirty_window:[.75,.125,.875,.25], dark_glass:[.875,.125,1,.25],
  asphalt_worn:[.5,.25,.625,.375], sidewalk_paver:[.625,.25,.75,.375], curb:[.75,.25,.875,.375], tile:[.875,.25,1,.375],
  rust:[.5,.375,.625,.5], corrugated:[.625,.375,.75,.5], plywood:[.75,.375,.875,.5], plaster:[.875,.375,1,.5],
  facade_trim:[.5,.5,.625,.625], facade_shadow:[.625,.5,.75,.625], awning:[.75,.5,.875,.625], roof_shingle:[.875,.5,1,.625],
  graffiti:[.5,.625,.625,.75], concrete_dirty:[.625,.625,.75,.75], painted:[.75,.625,.875,.75], granite:[.875,.625,1,.75]
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

// --- City: block-first urban layout. Roads, curbs, sidewalks, lots and buildings never overlap. ---
const ROAD_W=11, SIDEWALK_W=2.6, CURB_W=.34, SPACING=42, EXTENT=126;
const streets=[-63,-21,21,63];

// Base city slab. Individual lots cover this so asphalt is never visible beneath buildings.
addBox(0,-0.12,0,EXTENT,.12,EXTENT,"asphalt",0,false,T.asphalt);

// Roadways: each road is a single continuous carriageway with a subtle crown/edge strip.
for(const x of streets){
  addBox(x,0.00,0,ROAD_W/2,.035,EXTENT,"asphalt_worn",0,false,[.25,.27,.28,1]);
  addBox(x-ROAD_W/2+.42,.045,0,.045,.012,EXTENT,"lane",0,false,T.white);
  addBox(x+ROAD_W/2-.42,.045,0,.045,.012,EXTENT,"lane",0,false,T.white);
  for(let z=-119;z<=119;z+=7) addBox(x,0.047,z,.035,.012,2.15,"lane",0,false,T.lane);
}
for(const z of streets){
  addBox(0,0.002,z,EXTENT,.035,ROAD_W/2,"asphalt_worn",0,false,[.25,.27,.28,1]);
  addBox(0,0.047,z-ROAD_W/2+.42,EXTENT,.012,.045,"lane",0,false,T.white);
  addBox(0,0.047,z+ROAD_W/2-.42,EXTENT,.012,.045,"lane",0,false,T.white);
  for(let x=-119;x<=119;x+=7) addBox(x,0.049,z,2.15,.012,.035,"lane",0,false,T.lane);
}

// Curbs + sidewalks. Their extents are calculated from the road edge, so there is no overlap.
const sidewalkOffset=ROAD_W/2+CURB_W+SIDEWALK_W/2;
for(const x of streets){
  addBox(x-ROAD_W/2-CURB_W/2,0.13,0,CURB_W,.13,EXTENT,"curb",0,false,T.concreteDark);
  addBox(x+ROAD_W/2+CURB_W/2,0.13,0,CURB_W,.13,EXTENT,"curb",0,false,T.concreteDark);
  addBox(x-sidewalkOffset,0.075,0,SIDEWALK_W/2,.075,EXTENT,"sidewalk_paver",0,false,T.sidewalk);
  addBox(x+sidewalkOffset,0.075,0,SIDEWALK_W/2,.075,EXTENT,"sidewalk_paver",0,false,T.sidewalkLight);
}
for(const z of streets){
  addBox(0,0.13,z-ROAD_W/2-CURB_W/2,EXTENT,.13,CURB_W,"curb",0,false,T.concreteDark);
  addBox(0,0.13,z+ROAD_W/2+CURB_W/2,EXTENT,.13,CURB_W,"curb",0,false,T.concreteDark);
  addBox(0,0.075,z-sidewalkOffset,EXTENT,.075,SIDEWALK_W/2,"sidewalk_paver",0,false,T.sidewalk);
  addBox(0,0.075,z+sidewalkOffset,EXTENT,.075,SIDEWALK_W/2,"sidewalk_paver",0,false,T.sidewalkLight);
}

// Crosswalks: stop before the curb and sit on the roadway only.
const crossHalf=ROAD_W/2-.85;
for(const sx of streets) for(const sz of streets){
  for(let k=-4;k<=4;k++){
    addBox(sx+k*.85,0.062,sz-crossHalf,.23,.012,.65,"lane",0,false,T.white);
    addBox(sx+k*.85,0.062,sz+crossHalf,.23,.012,.65,"lane",0,false,T.white);
    addBox(sx-crossHalf,0.064,sz+k*.85,.65,.012,.23,"lane",0,false,T.white);
    addBox(sx+crossHalf,0.064,sz+k*.85,.65,.012,.23,"lane",0,false,T.white);
  }
}

function windowUnit(x,y,z,w,h,depth,rot,lit=false){
  const glass=lit?'glass_green':'dirty_window';
  addBox(x,y,z,w,h,depth,glass,rot,false,lit?[.48,.68,.70,1]:T.windowDark);
  // Recess and physical frame.
  addBox(x,y+h+.035,z,.045,.035,depth+.05,"facade_trim",rot,false,T.concreteDark);
  addBox(x,y-h-.035,z,.045,.035,depth+.05,"facade_trim",rot,false,T.concreteDark);
  addBox(x-w-.035,y,z,.035,h,depth+.05,"facade_trim",rot,false,T.concreteDark);
  addBox(x+w+.035,y,z,.035,h,depth+.05,"facade_trim",rot,false,T.concreteDark);
  addBox(x,y,z-depth-.012,.018,h,.028,"facade_trim",rot,false,T.concreteDark);
}
function doorUnit(x,z,rot=0,shop=false){
  addBox(x,1.18,z,.58,1.18,.10,shop?'glass_blue':'dark',rot,false,shop?T.glassBlue:T.black);
  addBox(x-.43,1.18,z-.11,.055,1.18,.12,"facade_trim",rot,false,T.concreteDark);
  addBox(x+.43,1.18,z-.11,.055,1.18,.12,"facade_trim",rot,false,T.concreteDark);
  addBox(x,2.46,z-.12,.56,.065,.12,"light",rot,false,T.light);
}
function balcony(x,y,z,w,d,rot=0){
  addBox(x,y,z,w,.055,d,"granite",rot,false,T.concreteDark);
  addBox(x-w+.06,y+.42,z-d+.06,.035,.42,.035,"metal",rot,false,T.metalDark);
  addBox(x+w-.06,y+.42,z-d+.06,.035,.42,.035,"metal",rot,false,T.metalDark);
  addBox(x,y+.42,z-d+.06,w,.035,.035,"metal",rot,false,T.metalDark);
}
function roofDetail(x,y,z,w,d,kind){
  addBox(x,y,z,w,.10,d,"roof_shingle",0,false,T.roof);
  if(kind%2===0){
    addBox(x-w*.28,y+.28,z,d*.08,.28,w*.10,"metal",0,false,T.metalDark);
    addBox(x+w*.28,y+.18,z,w*.08,.18,d*.10,"metal",0,false,T.metalDark);
  }else{
    addBox(x,y+.20,z,w*.12,.20,d*.12,"metal",0,false,T.metalDark);
    addBox(x+w*.30,y+.13,z+d*.18,w*.10,.13,d*.18,"metal",0,false,T.metal);
  }
}

// Detailed mid-rise building: shallow projections, recessed windows, floor bands and roof parapet.
function building(x,z,w,d,h,kind=0,rot=0){
  const mats=['concrete','brick_red','stucco','stone','painted'];
  const bodies=['concreteWarm','brick','concrete','concreteDark','concrete'];
  const body=mats[kind%5];
  const tint=T[bodies[kind%5]]||T.concrete;
  addBox(x,h/2,z,w/2,h/2,d/2,body,rot,true,tint);
  // Base plinth, cornice and roof parapet.
  addBox(x,.18,z,w/2+.10,.18,d/2+.10,'granite',rot,false,T.concreteDark);
  for(let fy=3.0;fy<h-1.2;fy+=3.0) addBox(x,fy,z,w/2+.035,.055,d/2+.035,'facade_shadow',rot,false,T.concreteDark);
  addBox(x,h+.12,z,w/2+.22,.12,d/2+.22,'roof',rot,false,T.roof);
  addBox(x,h+.34,z,w/2+.18,.18,.10,'concrete',rot,false,T.concreteDark);
  roofDetail(x,h+.52,z,w*.20,d*.20,kind);

  const floors=Math.max(2,Math.floor((h-1.5)/3));
  for(let f=0;f<floors;f++){
    const wy=1.55+f*3.0;
    const cols=Math.max(2,Math.floor((w-1.5)/2.45));
    const gap=(cols>1?(w-2.2)/(cols-1):0);
    for(let c=0;c<cols;c++){
      const wx=x-w/2+1.1+c*gap;
      const lit=((f*7+c*3+kind*5)%9)<3;
      windowUnit(wx,wy,z-d/2-.075,.48,.82,.055,rot,lit);
      if((kind+f+c)%8===0) balcony(wx,wy+.90,z-d/2-.38,.62,.42,rot);
    }
    // Side facade windows, fewer and narrower.
    const sideRows=Math.max(1,Math.floor((d-2)/3.1));
    for(let r=0;r<sideRows;r++){
      const wz=z-d/2+1.2+r*3.0;
      const lit2=((r+f+kind)%7)<2;
      windowUnit(x-w/2-.075,wy,wz,.055,.62,.48,rot,lit2);
      windowUnit(x+w/2+.075,wy,wz,.055,.62,.48,rot,lit2);
    }
  }
  doorUnit(x-w*.22,z-d/2-.12,rot,false);
  if(kind%2===0){
    addBox(x+w*.20,1.25,z-d/2-.15,.72,1.15,.075,"glass_blue",rot,false,T.glassBlue);
    addBox(x,2.70,z-d/2-.18,w*.38,.13,.11,"awning",rot,false,T.sign_blue);
  }
}

// Small storefront with a transparent shop front, signage, awning and service door.
function storefront(x,z,w,d,h,kind=0,rot=0){
  const body=kind%2?'brick_red':'stucco';
  addBox(x,h/2,z,w/2,h/2,d/2,body,rot,true,kind%2?T.brick:T.concreteWarm);
  addBox(x,.18,z,w/2+.08,.18,d/2+.08,'granite',rot,false,T.concreteDark);
  addBox(x,1.42,z-d/2-.10,w*.34,1.28,.07,'glass_blue',rot,false,T.glassBlue);
  addBox(x-w*.30,1.42,z-d/2-.10,.40,1.28,.07,'dark',rot,false,T.black);
  addBox(x+w*.30,1.42,z-d/2-.10,.40,1.28,.07,'dark',rot,false,T.black);
  addBox(x,2.78,z-d/2-.17,w*.48,.16,.12,'awning',rot,false,kind%2?T.sign_blue:T.sign_red);
  addBox(x,3.05,z-d/2-.19,w*.43,.22,.08,kind%2?'sign_blue':'sign_red',rot,false,kind%2?T.sign_blue:T.sign_red);
  doorUnit(x+w*.29,z-d/2-.14,rot,true);
  for(let k=0;k<4;k++) addBox(x-w/2+1.0+k*(w-2)/3,1.25,z-d/2-.14,.045,1.10,.10,"facade_trim",rot,false,T.concreteDark);
}
function townhouse(x,z,w,d,h,kind=0){
  addBox(x,h/2,z,w/2,h/2,d/2,kind%2?'brick_red':'painted',0,true,kind%2?T.brickDark:T.concreteWarm);
  addBox(x,.20,z,w/2+.06,.20,d/2+.06,'granite',0,false,T.concreteDark);
  const floors=Math.max(2,Math.floor(h/3));
  for(let f=0;f<floors;f++){
    const y=1.45+f*3;
    windowUnit(x-w*.22,y,z-d/2-.07,.48,.72,.05,0,(f+kind)%4===0);
    windowUnit(x+w*.22,y,z-d/2-.07,.48,.72,.05,0,(f+kind+1)%5===0);
  }
  doorUnit(x,z-d/2-.12,0,false);
  addBox(x,h+.10,z,w/2+.12,.10,d/2+.12,'roof_shingle',0,false,T.roof);
}

// Build each block inside a strict rectangle bounded by the sidewalks.
const centers=[-42,0,42,84];
const blockEdge=SPACING/2;
const lotMin=ROAD_W/2+CURB_W+SIDEWALK_W+.75;
for(let ix=0;ix<3;ix++) for(let iz=0;iz<3;iz++){
  const cx=(centers[ix]+centers[ix+1])/2, cz=(centers[iz]+centers[iz+1])/2;
  const minX=centers[ix]+lotMin, maxX=centers[ix+1]-lotMin;
  const minZ=centers[iz]+lotMin, maxZ=centers[iz+1]-lotMin;
  const bw=maxX-minX, bd=maxZ-minZ;
  // Lot surface is deliberately inside the sidewalk edge.
  addBox((minX+maxX)/2,0.012,(minZ+maxZ)/2,bw/2,.012,bd/2,(ix+iz)%3===0?'grass':'concrete_dirty',0,false,(ix+iz)%3===0?T.grass:T.concreteDark);
  const p=(ix*11+iz*17)%6;
  if(p===0){
    storefront(minX+bw*.28,minZ+bd*.28,8.8,8.0,4.4,(ix+iz)%2);
    townhouse(maxX-bw*.28,minZ+bd*.68,8.6,8.4,7.0,iz%2);
    addBox(maxX-bw*.26,.025,maxZ-bd*.24,5.8,.025,5.0,'asphalt_worn',0,false,T.asphalt);
  }else if(p===1){
    building(minX+bw*.30,minZ+bd*.31,9.6,10.8,9.0+(ix%2)*3,ix%5);
    townhouse(maxX-bw*.30,maxZ-bd*.30,9.0,9.4,6.2,(iz+1)%3);
  }else if(p===2){
    building(cx,cz,13.8,12.5,12.0+(iz%2)*4,(ix+iz+2)%5);
    addBox(minX+bw*.70,.025,minZ+bd*.30,5.0,.025,5.8,'asphalt_worn',0,false,T.asphalt);
  }else if(p===3){
    storefront(cx,minZ+bd*.30,11.0,8.0,4.8,(ix+1)%2);
    building(cx,maxZ-bd*.30,11.2,9.2,10.5,(iz+2)%5);
  }else if(p===4){
    building(minX+bw*.28,cz,9.8,13.2,8.0+(iz%3)*2,(ix+3)%5);
    building(maxX-bw*.28,cz,9.8,13.2,7.5+(ix%3)*2,(iz+1)%5);
  }else{
    townhouse(minX+bw*.25,minZ+bd*.30,9.2,8.5,6.4,ix%3);
    townhouse(maxX-bw*.25,minZ+bd*.30,9.2,8.5,7.0,(iz+1)%3);
    storefront(cx,maxZ-bd*.30,10.5,8.0,4.5,(ix+iz)%2);
  }
}

// Dedicated parking/service district, with marked bays and a low warehouse row.
for(let i=0;i<5;i++){
  const x=25+i*11.5,z=96;
  addBox(x,0.02,z,5.0,.02,5.2,'asphalt_worn',0,false,T.asphalt);
  for(let k=-2;k<=2;k++) addBox(x+k*1.75,0.055,z,0.025,.012,4.4,'lane',0,false,T.white);
  addBox(x,2.7,z+4.6,5.0,2.7,.45,'corrugated',0,true,T.metalDark);
  addBox(x,1.55,z+4.05,3.2,1.5,.08,'dark',0,false,T.black);
  addBox(x,3.55,z+3.95,3.8,.16,.10,'sign_blue',0,false,T.sign_blue);
}

// Street furniture sits on sidewalks, never in the carriageway.
function streetLamp(x,z,rot=0){
  addCylinder(x,2.65,z,.075,5.3,'metal',8,T.metalDark);
  addBox(x+Math.cos(rot)*.75,5.25,z+Math.sin(rot)*.75,.72,.055,.055,'metal',rot,false,T.metal);
  addBox(x+Math.cos(rot)*1.28,5.03,z+Math.sin(rot)*1.28,.16,.10,.10,'light',rot,false,T.light);
}
for(const x of streets) for(const z of [-105,-84,-63,-42,-21,0,21,42,63,84,105]){
  streetLamp(x-sidewalkOffset,z,0);
  streetLamp(x+sidewalkOffset,z,Math.PI);
}
function hydrant(x,z){ addCylinder(x,.60,z,.15,.65,'metal',8,T.sign_red); addCylinder(x,.89,z,.20,.10,'metal',8,T.metal); }
for(const p of [[-31,-31],[31,-31],[-31,31],[31,31],[73,-31],[-73,31],[31,73],[-31,-73]]) hydrant(...p);

function pole(x,z){
  addCylinder(x,4.2,z,.10,8.4,'wood',8,T.wood);
  addBox(x,8.45,z,1.0,.08,.08,'wood',0,false,T.wood);
}
function cable(a,b,y){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  addBox((a[0]+b[0])/2,y,(a[1]+b[1])/2,len/2,.025,.025,'dark',Math.atan2(dz,dx),false,T.black);
}
for(const z of [-84,0,84]){
  pole(-84,z);pole(-42,z);pole(0,z);pole(42,z);pole(84,z);
  cable([-84,z],[0,z],8.1); cable([0,z],[84,z],8.1);
}

function car(x,z,yaw=0,bodyTint=T.sign_blue){
  addBox(x,.52,z,1.02,.52,2.10,'metal',yaw,true,bodyTint);
  addBox(x,1.02,z,.72,.30,1.28,'glass',yaw,false,T.glassBlue);
  addBox(x,.25,z-1.62,.32,.20,.22,'dark',yaw,false,T.black);
  addBox(x,.25,z+1.62,.32,.20,.22,'dark',yaw,false,T.black);
  addBox(x,.72,z-2.02,.48,.11,.035,'light',yaw,false,T.light);
}
for(const p of [[-10,-31,0],[-32,10,Math.PI/2],[10,31,Math.PI],[32,-10,-Math.PI/2],[52,-10,-Math.PI/2],[-52,10,Math.PI/2]]) car(...p);

function bench(x,z,rot=0){
  addBox(x,.46,z,1.10,.07,.28,'wood',rot,false,T.wood);
  addBox(x,.23,z-.22,.07,.23,.07,'metal',rot,false,T.metalDark);
  addBox(x,.23,z+.22,.07,.23,.07,'metal',rot,false,T.metalDark);
}
function bin(x,z){ addBox(x,.55,z,.48,.55,.42,'corrugated',0,true,T.metalDark); addBox(x,.86,z,.54,.05,.46,'metal',0,false,T.metal); }
for(const p of [[-10,-10],[10,-10],[-10,10],[10,10],[-52,-10],[52,10]]) bench(...p);
for(const p of [[-12,-10],[12,10],[-52,10],[52,-10]]) bin(...p);

// World boundary below ground prevents accidental camera drop.
addBox(0,-1.0,-EXTENT-1,EXTENT,.9,.5,'dark',0,false,T.black);
addBox(0,-1.0,EXTENT+1,EXTENT,.9,.5,'dark',0,false,T.black);
addBox(-EXTENT-1,-1.0,0,.5,.9,EXTENT,'dark',0,false,T.black);
addBox(EXTENT+1,-1.0,0,.5,.9,EXTENT,'dark',0,false,T.black);

// Additional distant low-rise skyline, kept sparse so the street reads as a real district rather than a wall of towers.
for(const [x,z,w,d,h,k] of [
  [-104,-96,10,12,10,1],[104,-96,12,10,13,2],[-104,96,12,10,12,0],[104,96,10,12,15,3],
  [-96,-18,8,12,9,4],[96,18,8,12,11,1],[-18,-104,12,8,12,2],[18,104,12,8,10,0]
]) building(x,z,w,d,h,k);

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
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.50,.58,.62,1);

let last=performance.now(),frames=0,ft=last,fps=60;
function render(){
  if(!ready) return;
  const pv=mul(persp(Math.PI/2.85,canvas.width/canvas.height,.05,230),view());
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
