import {motion} from './motion-settings.js';

const root=document.getElementById('plastic-arc'),stage=root.querySelector('.stage'),status=root.querySelector('.status');
const titleButton=root.querySelector('.current'),number=root.querySelector('.number');
const dedicated=Boolean(titleButton);
const embedded=root.classList.contains('embedded-orbit');
const overview=root.querySelector('.overview');
const linear=root.hasAttribute('data-linear');
const pendant=root.querySelector('.planet-pendant');
const world=root.querySelector('.orbit-world');
let browsingIndex=-1, browseTarget=null;
try{
const T=await import('./media/three.js');
let projects=null;
if(dedicated){
 const responses=await Promise.all([
  fetch('media/grades/catalog.json?v=24'),
  fetch('media/grades/layout-draft.json?v=3')
 ]);
 if(responses.some(response=>!response.ok))throw Error('Could not load the color catalog and order');
 const [catalog,order]=await Promise.all(responses.map(response=>response.json()));
 const byCover=new Map(catalog.map(project=>[project.cover,project]));
 projects=order.map(cover=>byCover.get(cover));
 if(projects.some(project=>!project)||new Set(projects).size!==catalog.length||projects.length!==catalog.length){
  throw Error('The color catalog and layout order do not match');
 }
}
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setClearColor(0,0);
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
stage.appendChild(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,100),group=new T.Group();
scene.add(group);
let environment;
if(!dedicated){
 scene.add(new T.HemisphereLight(0xffffff,0x7a839b,2));
 const key=new T.DirectionalLight(0xffffff,4);
 const rim=new T.DirectionalLight(0xc8d7ff,2.4);
 key.position.set(-3,5,6);
 rim.position.set(5,-2,-3);
 scene.add(key,rim);
 const canvas=document.createElement('canvas');
 canvas.width=1024;canvas.height=512;
 const context=canvas.getContext('2d');
 for(const [color,x,y,w,h] of [
  ['#505969',0,0,1024,512],['#e4e7ed',0,0,1024,180],['#ffffff',130,80,180,290],
  ['#ffffff',650,120,65,260],['#171c26',430,80,100,370]
 ]){
  context.fillStyle=color;context.fillRect(x,y,w,h);
 }
 const env=new T.CanvasTexture(canvas);
 env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;
 const pmrem=new T.PMREMGenerator(renderer);
 environment=pmrem.fromEquirectangular(env);
 scene.environment=environment.texture;
 env.dispose();pmrem.dispose();
}
const geometry=dedicated?null:new T.BoxGeometry(3.8,2.23,.035);
const edgeGeometry=geometry&&new T.EdgesGeometry(geometry);
const cards=[],hits=[];
const prints=["media/prints0.jpg", "media/prints1.jpg", "media/prints2.jpg", "media/prints3.jpg"];
const titles=projects?.map(project=>project.title)??['小森林','降临','侠女','边境杀手'];
const projectCount=titles.length;
const boundPhase=value=>linear?Math.max(-(projectCount-1)*.5,Math.min(0,value)):value;
if(dedicated)root.querySelector('.total').textContent=String(projectCount);
const textureLoader=new T.TextureLoader();
const warmTextures=[];
let idleUpload=0;
function uploadCover(deadline){
 idleUpload=0;
 if(!root.isConnected)return;
 if(deadline.timeRemaining()>5)renderer.initTexture(warmTextures.shift());
 if(warmTextures.length)idleUpload=requestIdleCallback(uploadCover);
}
function makeTexture(i){
 const url=projects ? projects[i].cover+'?v=matte-3' : prints[i];
 return textureLoader.load(url,texture=>{
  if(!dedicated||!window.requestIdleCallback)return;
  warmTextures.push(texture);
  if(!idleUpload)idleUpload=requestIdleCallback(uploadCover);
 });
}
const plastic=dedicated?null:new T.MeshPhysicalMaterial({color:0xe4eaf2,metalness:0,roughness:.19,transparent:true,opacity:.5,depthWrite:false,clearcoat:1,clearcoatRoughness:.11,envMapIntensity:1.5});
const edge=dedicated?null:new T.LineBasicMaterial({color:0x48505b,transparent:true,opacity:.6});
const faceGeometry=new T.PlaneGeometry(dedicated ? 3.78 : 3.72,dedicated ? 2.21 : 2.15);
for(let i=0;i<projectCount;i++){
 const card=new T.Group();
 const texture=makeTexture(i);
 texture.colorSpace=T.SRGBColorSpace;
 const face=new T.Mesh(faceGeometry,new T.MeshBasicMaterial({
  map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2
 }));
 let hit=face;
 if(!dedicated){
  const box=new T.Mesh(geometry,plastic);
  card.add(box,new T.LineSegments(edgeGeometry,edge));
  face.position.z=.030;
  hit=box;
 }
 card.add(face);
 hit.userData.index=i;
 hits.push(hit);
 card.userData={index:i,lift:0,texture,face};
 group.add(card);
 cards.push(card);
}
let phase=0,yaw=-.12,pitch=.06,playing=!matchMedia("(prefers-reduced-motion: reduce)").matches,hover=-1,drag=null,visible=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function wrap(t){
 const period=projectCount*.5;
 return ((t+period/2)%period+period)%period-period/2;
}
const reels=projects?.map(project=>project.video)??['media/reels0.mp4','media/reels1.mp4','media/reels2.mp4','media/reels3.mp4'];let pinned=-1;

const back=root.querySelector('.back'), statusLabel=root.querySelector('.status');
root.querySelector('.about')?.addEventListener('click',()=>root.querySelector('.bio').showModal());
function showIndex(i){
 if(!dedicated||browsingIndex===i)return;
 browsingIndex=i;
 titleButton.textContent=titles[i];
 titleButton.parentElement.classList.toggle('long-title',titles[i].length>6);
 number.textContent=String(i+1).padStart(2,'0');
}
function focusedIndex(){
 return ((Math.round(-phase*2)%projectCount)+projectCount)%projectCount;
}
const media=reels.map((src,i)=>{
 const v=document.createElement('video');
 v.muted=true;v.playsInline=true;v.preload='auto';
 const tex=new T.VideoTexture(v);
 tex.colorSpace=T.SRGBColorSpace;
 const cover=cards[i].userData.face;
 const crop=projects?.[i].crop;
 if(crop){
  tex.offset.set(crop[0],crop[1]);
  tex.repeat.set(crop[2],crop[3]);
 }
 const material=cover.material.clone();
 material.map=tex;
 material.transparent=true;
 material.depthWrite=false;
 material.opacity=0;
 const surface=new T.Mesh(cover.geometry,material);
 surface.position.z=cover.position.z+.002;
 surface.visible=false;
 cards[i].add(surface);
 return {src,v,tex,surface,restart:false,coverTime:0};
});
let goal=0, boost=0, opened=0, started=false, wheelAt=-Infinity, wheelSum=0, latched=false;
let phaseVelocity=0, backgroundIndex=-1, playbackFromOverview=false;
let wheelTarget=null, wheelLastAt=0, wheelAxis='y', wheelDirection=0;
function select(i,direction=0){
 wheelTarget=null;
 clearBlankTap();
 if(pinned>=0)media[pinned].v.pause();
 const target=-i*.5;
 goal=linear?target:direction&&pinned>=0?goal-direction*.5:phase+wrap(target-phase);
 pinned=i;browseTarget=null;showIndex(i);started=false;boost=0;hover=-1;
 if(!dedicated)updateBackground();
 if(!media[i].v.hasAttribute('src'))media[i].v.src=media[i].src;
 media[i].restart=true;media[i].coverTime=0;if(back)back.hidden=false;root.dataset.selected=i;statusLabel.textContent=titles[i];if(!dedicated)root.querySelector("footer>small").textContent="滚动或滑动切换 · 点击收起";
}
function closeCard(){wheelAt=-Infinity;
 if(pinned<0)return;wheelTarget=null;media[pinned].v.pause();pinned=-1;playbackFromOverview=false;updateBackground();started=false;
 if(back)back.hidden=true;
 delete root.dataset.selected;statusLabel.textContent='';
 if(!dedicated)root.querySelector('footer>small').textContent='滚动加速 · 点击展开';
}
if(back)back.onclick=()=>closeCard();
(dedicated ? document : root).addEventListener('keydown', event=>{
 if(event.key==='Escape'&&!root.querySelector('dialog[open]'))dismissPlayback();
});
let wheelDir=0,previousAmount=0,peak=0,subsided=false;
function step(dir){
 const index=linear?Math.max(0,Math.min(projectCount-1,pinned+dir)):(pinned+dir+projectCount)%projectCount;
 if(index!==pinned)select(index,dir);
}

const clamp=T.MathUtils.clamp;
const bands=projects?.map(project=>project.bands)??[[[112, 135, 117], [110, 133, 115], [106, 129, 111], [107, 129, 110], [112, 134, 115], [90, 120, 111], [49, 101, 24], [52, 105, 29]], [[45, 102, 111], [119, 93, 70], [8, 103, 109], [24, 110, 117], [7, 82, 89], [63, 108, 126], [32, 52, 62], [18, 41, 31]], [[99, 108, 67], [106, 115, 76], [96, 94, 61], [106, 110, 73], [118, 111, 78], [102, 108, 78], [110, 120, 86], [101, 111, 75]], [[45, 73, 59], [51, 73, 60], [59, 67, 48], [60, 67, 46], [52, 81, 68], [54, 81, 65], [44, 81, 76], [42, 74, 65]]];
// Small pre-painted gradients avoid rebuilding a full-size gradient when the reel changes.
const bandCanvas=document.createElement('canvas');
bandCanvas.width=64;
bandCanvas.height=144;
const bandContext=bandCanvas.getContext('2d');
const sideShade=bandContext.createLinearGradient(0,0,bandCanvas.width,0);
sideShade.addColorStop(0,'#080c1450');
sideShade.addColorStop(.5,'#080c1400');
sideShade.addColorStop(1,'#080c1450');
const backgrounds=bands.map(rows=>{
 const layer=document.createElement('div');
 const gradient=bandContext.createLinearGradient(0,0,0,bandCanvas.height);
 rows.forEach((rgb,index)=>{
  const color='rgb('+rgb.join(',')+')';
  gradient.addColorStop((14+index*9.6)/100,color);
  gradient.addColorStop((18+index*9.6)/100,color);
 });
 bandContext.fillStyle=gradient;
 bandContext.fillRect(0,0,bandCanvas.width,bandCanvas.height);
 bandContext.fillStyle=sideShade;
 bandContext.fillRect(0,0,bandCanvas.width,bandCanvas.height);
 layer.style.cssText='position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity '+(reduced?'0s':'.55s')+' ease';
 layer.style.backgroundImage='url('+bandCanvas.toDataURL('image/png')+')';
 layer.style.backgroundSize='100% 100%';
 stage.insertBefore(layer,renderer.domElement);
 return layer;
});
stage.style.position='relative';renderer.domElement.style.position='relative';
function updateBackground(){
 if(pinned===backgroundIndex)return;
 if(backgroundIndex>=0)backgrounds[backgroundIndex].style.opacity='0';
 backgroundIndex=pinned;
 if(backgroundIndex>=0)backgrounds[backgroundIndex].style.opacity='1';
}
// Bounds include the plastic and both image surfaces in the carousel's local space.
const panelBounds=dedicated
 ? new T.Box3(new T.Vector3(-1.89,-1.105,0),new T.Vector3(1.89,1.105,.002))
 : new T.Box3(new T.Vector3(-1.9,-1.115,-.018),new T.Vector3(1.9,1.115,.033));
const panelData=cards.map(card=>({card,bounds:new T.Box3(),x:0}));
function keepClear(halfWidth){
 const panels=panelData.filter(({card})=>card.visible);
 for(const panel of panels){
  panel.card.updateMatrix();
  panel.bounds.copy(panelBounds).applyMatrix4(panel.card.matrix);
  panel.x=panel.card.position.x;
 }
 panels.sort((a,b)=>a.x-b.x);
 let totalWeight=0, weightedShift=0;
 for(let i=0;i<panels.length;i++){
  const right=panels[i];
  for(let j=0;j<i;j++){
   const left=panels[j];
   const depthGap=Math.max(right.bounds.min.z-left.bounds.max.z,left.bounds.min.z-right.bounds.max.z);
   if(depthGap>=.20||right.bounds.max.y<left.bounds.min.y||left.bounds.max.y<right.bounds.min.y)continue;
   const clearance=(left.bounds.max.x-left.x)+(right.x-right.bounds.min.x)+.06;
   const pressure=1-T.MathUtils.smoothstep(depthGap,.035,.20);
   const remaining=left.card.position.x+clearance-right.card.position.x;
   right.card.position.x+=Math.max(0,remaining)*pressure;
  }
  // Keep the selected panel steady while sharing corrections among neighbours.
  const weight=(1+right.card.userData.lift*18)*Math.max(0,1-Math.abs(right.x)/(halfWidth*1.35));
  weightedShift+=(right.card.position.x-right.x)*weight;
  totalWeight+=weight;
 }
 if(totalWeight)for(const {card} of panels)card.position.x-=weightedShift/totalWeight;
}

function dampedMove(position,target,velocity,dt,frequency=11){
 const distance=position-target;
 const momentum=velocity+frequency*distance;
 const decay=Math.exp(-frequency*dt);
 return [
  target+(distance+momentum*dt)*decay,
  (velocity-frequency*momentum*dt)*decay
 ];
}
function layout(dt){
 const k=1-Math.exp(-dt*(reduced?35:6.5));
 const openGoal=pinned>=0?1:0;
 opened+=(openGoal-opened)*k;
 if(Math.abs(openGoal-opened)<.001)opened=openGoal;
 if(wheelTarget!==null&&performance.now()-wheelLastAt>130)finishWheel();
 const scrubbing=wheelTarget!==null;
 const target=scrubbing?wheelTarget:pinned>=0?goal:browseTarget;
 if(dedicated&&target!==null){
  if(reduced){
   phase=target;phaseVelocity=0;
  }else{
   // A critically damped move keeps the current velocity when the user reverses direction.
   [phase,phaseVelocity]=dampedMove(phase,target,phaseVelocity,dt,scrubbing?28:11);
  }
  if(!scrubbing&&pinned<0&&Math.abs(phase-target)<.003&&Math.abs(phaseVelocity)<.025){
   phase=target;browseTarget=null;
  }
 }else if(pinned>=0)phase+=(goal-phase)*k;
 else {
  const cruise=playing&&!drag&&!linear ? (dedicated ? -.055 : .055) : 0;
  const decay=Math.exp(-dt*2.3);
  phase+=cruise*dt+boost*(1-decay)/2.3;
  boost*=decay;
  phaseVelocity=cruise+boost;
 }
 phase=boundPhase(phase);
 if(pinned<0)showIndex(focusedIndex());
 if(linear)root.toggleAttribute('data-orbit-start',
   (pinned>=0?pinned:focusedIndex())===0&&(wheelTarget===null||wheelTarget>=-.08));
 if(!scrubbing&&dedicated&&pinned>=0&&pinned!==backgroundIndex&&Math.abs(goal-phase)<.27)updateBackground();
 if(!dedicated)group.rotation.set(pitch*(1-opened),yaw*(1-opened),0);

 const mix=T.MathUtils.lerp;
 const size=Math.min(halfW*(compact ? .70 : .55)/1.9,halfH*.58/1.115);
 const radius=halfW*2.65;
 const tilt=.49;
 const roll=compact ? .48 : .60;
 const cosRoll=Math.cos(roll),sinRoll=Math.sin(roll);
 const anchorX=halfW*(compact ? 0 : .12)*(1-opened);
 const anchorY=halfH*(compact ? .04 : .025)*(1-opened);
 cards.forEach((g,i)=>{
  const t=linear?i*.5+phase:wrap(i*.5+phase);
  g.visible=!dedicated||Math.abs(t)<=1.85;
  if(!g.visible){g.userData.lift=0;return;}
  const angle=t*.40,x=Math.sin(angle)/Math.sin(.40);
  const lift=g.userData.lift;
  const approaching=scrubbing||i===pinned||(pinned>=0&&lift>.01);
  const focusTarget=dedicated
   ? opened*(approaching?1-T.MathUtils.smoothstep(Math.abs(t),.045,.33):0)
   : Number(i===pinned);
  const follow=dedicated&&pinned>=0&&!reduced ? 1-Math.exp(-dt*(compact ? 30 : 16)) : k;
  const focus=g.userData.lift=lift+(focusTarget-lift)*follow;
  // Wrap beyond the viewport on the unseen half of the track.
  const lateral=halfW*(1.52+(dedicated ? .46 : .10)*opened);

  // Give the two adjacent panels depth clearance before enlarging the selection.
  const depth=(Math.cos(angle)-1)*lateral/Math.sin(.40)-opened*T.MathUtils.smoothstep(Math.abs(t),0,.5)*.95;
  let small=Math.min(1,halfW*.34);
  if(dedicated){
   // Project the near side of a tilted circle. The rear half never enters the draw list.
   const theta=t*.49;
   const along=radius*Math.sin(theta);
   const retreat=radius*(1-Math.cos(theta));
   const rise=retreat*Math.sin(tilt);
   const trackX=anchorX+along*cosRoll+rise*sinRoll;
   const trackY=anchorY-along*sinRoll+rise*cosRoll;
   const depth=-retreat*(compact ? 3.5 : Math.cos(tilt))-opened*T.MathUtils.smoothstep(Math.abs(t),.08,.50)*1.55;
   const perspective=1-depth/camera.position.z;
   g.position.set(trackX*perspective,trackY*perspective,depth);
   g.rotation.set(
    (pitch-.09+.11*t)*(1-focus),
    (yaw-.53*t)*(1-focus),
    (.075-.24*t)*(1-focus)
   );
   const edgeSize=.24+.76*Math.exp(-23*t*t);
   const thumbnail=Math.min(.78,halfW*.11);
   small=mix(size*edgeSize,thumbnail,opened);
  }else{
   g.position.set(x*lateral,-x*halfH*.46-.12*halfH*t*t,depth);
   g.rotation.set((-.28+.16*x)*(1-focus),x*.92*(1-focus),(.10*x+.09*t*t)*(1-focus));
  }
  const large=Math.min(halfW*(compact ? .87 : .62)/1.9,halfH*.63/1.115);
  g.scale.setScalar(small+(large-small)*focus);
  if(dedicated){
   g.scale.y*=(3.78/2.21)/projects[i].ratio;
  }
 });
 if(!dedicated)keepClear(halfW);
 const settled=!scrubbing&&pinned>=0&&Math.abs(goal-phase)<.015&&cards[pinned].userData.lift>.97;
 media.forEach((clip,i)=>{
  if(clip.restart&&i===pinned&&settled&&clip.surface.material.opacity===0){
   clip.v.currentTime=0;
   clip.restart=false;
  }
  const ready=i===pinned&&!clip.restart&&(settled||started)&&clip.v.readyState>=2&&!clip.v.seeking;
  if(ready)clip.coverTime+=dt;
  const reveal=ready&&(reduced||clip.coverTime>=.32);
  const departing=(scrubbing||i!==pinned)&&cards[i].userData.lift>.34;
  const progress=departing?0:(reduced?1:dt/(reveal ? .40 : .24))*(reveal?1:-1);
  clip.surface.material.opacity=clamp(clip.surface.material.opacity+progress,0,1);
  clip.surface.visible=clip.surface.material.opacity>0;
  cards[i].userData.face.visible=clip.surface.material.opacity<1;
 });
 if(settled&&!started&&media[pinned].surface.material.opacity===1){
  started=true;
  media[pinned].v.play().catch(()=>{});
 }
}
let halfW=0,halfH=0,compact=false;
const observer=new ResizeObserver(([entry])=>{
 const {width,height}=entry.contentRect;
 if(!width||!height)return;
 const pixelRatio=dedicated
  ? Math.min(devicePixelRatio,1.25,Math.sqrt(1_325_000/(width*height)))
  : Math.min(devicePixelRatio,1.5);
 if(pixelRatio!==renderer.getPixelRatio())renderer.setPixelRatio(pixelRatio);
 renderer.setSize(width,height,false);
 camera.aspect=width/height;
 camera.position.z=Math.max(11,12*height/width)/.84;
 camera.updateProjectionMatrix();
 compact=width<=690;
 halfH=camera.position.z*Math.tan(16*Math.PI/180);
 halfW=halfH*camera.aspect;
});
observer.observe(stage);
const ray=new T.Raycaster(),mouse=new T.Vector2();
function pick(e){const r=stage.getBoundingClientRect();mouse.set(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);ray.setFromCamera(mouse,camera);return ray.intersectObjects(hits).find(({object})=>object.parent.visible)?.object.userData.index??-1;}
let origin;
stage.onpointerdown=e=>{origin=[e.clientX,e.clientY];drag=origin;stage.setPointerCapture(e.pointerId);};
stage.onpointermove=e=>{
 if(drag&&pinned<0&&(!dedicated||e.pointerType!=='touch')){
  yaw=clamp(yaw+(e.clientX-drag[0])*.004,-.65,.65);
  pitch=clamp(pitch+(e.clientY-drag[1])*.003,-.4,.4);
  drag=[e.clientX,e.clientY];
 }
};
stage.onpointerup=e=>{
 drag=null;
 if(!origin)return;
 const dx=e.clientX-origin[0],dy=e.clientY-origin[1];
 const movement=Math.abs(dx)>Math.abs(dy)?dx:dy;
 origin=null;
 if(Math.abs(movement)>=32&&(pinned>=0||(dedicated&&e.pointerType==='touch'))){
  move(-Math.sign(movement));
  return;
 }
 if(Math.hypot(dx,dy)>=6)return;
 const i=pick(e);
 if(!dedicated){
  if(i>=0){if(i===pinned)closeCard();else select(i);}
 }else if(i<0)handleBlankTap(e);
 else{
  clearBlankTap();
  if(pinned!==i)select(i);
 }
};
stage.onpointercancel=()=>{drag=null;origin=null;};
function finishWheel(){
 const destination=wheelTarget;
 wheelTarget=null;
 if(destination===null)return;
 if(pinned<0){browseTarget=destination;return;}
 const slot=Math.round(-destination*2);
 const index=((slot%projectCount)+projectCount)%projectCount;
 if(index!==pinned)select(index);
 goal=-slot*.5;
}
function browseWheel(event){
 const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
 const primary=horizontal?event.deltaX:event.deltaY;
 if(event.deltaMode!==0){
  const direction=Math.sign(primary);
  if(!direction)return;
  clearBlankTap();
  wheelTarget=boundPhase(Math.round(phase*2)/2-direction*.5);
  finishWheel();
  return;
 }
 const now=performance.now();
 if(wheelTarget===null||now-wheelLastAt>130){
  finishWheel();
  wheelAxis=horizontal?'x':'y';
  wheelDirection=0;
 }
 const along=wheelAxis==='x'?event.deltaX:event.deltaY;
 const across=wheelAxis==='x'?event.deltaY:event.deltaX;
 if(Math.abs(across)>Math.abs(along)*2.5+6)wheelAxis=wheelAxis==='x'?'y':'x';
 const delta=wheelAxis==='x'?event.deltaX:event.deltaY;
 if(!delta)return;

 clearBlankTap();
 if(wheelTarget===null){
  wheelTarget=phase;
  browseTarget=null;
  boost=0;
  if(pinned>=0){media[pinned].v.pause();started=false;}
 }
 const direction=Math.sign(delta);
 if(wheelDirection&&direction!==wheelDirection){
  wheelTarget=phase;
  phaseVelocity=0;
 }
 wheelDirection=direction;
 wheelLastAt=now;
 // The browser already delivers trackpad momentum. Only one bounded fraction
 // of a revolution can remain ahead of the displayed position.
 wheelTarget=boundPhase(phase+clamp(wheelTarget-phase-delta*.0048,-.43,.43));
}
root.addEventListener('wheel',e=>{
 if(e.ctrlKey||root.querySelector('dialog[open]')||!dedicated&&!stage.contains(e.target))return;
 e.preventDefault();
 if(dedicated){browseWheel(e);return;}
 const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);
 if(pinned<0){browseTarget=null;boost=clamp(boost+delta*.003,-2,2);return;}
 const now=performance.now(),dir=Math.sign(delta);
 if(!dir)return;
 const amount=Math.abs(delta),gap=now-wheelAt;
 const renewed=subsided&&amount>=Math.max(3,previousAmount*1.7);
 const fresh=gap>145||dir!==wheelDir||renewed;
 if(fresh){latched=false;wheelSum=0;peak=0;subsided=false;}
 peak=Math.max(peak,amount);
 if(amount<peak*.48)subsided=true;
 previousAmount=amount;wheelAt=now;wheelDir=dir;
 if(latched)return;
 wheelSum+=amount;
 if(wheelSum>=3){latched=true;step(dir);}

},{passive:false});
function move(dir){
 finishWheel();
 clearBlankTap();
 if(pinned>=0){step(dir);return;}
 if(dedicated){
  boost=0;
  browseTarget=boundPhase((browseTarget??Math.round(phase*2)/2)-dir*.5);
 }else boost=dir;
}
root.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
 const action=button.dataset.action;
 if(action==='view'&&pinned<0){
  select(dedicated?focusedIndex():cards.reduce((best,g)=>g.position.z>best.position.z?g:best,cards[0]).userData.index);
  if(dedicated)root.focus({preventScroll:true});
 }
 if(action==='next'||action==='prev')move(action==='next'?1:-1);
 if(action==='play')playing=!playing;
 if(action==='reset'){closeCard();pitch=.06;yaw=-.12;}
}));
if(dedicated){
 root.addEventListener('keydown',event=>{
  if(event.altKey||event.metaKey||event.ctrlKey||root.querySelector('dialog[open]'))return;
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
   event.preventDefault();
   move(event.key==='ArrowRight'?1:-1);
  }
 });
}
let lastBlank=null,blankTimer,overviewOpenedAt=-Infinity,overviewScroll=0;
function clearBlankTap(){
 clearTimeout(blankTimer);
 lastBlank=null;
}
function unfoldOverview(preserveScroll){
 const view=stage.getBoundingClientRect();
 const tiles=[...overview.querySelectorAll('.overview-grid button')];
 const current=tiles.find(tile=>Number(tile.dataset.project)===(pinned>=0?pinned:focusedIndex()));
 const currentBounds=current?.getBoundingClientRect();
 if(!preserveScroll&&currentBounds&&(currentBounds.bottom<35||currentBounds.top>overview.clientHeight-35)){
  overview.scrollTop+=currentBounds.top-overview.clientHeight*.32;
 }
 if(reduced)return;

 // Use the projected corners of a live thin panel as the starting transform of its tile.
 const corner=(card,x,y)=>{
  const point=card.localToWorld(new T.Vector3(x,y,card.userData.face.position.z)).project(camera);
  return [view.left+(point.x+1)*view.width/2,view.top+(1-point.y)*view.height/2];
 };
 const visible=tiles.map(tile=>({tile,rect:tile.getBoundingClientRect()})).filter(({rect})=>
  rect.bottom>0&&rect.top<overview.clientHeight
 );
 for(const [index,{tile,rect}] of visible.entries()){
  const card=cards[Number(tile.dataset.project)];
  let transform;
  // Average the opposite edges to keep the pivot at the centre as the perspective flattens.
  if(card.visible){
   const [a,b,c,d]=[corner(card,-1.89,1.105),corner(card,1.89,1.105),corner(card,-1.89,-1.105),corner(card,1.89,-1.105)];
   const [xx,xy]=a.map((_,i)=>(b[i]-a[i]+d[i]-c[i])/(2*rect.width));
   const [yx,yy]=a.map((_,i)=>(c[i]-a[i]+d[i]-b[i])/(2*rect.height));
   const x=(a[0]+b[0]+c[0]+d[0])/4,y=(a[1]+b[1]+c[1]+d[1])/4;
   if(xx*yy-xy*yx>.01&&x>=-rect.width&&x<=view.right+rect.width){
    transform='matrix('+[xx,xy,yx,yy,x-rect.left-rect.width/2,y-rect.top-rect.height/2].join(',')+')';
   }
  }
  const fromModel=Boolean(transform);
  const column=index%3;
  transform??='translate('+((1-column)*20)+'px, 20px) scale(.95)';
  if(fromModel)tile.style.zIndex='2';
  const animation=tile.animate([
   {transform,opacity:fromModel?1:0},
   {transform:'none',opacity:1}
  ],{
   duration:fromModel?500:390,
   delay:fromModel?0:Math.min(64,index*9),
   easing:'cubic-bezier(.22,.64,.32,1)',
   fill:'backwards'
  });
  animation.finished.then(
   ()=>tile.style.removeProperty('z-index'),
   ()=>tile.style.removeProperty('z-index')
  );
 }
}
let curtainAnimations=[];
let curtainPull=0;
const curtainPose=(progress,sheet)=>`translateY(${(progress-Number(sheet))*100}%)`;
function publishCurtain(detail){
 root.dispatchEvent(new CustomEvent('curtain-motion',{detail}));
}
function animateCurtainWorld(frames,options){
 publishCurtain({frames,options});
 return world.animate(frames.map(({progress,...settings})=>({
  ...settings,transform:curtainPose(progress,false),
 })),options);
}
function stopCurtain(){
 curtainAnimations.forEach(animation=>animation.cancel());
 curtainAnimations=[];
 overview.style.removeProperty('transform');
 world?.style.removeProperty('transform');
}
function followCurtain(progress){
 curtainPull=progress;
 overview.style.transform=curtainPose(progress,true);
 world.style.transform=curtainPose(progress,false);
 publishCurtain({progress});
}
function settleCurtain(){
 root.dataset.overview='';
 pendant.setAttribute('aria-expanded','true');
 pendant.setAttribute('aria-label','向下拉收起调色平铺');
 const progress=curtainPull;
 stopCurtain();
 if(reduced){publishCurtain({progress:1});return;}
 const options={duration:Math.round(motion.curtainDrop-progress*250),easing:'cubic-bezier(.23,.68,.28,1)',fill:'both'};
 curtainAnimations=[
  overview.animate([{transform:curtainPose(progress,true)},{transform:curtainPose(1,true)}],options),
  animateCurtainWorld([{progress},{progress:1}],options),
 ];
}
function openOverview(preserveScroll=false,preview=false){
 if(overview.open)return;
 finishWheel();
 clearBlankTap();
 if(pinned>=0)media[pinned].v.pause();
 overviewOpenedAt=performance.now();
 if(!pendant){
  overview.showModal();
  if(preserveScroll)overview.scrollTop=overviewScroll;
  unfoldOverview(preserveScroll);
  root.dataset.overview='';
  return;
 }
 overview.show();
 overview.scrollTop=preserveScroll?overviewScroll:0;
 world.inert=true;
 pendant.focus({preventScroll:true});
 curtainPull=0;
 if(preview)followCurtain(0);
 else settleCurtain();
}
function dismissPlayback(){
 const returnToGrid=playbackFromOverview;
 closeCard();
 if(returnToGrid)openOverview(true);
}
function handleBlankTap(event){
 if(pendant){
  if(pinned>=0)dismissPlayback();
  return;
 }
 const now=performance.now();
 if(lastBlank&&now-lastBlank.time<340&&Math.hypot(event.clientX-lastBlank.x,event.clientY-lastBlank.y)<32){
  openOverview();
  return;
 }
 clearBlankTap();
 lastBlank={time:now,x:event.clientX,y:event.clientY};
 if(pinned>=0)blankTimer=setTimeout(dismissPlayback,340);
}
function closeOverview(afterClose){
 if(overview.hasAttribute('data-closing'))return;
 const finish=()=>{
  overviewScroll=overview.scrollTop;
  delete overview.dataset.closing;
  delete root.dataset.overview;
  overview.close();
  stopCurtain();
  if(pendant){
   publishCurtain({progress:0});
   world.inert=false;
   pendant.setAttribute('aria-expanded','false');
   pendant.setAttribute('aria-label','向下拉开调色平铺');
     if(!afterClose)pendant.focus({preventScroll:true});
  }
  afterClose?.();
 };
 if(reduced){finish();return;}
 if(pendant&&!root.hasAttribute('data-overview')){
  const progress=curtainPull;
  overview.dataset.closing='';
  stopCurtain();
  const options={duration:260,easing:'cubic-bezier(.22,.63,.32,1)',fill:'both'};
  curtainAnimations=[
   overview.animate([{transform:curtainPose(progress,true)},{transform:curtainPose(0,true)}],options),
   animateCurtainWorld([{progress},{progress:0}],options),
  ];
  curtainAnimations[0].onfinish=finish;
  return;
 }
 if(pendant){
  const fromSheet=getComputedStyle(overview).transform;
  const fromWorld=getComputedStyle(world).transform;
  const progress=fromWorld==='none'?0:new DOMMatrixReadOnly(fromWorld).m42/world.clientHeight;
  stopCurtain();
  overview.dataset.closing='';
  const timing={duration:motion.curtainLift,fill:'both'};
  const sheet=overview.animate([
   {transform:fromSheet,offset:0,easing:'ease-out'},
   {transform:'translateY(0)',offset:.22,easing:'cubic-bezier(.56,.04,.83,.44)'},
   {transform:'translateY(-100%)',offset:1},
  ],timing);
  curtainAnimations=[
   sheet,
   animateCurtainWorld([
    {progress,offset:0,easing:'ease-out'},
    {progress:1,offset:.22,easing:'cubic-bezier(.56,.04,.83,.44)'},
    {progress:0,offset:1},
   ],timing),
   overview.querySelector('.overview-grid').animate([
    {transform:'translateY(0)',offset:0,easing:'ease-out'},
    {transform:'translateY(30px)',offset:.22,easing:'ease-in'},
    {transform:'translateY(0)',offset:.78},
   ],timing),
  ];
  sheet.onfinish=finish;
  return;
 }
 const opacity=getComputedStyle(overview).opacity;
 delete root.dataset.overview;
 overview.dataset.closing='';
 overview.animate([{opacity},{opacity:0}],{
  duration:240,
  easing:'ease-in-out'
 }).finished.then(finish,finish);
}
if(overview){
 const grid=overview.querySelector('.overview-grid');
 projects.forEach((project,index)=>{
  const tile=document.createElement('button');
  tile.type='button';
  tile.setAttribute('aria-label',project.title);
  tile.title=project.title;
  tile.dataset.project=String(index);
  tile.style.setProperty('--frame-ratio',project.gridRatio);
  const image=document.createElement('img');
  image.src=project.cover+'?v=matte-3';
  image.alt='';
  image.loading='lazy';
  tile.append(image);
  tile.addEventListener('click',event=>{
   if(overview.hasAttribute('data-closing')||event.detail>0&&performance.now()-overviewOpenedAt<180)return;
   closeCard();
   phase=-index*.5;
   phaseVelocity=0;
   opened=0;
   cards.forEach((card,i)=>{
    card.userData.lift=0;
    media[i].surface.material.opacity=0;
   });
   select(index);
   playbackFromOverview=true;
   closeOverview(()=>root.focus({preventScroll:true}));
  });
  grid.append(tile);
 });
 if(!pendant)overview.addEventListener('click',event=>{
  if(performance.now()-overviewOpenedAt>=180&&!event.target.closest('button'))closeOverview();
 });
 overview.addEventListener('cancel',event=>{
  event.preventDefault();
  closeOverview();
 });
 overview.addEventListener('close',()=>{
  if(pinned>=0&&started)media[pinned].v.play().catch(()=>{});
 });
 root.addEventListener('keydown',event=>{
  if(pendant&&event.key==='Escape'&&overview.open){closeOverview();return;}
  if(!pendant&&event.key.toLowerCase()==='g'&&!event.ctrlKey&&!event.metaKey&&!overview.open)openOverview();
 });
}
if(pendant){
 root.addEventListener('dismiss-overview',()=>{if(overview.open)closeOverview();});
 const toggle=()=>overview.open?closeOverview():openOverview();
 let pulling, dragged=false;
 pendant.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();
  dragged=false;
  pulling={id:event.pointerId,y:event.clientY,distance:0,wasOpen:overview.open};
  pendant.dataset.pulling='';
  pendant.setPointerCapture(event.pointerId);
 });
 pendant.addEventListener('pointermove',event=>{
  if(pulling?.id!==event.pointerId)return;
  const distance=Math.max(0,event.clientY-pulling.y);
  pulling.distance=distance;
  if(distance>9)dragged=true;
  pendant.style.setProperty('--pull',Math.min(108,distance*.76)+'px');
  if(pulling.wasOpen||!dragged||reduced.matches)return;
  if(!overview.open)openOverview(false,true);
  if(!overview.hasAttribute('data-closing'))followCurtain(Math.min(.68,distance*motion.curtainGain/(overview.clientHeight*.58)));
 });
 const release=event=>{
  if(pulling?.id!==event.pointerId)return;
  const {distance,wasOpen}=pulling;
  pulling=null;
  delete pendant.dataset.pulling;
  pendant.style.removeProperty('--pull');
  const committed=event.type==='pointerup'&&distance>=motion.pullDistance;
  if(wasOpen){if(committed)closeOverview();return;}
  if(overview.open&&!root.hasAttribute('data-overview')){
   if(committed)settleCurtain();
   else closeOverview();
  }else if(committed&&!overview.open)openOverview();
 };
 pendant.addEventListener('pointerup',release);
 pendant.addEventListener('pointercancel',release);
 pendant.addEventListener('click',event=>{
  if(event.detail===0||!dragged)toggle();
  dragged=false;
 });
}
function restore(s){for(const k of ['yaw','pitch','phase'])if(s&&Number.isFinite(s[k])){if(k==='yaw')yaw=Math.max(-.65,Math.min(.65,s[k]));if(k==='pitch')pitch=Math.max(-.4,Math.min(.4,s[k]));if(k==='phase')phase=linear?boundPhase(s[k]):wrap(s[k]);}}
restore(window.openai?.widgetState?.privateContent);window.addEventListener('openai:set_globals',e=>restore(e.detail?.globals?.widgetState?.privateContent));
const io=new IntersectionObserver(entries=>{
 visible=entries[0].isIntersecting;
});io.observe(root);
let compiled=!embedded;
if(embedded){
 const warmScene=()=>{
  if(root.isConnected)renderer.compileAsync(scene,camera).catch(()=>{}).then(()=>{compiled=true;});
 };
 if(window.requestIdleCallback)requestIdleCallback(warmScene,{timeout:350});
 else setTimeout(warmScene,0);
}
let last=performance.now();
let firstFrame=false;
let running=false;
renderer.setAnimationLoop(now=>{
 if(!root.isConnected){
  if(idleUpload)cancelIdleCallback(idleUpload);
  media.forEach(({v,tex,surface})=>{v.pause();tex.dispose();surface.material.dispose();});
  cards.forEach(card=>{card.userData.texture.dispose();card.userData.face.material.dispose();});
  renderer.setAnimationLoop(null);
  observer.disconnect();
  io.disconnect();
  geometry?.dispose();
  edgeGeometry?.dispose();
  faceGeometry.dispose();
  plastic?.dispose();
  edge?.dispose();
  environment?.dispose();
  renderer.dispose();
  return;
 }
 const dt=Math.min((now-last)/1000,.08);
 last=now;
 const active=!embedded||root.hasAttribute('data-active');
 const warming=embedded&&!firstFrame&&Boolean(cards[0].userData.texture.image);
 if(!halfW||!compiled||(!warming&&(!active||!visible))||(overview?.open&&!overview.hasAttribute('data-closing'))){
  running=false;
  if(pinned>=0&&!media[pinned].v.paused)media[pinned].v.pause();
  return;
 }
 if(active&&visible&&!running&&pinned>=0&&started&&!overview?.open)media[pinned].v.play().catch(()=>{});
 running=active&&visible;
 layout(active ? dt : 0);
 renderer.render(scene,camera);
 if(embedded&&warming){
  firstFrame=true;
  root.setAttribute('data-frame','');
 }
});
root.parentElement.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{select(Number(b.dataset.grade));root.scrollIntoView({block:'center'});});status.textContent='';root.dataset.ready='true';
}catch(error){status.textContent='三维预览未能加载：请重试打开预览。';root.setAttribute('data-error','');console.error(error);}
