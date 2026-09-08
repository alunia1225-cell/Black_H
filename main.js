(() => {
'use strict';
const canvas = document.getElementById('game');
const startScreen = document.getElementById('startScreen');
const enterCity = document.getElementById('enterCity');
const hud = document.getElementById('hud');
const bootError = document.getElementById('bootError');
const clockEl = document.getElementById('clock');
const statusEl = document.getElementById('status');
const pad = document.getElementById('leftPad');
const knob = document.getElementById('leftKnob');
const runButton = document.getElementById('runButton');
const lookZone = document.getElementById('lookZone');

let gl, program, atlas;
const texSize=960, tile=96;
const player={x:0,y:1.65,z:18,yaw:0,pitch:0};
const keys=new Set();
const input={mx:0,my:0,run:false,active:false,pid:null,px:0,py:0};
const look={active:false,pid:null,x:0,y:0};
let started=false, last=performance.now(), worldMinutes=540;
let verts=[], idx=[];
const colliders=[];

function fail(e){console.error(e); bootError.textContent='BOOT ERROR\n'+(e?.stack||e); bootError.hidden=false;}
function shader(type,src){const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s;}
function mat4(){return new Float32Array(16)}
function perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far); out[0]=f/aspect;out[5]=f;out[10]=(far+near)*nf;out[11]=-1;out[14]=2*far*near*nf;out[1]=out[2]=out[3]=out[4]=out[6]=out[7]=out[8]=out[9]=out[12]=out[13]=out[15]=0;return out}
function lookAt(out,ex,ey,ez,cx,cy,cz){let zx=ex-cx,zy=ey-cy,zz=ez-cz;let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;let xx=zy,xy=-zx,xz=0;l=Math.hypot(xx,xy)||1;xx/=l;xy/=l;let yx=xy*zz,yy=xz*zx-xx*zz,yz=xx*zy-xy*zx;out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;out[12]=-(xx*ex+xy*ey+xz*ez);out[13]=-(yx*ex+yy*ey+yz*ez);out[14]=-(zx*ex+zy*ey+zz*ez);out[15]=1;return out}
function mul(a,b){const o=mat4();for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function uv(tileId){const x=tileId%10,y=Math.floor(tileId/10);const s=1/10;return [x*s,1-(y+1)*s,(x+1)*s,1-y*s]}
function addV(x,y,z,u,v,tid){verts.push(x,y,z,u,v,tid)}
function face(a,b,c,d,tid,n){const i=verts.length/6;addV(...a,0,0,tid);addV(...b,1,0,tid);addV(...c,1,1,tid);addV(...d,0,1,tid);idx.push(i,i+1,i+2,i,i+2,i+3)}
function box(x0,y0,z0,x1,y1,z1,tids){const [u0,v0,u1,v1]=uv(tids[0]);face([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],tids[0]);face([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],tids[1]);face([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],tids[2]);face([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],tids[3]);face([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],tids[4]);face([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0],tids[5]);
}
function addBuilding(x,z,w,d,h,seed){const mats=[seed%100,(seed*7+3)%100,(seed*11+8)%100,((seed+17)%100),((seed+31)%100),((seed+43)%100)];box(x,0,z,x+w,h,z+d,mats);box(x-.08,h,z-.08,x+w+.08,h+.15,z+d+.08,(seed+8)%100);colliders.push([x-.35,z-.35,x+w+.35,z+d+.35]);}
function addCity(){
 verts=[];idx=[];colliders.length=0;
 const grid=8, block=34, road=8, start=-grid*block/2; // 272m square
 // ground
 box(-150,-.08,-150,150,0,150, [30,30,30,30,30,30]);
 for(let gx=0;gx<grid;gx++) for(let gz=0;gz<grid;gz++){
   const bx=start+gx*block+road/2, bz=start+gz*block+road/2;
   // sidewalk slab
   box(bx,-.01,bz,bx+block-road,0.18,bz+block-road,[31,31,31,31,31,31]);
   // 3-5 buildings, inset around center
   const seed=gx*71+gz*97;
   const slots=[[2,2,13,13],[16,2,14,10],[2,16,10,14],[14,14,16,16]];
   for(let s=0;s<slots.length;s++){
     if((seed+s*13)%5===0) continue;
     const q=slots[s]; const h=7+((seed+s*9)%12); addBuilding(bx+q[0],bz+q[1],q[2],q[3],h,seed+s*23);
   }
 }
 // roads/sidewalk center markings
 for(let i=0;i<grid+1;i++){
   const p=start+i*block+road/2;
   box(p,-.025,-150,p+road,.01,150,[32,32,32,32,32,32]);
   box(-150,-.025,p,150,.01,p+road,[32,32,32,32,32,32]);
 }
 // lamps and trees, decorative, no collider
 for(let i=0;i<60;i++){
   const x=((i*47)%240)-120, z=((i*83)%240)-120;
   box(x-.11,0,z-.11,x+.11,3.5,z+.11,[(12+i)%100,(12+i)%100,(12+i)%100,(12+i)%100,(12+i)%100,(12+i)%100]);
   box(x-.45,3.5,z-.45,x+.45,3.7,z+.45,[(25+i)%100,(25+i)%100,(25+i)%100,(25+i)%100,(25+i)%100,(25+i)%100]);
 }
 // sky-free distant skyline ring
 for(let i=0;i<24;i++){const ang=i*Math.PI*2/24;const r=140;const w=6;const x=Math.cos(ang)*r,z=Math.sin(ang)*r;addBuilding(x-w/2,z-w/2,w,w,12+(i%5)*4,(60+i*3)%100)}
}
function initGL(){
 gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:false}); if(!gl) throw Error('WebGL2 is not available on this device.');
 const vs=shader(gl.VERTEX_SHADER,`#version 300 es\nlayout(location=0)in vec3 aPos;layout(location=1)in vec2 aUV;layout(location=2)in float aTile;uniform mat4 uVP;out vec2 vUV;flat out int vTile;void main(){gl_Position=uVP*vec4(aPos,1.0);float s=0.1;float tx=mod(aTile,10.0)*s;float ty=floor(aTile/10.0)*s;vUV=vec2(tx+aUV.x*s,1.0-(ty+(1.0-aUV.y)*s));vTile=int(aTile);}`);
 const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec2 vUV;out vec4 outColor;uniform sampler2D uTex;uniform float uDay;void main(){vec4 c=texture(uTex,vUV);float light=mix(0.48,1.12,uDay);outColor=vec4(c.rgb*light,1.0);}`);
 program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const data=new Float32Array(verts), ib=new Uint32Array(idx);const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,24,20);const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ib,gl.STATIC_DRAW);
 atlas=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,atlas);const im=new Image();im.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);};im.src='city_atlas.png';
 gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'uTex'),0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.bindVertexArray(vao);program.vao=vao;program.count=ib.length;
}
function collides(x,z){const r=.42;for(const c of colliders){if(x+r>c[0]&&x-r<c[2]&&z+r>c[1]&&z-r<c[3])return true}return false}
function updateMove(dt){let sx=input.mx, sy=input.my;let kx=(keys.has('d')?1:0)-(keys.has('a')?1:0), kz=(keys.has('s')?1:0)-(keys.has('w')?1:0);if(Math.hypot(kx,kz)>0){sx=kx;sy=kz}let m=Math.hypot(sx,sy);if(m<.05)return;sx/=m;sy/=m;const sp=(input.run||keys.has('shift'))?8.5:4.2;const cy=Math.cos(player.yaw),syaw=Math.sin(player.yaw);const dx=(sx*cy + sy*syaw)*sp*dt,dz=(sy*cy - sx*syaw)*sp*dt;let nx=player.x+dx,nz=player.z+dz;if(!collides(nx,player.z))player.x=nx;if(!collides(player.x,nz))player.z=nz}
function dayLight(){const h=(worldMinutes/60)%24;const d=Math.max(0,Math.sin((h-6)/12*Math.PI));return Math.max(.08,Math.pow(d,.55))}
function draw(){const aspect=canvas.width/canvas.height;const proj=perspective(mat4(),Math.PI/3,aspect,.06,500);const fx=Math.sin(player.yaw)*Math.cos(player.pitch),fy=Math.sin(player.pitch),fz=-Math.cos(player.yaw)*Math.cos(player.pitch);const view=lookAt(mat4(),player.x,player.y,player.z,player.x+fx,player.y+fy,player.z+fz);const vp=mul(proj,view);gl.viewport(0,0,canvas.width,canvas.height);const dl=dayLight();gl.clearColor(.03+.10*dl,.04+.11*dl,.05+.13*dl,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(program.vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.uniformMatrix4fv(gl.getUniformLocation(program,'uVP'),false,vp);gl.uniform1f(gl.getUniformLocation(program,'uDay'),dl);gl.drawElements(gl.TRIANGLES,program.count,gl.UNSIGNED_INT,0)}
function resize(){const d=devicePixelRatio||1;canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d)}
function resetInput(){input.mx=input.my=0;knob.style.transform='translate(0px,0px)';}
function pointerPad(e){const r=pad.getBoundingClientRect();let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const max=r.width*.32;const l=Math.hypot(x,y);if(l>max){x=x/l*max;y=y/l*max}input.mx=x/max;input.my=y/max;knob.style.transform=`translate(${x}px,${y}px)`}
pad.addEventListener('pointerdown',e=>{input.pid=e.pointerId;input.active=true;pad.setPointerCapture(e.pointerId);pointerPad(e)});pad.addEventListener('pointermove',e=>{if(input.active&&e.pointerId===input.pid)pointerPad(e)});pad.addEventListener('pointerup',()=>{input.active=false;resetInput()});pad.addEventListener('pointercancel',()=>{input.active=false;resetInput()});
runButton.addEventListener('pointerdown',e=>{e.preventDefault();input.run=true});runButton.addEventListener('pointerup',()=>input.run=false);runButton.addEventListener('pointercancel',()=>input.run=false);runButton.addEventListener('pointerleave',()=>input.run=false);
lookZone.addEventListener('pointerdown',e=>{look.active=true;look.pid=e.pointerId;look.x=e.clientX;look.y=e.clientY;lookZone.setPointerCapture(e.pointerId)});lookZone.addEventListener('pointermove',e=>{if(!look.active||e.pointerId!==look.pid)return;const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;player.yaw-=dx*.0042;player.pitch=Math.max(-1.25,Math.min(1.25,player.pitch-dy*.0032))});lookZone.addEventListener('pointerup',()=>look.active=false);lookZone.addEventListener('pointercancel',()=>look.active=false);
addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('click',()=>{if(started && canvas.requestPointerLock)canvas.requestPointerLock()});addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){player.yaw-=e.movementX*.0025;player.pitch=Math.max(-1.25,Math.min(1.25,player.pitch-e.movementY*.002))}});
enterCity.addEventListener('click',()=>start(),{once:true});enterCity.addEventListener('pointerup',()=>{},false);
function start(){try{started=true;startScreen.style.display='none';hud.hidden=false;statusEl.textContent='CITY ONLINE';player.x=0;player.z=18;last=performance.now();requestAnimationFrame(loop)}catch(e){fail(e)}}
function loop(t){if(!started)return;const dt=Math.min(.033,(t-last)/1000);last=t;worldMinutes=(worldMinutes+dt*12)%1440;updateMove(dt);draw();const h=Math.floor(worldMinutes/60),m=Math.floor(worldMinutes%60);clockEl.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');requestAnimationFrame(loop)}
try{resize();addEventListener('resize',resize);addCity();initGL();}catch(e){fail(e)}
})();
