import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Route, formatTime } from './route';
import { VehiclePhysics, Controls } from './physics';
import { World, Weather } from './world';
import { Car } from './car';
import { Cockpit } from './cockpit';
import { DrivingEffects } from './effects';
import { Soundscape } from './audio';
import { buildUI, activities, icons } from './ui';

type Screen='loading'|'menu'|'drive'|'garage'|'photo';
type Records={distance:number;topSpeed:number;completed:number;best:Record<string,number>};
type Settings={volume:number;quality:string;units:'kmh'|'mph';weather:Weather};
const $=(id:string)=>document.getElementById(id)!;
const route=new Route(),map=buildUI(route),physics=new VehiclePhysics(route),sound=new Soundscape();
let records:Records={distance:0,topSpeed:0,completed:0,best:{}};
let settings:Settings={volume:.65,quality:'High',units:'kmh',weather:'Sunset'};
try{const r=JSON.parse(localStorage.getItem('alpine.records.v1')||'null');if(r&&Number.isFinite(r.distance)&&Number.isFinite(r.topSpeed)&&Number.isFinite(r.completed)&&r.best&&typeof r.best==='object')records=r;const s=JSON.parse(localStorage.getItem('alpine.settings.v1')||'null');if(s){if(Number.isFinite(s.volume))settings.volume=THREE.MathUtils.clamp(s.volume,0,1);if(['High','Balanced'].includes(s.quality))settings.quality=s.quality;if(['kmh','mph'].includes(s.units))settings.units=s.units;if(['Sunset','Clear','Overcast'].includes(s.weather))settings.weather=s.weather;}}catch{/* Storage is optional in private browser sessions. */}
const save=()=>{try{localStorage.setItem('alpine.records.v1',JSON.stringify(records));localStorage.setItem('alpine.settings.v1',JSON.stringify(settings));}catch{}};
let screen:Screen='loading',modal='',paused=false,photoReturn:Screen='drive';
let activeActivity:typeof activities[number]|undefined,checkpoint=0,elapsed=0,countdown=0,runTopSpeed=0,penalty=0,penaltyCooldown=0;
let cameraMode=0,time=0,toastTimer=0,routeTimer=0,accumulator=0,last=performance.now(),saveTimer=0,frameCount=0;
let photoGrid=false,photoSavedPose:{pos:THREE.Vector3;target:THREE.Vector3}|undefined;
const keys=new Set<string>(),touch=new Set<string>();
const input:Controls={throttle:0,brake:0,steer:0,handbrake:false};
const scene=new THREE.Scene();
function createRenderer(){try{return new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});}catch(error){$('load-status').textContent='WEBGL 2 IS REQUIRED. ENABLE HARDWARE ACCELERATION AND RELOAD.';throw error;}}
const renderer=createRenderer();
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='High'?1.5:1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('canvas-host').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive Porsche mountain driving simulator');
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.08,7000);
scene.add(camera);const cockpit=new Cockpit(camera);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.8;
const world=new World(scene,route);world.sun.shadow.mapSize.setScalar(settings.quality==='High'?2048:1024);world.setWeather(settings.weather);const car=new Car(scene);const effects=new DrivingEffects(scene);const orbit=new OrbitControls(camera,renderer.domElement);orbit.enabled=false;orbit.enableDamping=true;orbit.dampingFactor=.07;orbit.minDistance=2.4;orbit.maxDistance=45;orbit.maxPolarAngle=Math.PI*.48;orbit.target.set(0,49,0);
const tempV=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3();
const cameraNames=['CHASE','COCKPIT','HOOD','CINEMATIC'];
let cameraSnap=true;

function setScreen(next:Screen){
 renderer.shadowMap.needsUpdate=true;
 if(next==='menu'){toastTimer=0;$('toast').classList.remove('show');}
 screen=next;for(const id of ['menu','hud','garage','photo'])$(id).classList.toggle('hidden',id!==(next==='drive'?'hud':next));
 orbit.enabled=next==='garage'||next==='photo';camera.clearViewOffset();cameraSnap=true;
 if(next!=='drive'){keys.clear();touch.clear();input.throttle=input.brake=input.steer=0;input.handbrake=false;}
}
function toast(text:string){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=3.3;}
function roadMessage(text:string){$('route-message').textContent=text;routeTimer=3;}
function closeModal(){ $('modal').classList.add('hidden');modal='';paused=false;keys.clear();last=performance.now(); }
function openModal(kind:string,html:string){modal=kind;paused=true;keys.clear();touch.clear();$('modal-body').innerHTML=html;$('modal').classList.remove('hidden');requestAnimationFrame(()=>($('modal').querySelector('button') as HTMLButtonElement)?.focus());}
function statsHTML(){return `<div class="records"><div class="record"><span>DISTANCE DRIVEN</span><strong>${(records.distance/1000).toFixed(1)} <small>KM</small></strong></div><div class="record"><span>PERSONAL TOP SPEED</span><strong>${Math.round(records.topSpeed)} <small>KM/H</small></strong></div><div class="record"><span>DRIVES COMPLETED</span><strong>${records.completed.toString().padStart(2,'0')}</strong></div></div>`;}
function showChallenges(){openModal('challenges',`<div class="eyebrow">A ROAD. FOUR WAYS TO FEEL IT.</div><h2 id="modal-title">Find your driving moment.</h2><p class="modal-intro">No opponents. No distractions. Just you, the car, and the mountain.</p><div class="challenge-list">${activities.map(a=>`<button class="challenge-card" data-activity="${a.id}"><span class="number">${a.number}</span><span class="eyebrow">${a.type}</span><h3>${a.name}</h3><p>${a.desc}</p>${records.best[a.id]!==undefined?`<div class="best">PERSONAL BEST · ${a.id==='speed'?Math.round(records.best[a.id])+' KM/H':a.id==='scenic'?'ROUTE DISCOVERED':formatTime(records.best[a.id])}</div>`:''}<footer><span>${a.target}</span>${icons.arrow}</footer></button>`).join('')}</div>${statsHTML()}`);}
function showSettings(){openModal('settings',`<div class="eyebrow">MAKE IT YOURS</div><h2 id="modal-title">The finer details.</h2><p class="modal-intro">A little adjustment. A different feeling.</p><div class="settings-row"><div><strong>Atmosphere</strong><small>The same road, in a different light.</small></div><div class="segments">${(['Sunset','Clear','Overcast'] as Weather[]).map(w=>`<button data-weather="${w}" class="${settings.weather===w?'selected':''}">${w}</button>`).join('')}</div></div><div class="settings-row"><div><strong>Soundscape</strong><small>Engine, tires, wind & mountain ambience.</small></div><input aria-label="Sound volume" id="volume" type="range" min="0" max="100" value="${settings.volume*100}"></div><div class="settings-row"><div><strong>Rendering quality</strong><small>Balanced uses a lighter rendering resolution.</small></div><div class="segments">${['Balanced','High'].map(q=>`<button data-quality="${q}" class="${q===settings.quality?'selected':''}">${q}</button>`).join('')}</div></div><div class="settings-row"><div><strong>Speed units</strong><small>Choose the numbers you know.</small></div><div class="segments"><button data-unit="kmh" class="${settings.units==='kmh'?'selected':''}">KM/H</button><button data-unit="mph" class="${settings.units==='mph'?'selected':''}">MPH</button></div></div><div class="controls-list"><div>Accelerate <kbd>W / ↑</kbd></div><div>Brake / reverse <kbd>S / ↓</kbd></div><div>Steering <kbd>A D / ← →</kbd></div><div>Handbrake <kbd>SPACE</kbd></div><div>Cycle camera <kbd>C</kbd></div><div>Photo mode <kbd>P</kbd></div><div>Recover car <kbd>R</kbd></div><div>Pause <kbd>ESC</kbd></div></div><p class="modal-intro" style="font-size:9px;margin:23px 0 0">Controller: left stick steer · RT throttle · LT brake · A handbrake · Y camera · Start pause</p>`);}
function showPause(){openModal('pause',`<div class="eyebrow">TAKE A BREATH</div><h2 id="modal-title">The mountain can wait.</h2><p class="modal-intro">${activeActivity?activeActivity.name:'Free drive'} · Col de Lumière</p><div class="pause-actions"><button class="primary" data-action="resume">Back to the drive ${icons.arrow}</button>${activeActivity?'<button class="secondary" data-action="restart">Restart this challenge <span>↗</span></button>':''}<button class="secondary" data-action="challenges">Choose a challenge <span>↗</span></button><button class="secondary" data-action="settings">Settings <span>↗</span></button><button class="secondary" data-action="menu">Return to main menu <span>↗</span></button></div>${statsHTML()}`);}
function startDrive(id?:string){
 closeModal();effects.reset();activeActivity=activities.find(a=>a.id===id);checkpoint=0;elapsed=0;runTopSpeed=0;penalty=0;penaltyCooldown=0;
 physics.reset(activeActivity?.start??0);car.update(physics,false,time);countdown=activeActivity?3.6:0;
 world.setCheckpoints(activeActivity?.checkpoints??[]);setScreen('drive');
 $('challenge-hud').classList.toggle('hidden',!activeActivity);$('activity-label').textContent=activeActivity?.type??'FREE DRIVE';$('challenge-progress').style.width='0%';
 if(activeActivity){$('target-label').textContent=activeActivity.id==='speed'?'TARGET':activeActivity.id==='scenic'?'PACE':'TARGET';$('target-value').textContent=activeActivity.id==='speed'?'160 KM/H':activeActivity.id==='scenic'?'YOUR OWN':formatTime(activeActivity.limit);}
 sound.init().catch(()=>toast('Audio unavailable. You can still enjoy the drive.'));sound.volume=settings.volume;
 if(!activeActivity)roadMessage('BREATHE. THEN DRIVE.');
}
function goMenu(){closeModal();effects.reset();save();activeActivity=undefined;world.setCheckpoints([]);physics.reset(.195);car.update(physics,false,time);setScreen('menu');}
function goGarage(){closeModal();physics.reset(.195);car.update(physics,false,time);setScreen('garage');camera.fov=40;camera.updateProjectionMatrix();const center=car.root.position.clone().add(new THREE.Vector3(0,.8,0));orbit.target.copy(center);camera.position.copy(innerWidth<700?localPosition(9,3.8,11):localPosition(6,2.7,7.5));orbit.minDistance=3;orbit.maxDistance=16;orbit.enablePan=false;orbit.update();}
function localPosition(x:number,y:number,z:number){return new THREE.Vector3(x,y,z).applyAxisAngle(THREE.Object3D.DEFAULT_UP,physics.heading).add(car.root.position);}
function enterPhoto(){if(screen!=='drive'&&screen!=='garage')return;photoReturn=screen;photoSavedPose={pos:camera.position.clone(),target:cameraTarget.clone()};setScreen('photo');orbit.target.copy(car.root.position).add(new THREE.Vector3(0,.7,0));if(cameraMode===1||cameraMode===2)camera.position.copy(localPosition(6,2.5,-7));camera.fov=45;camera.updateProjectionMatrix();$('photo-fov').setAttribute('value','45');($('photo-fov') as HTMLInputElement).value='45';$('fov-value').textContent='45°';orbit.minDistance=1.5;orbit.maxDistance=65;orbit.enablePan=true;orbit.update();}
function exitPhoto(){setScreen(photoReturn);if(photoSavedPose)camera.position.copy(photoSavedPose.pos);cameraSnap=true;if(photoReturn==='garage'){orbit.enablePan=false;orbit.maxDistance=16;orbit.target.copy(car.root.position).add(new THREE.Vector3(0,.8,0));}}
function setWeather(w:Weather){renderer.shadowMap.needsUpdate=true;settings.weather=w;world.setWeather(w);$('menu-weather').textContent=w==='Sunset'?'Golden hour':w==='Clear'?'Clear skies':'Overcast';document.querySelectorAll('[data-weather]').forEach(e=>e.classList.toggle('selected',(e as HTMLElement).dataset.weather===w));save();}
function recover(){if(screen!=='drive')return;const nearest=route.nearest(physics.x,physics.z);$('fade').classList.add('on');setTimeout(()=>{physics.reset(nearest.t);car.update(physics,false,time);cameraSnap=true;$('fade').classList.remove('on');if(activeActivity&&activeActivity.id!=='scenic'){penalty+=3;toast('Back on the road · +3s recovery penalty');}else toast('Back where you belong.');},220);}
function finish(){
 const a=activeActivity;if(!a)return;
 const total=elapsed+penalty,success=a.id==='speed'?runTopSpeed>=a.limit:a.id==='scenic'?true:total<=a.limit;
 const value=a.id==='speed'?runTopSpeed:a.id==='scenic'?1:total;
 const old=records.best[a.id],isBest=old===undefined||(a.id==='speed'?value>old:value<old);
 if(success){records.completed++;if(isBest)records.best[a.id]=value;}save();
 openModal('finish',`<div class="eyebrow">${success?(isBest&&a.id!=='scenic'?'A NEW PERSONAL BEST':'A DRIVE TO REMEMBER'):'EVERY DRIVE MAKES YOU BETTER'}</div><h2 id="modal-title">${success?'That’s the feeling.':'Find a little more.'}</h2><p class="modal-intro">${a.name} · ${success?'Challenge complete':'Route complete — target not yet reached'}</p><div class="result-value">${a.id==='speed'?Math.round(runTopSpeed)+'<small style="font-size:20px;letter-spacing:0"> KM/H</small>':a.id==='scenic'?'Beautiful.':formatTime(total)}</div><p class="result-detail">${a.id==='speed'?'Target speed · 160 km/h':a.id==='scenic'?'Four viewpoints. One unforgettable road.':`Target · ${formatTime(a.limit)} &nbsp; / &nbsp; Driving · ${formatTime(elapsed)} &nbsp; / &nbsp; Penalties · ${penalty.toFixed(0)}s`}</p><div class="result-actions"><button class="primary" data-action="restart">Drive it again ${icons.arrow}</button><button class="secondary" data-action="free">Keep exploring <span>↗</span></button></div>${statsHTML()}`);
}
function capture(){
 renderer.render(scene,camera);
 renderer.domElement.toBlob(blob=>{if(!blob){toast('Unable to capture this frame.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Porsche-Alpine-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your moment, captured.');},'image/png');
}
const actions:Record<string,()=>void>={drive:()=>startDrive(),home:goMenu,challenges:showChallenges,garage:goGarage,settings:showSettings,back:goMenu,menu:goMenu,close:()=>{if(modal==='finish'){activeActivity=undefined;world.setCheckpoints([]);$('challenge-hud').classList.add('hidden');$('activity-label').textContent='FREE DRIVE';}closeModal();},pause:showPause,resume:closeModal,restart:()=>startDrive(activeActivity?.id),free:()=>{activeActivity=undefined;world.setCheckpoints([]);$('challenge-hud').classList.add('hidden');$('activity-label').textContent='FREE DRIVE';closeModal();},photo:enterPhoto,'exit-photo':exitPhoto,weather:()=>{const options:Weather[]=['Sunset','Clear','Overcast'];setWeather(options[(options.indexOf(settings.weather)+1)%3]);},'garage-angle':()=>{const v=camera.position.clone().sub(orbit.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP,Math.PI/2);camera.position.copy(orbit.target).add(v);orbit.update();},grid:()=>{photoGrid=!photoGrid;$('photo-grid').classList.toggle('show',photoGrid);},capture};
document.addEventListener('click',e=>{
 const el=(e.target as Element).closest('button,a') as HTMLElement|null;if(!el)return;
 if(el.classList.contains('home-link')){e.preventDefault();goMenu();return;}
 sound.click();
 if(el.dataset.action)actions[el.dataset.action]?.();
 if(el.dataset.activity)startDrive(el.dataset.activity);
 if(el.dataset.weather)setWeather(el.dataset.weather as Weather);
 if(el.dataset.quality){settings.quality=el.dataset.quality;renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='High'?1.5:1));renderer.shadowMap.enabled=true;world.sun.shadow.mapSize.setScalar(settings.quality==='High'?2048:1024);world.sun.shadow.map?.dispose();world.sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;save();showSettings();}
 if(el.dataset.unit){settings.units=el.dataset.unit as Settings['units'];save();showSettings();}
});
document.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(el.id==='volume'){settings.volume=Number(el.value)/100;sound.volume=settings.volume;save();}if(el.id==='photo-fov'){camera.fov=Number(el.value);camera.updateProjectionMatrix();$('fov-value').textContent=el.value+'°';}});
for(const el of document.querySelectorAll<HTMLElement>('[data-touch]')){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touch.add(el.dataset.touch!);});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>touch.delete(el.dataset.touch!));}
let gamepadButtons:boolean[]=[];
function readInput(){
 input.throttle=keys.has('KeyW')||keys.has('ArrowUp')||touch.has('throttle')?1:0;
 input.brake=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake')?1:0;
 input.steer=(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left')?1:0);
 input.handbrake=keys.has('Space');
 const gp=navigator.getGamepads?.()?.find(g=>g?.connected);
 if(gp){const axis=gp.axes[0]??0;input.steer=Math.abs(axis)>.08?Math.sign(axis)*(Math.abs(axis)-.08)/.92:input.steer;input.throttle=Math.max(input.throttle,gp.buttons[7]?.value??0);input.brake=Math.max(input.brake,gp.buttons[6]?.value??0);input.handbrake=input.handbrake||!!gp.buttons[0]?.pressed;
  if(gp.buttons[3]?.pressed&&!gamepadButtons[3]&&screen==='drive'&&!paused){cameraMode=(cameraMode+1)%4;cameraSnap=true;}
  if(gp.buttons[9]?.pressed&&!gamepadButtons[9]&&screen==='drive'){if(paused)closeModal();else showPause();}
  gamepadButtons=gp.buttons.map(b=>b.pressed);$('controller-status').textContent='CONTROLLER CONNECTED';
 }else $('controller-status').textContent='';
}
document.addEventListener('keydown',e=>{
 if((e.target as HTMLElement).tagName==='INPUT')return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 if(e.repeat)return;
 if(e.code==='Escape'){
  if(screen==='photo'){exitPhoto();return;}
  if(modal){actions.close();return;}
  if(screen==='drive')showPause();else if(screen==='garage')goMenu();return;
 }
 if(modal){if(e.code==='Tab'){const focusables=Array.from($('modal').querySelectorAll<HTMLElement>('button,input'));const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(e.code==='KeyP'){if(screen==='photo')exitPhoto();else enterPhoto();return;}
 if(screen==='drive'){
  keys.add(e.code);if(e.code==='KeyC'){cameraMode=(cameraMode+1)%4;cameraSnap=true;toast(cameraNames[cameraMode].toLowerCase()+' camera');}if(e.code==='KeyR')recover();
 }
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();touch.clear();if(screen==='drive'&&!paused)showPause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(screen==='drive'&&!paused)showPause();save();}last=performance.now();});
window.addEventListener('beforeunload',save);
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();cameraSnap=true;});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;toast('Graphics connection interrupted. Reload to continue.');});

function updateCamera(dt:number){
 car.model!.visible=!(screen==='drive'&&cameraMode===1);cockpit.update(physics,screen==='drive'&&cameraMode===1,settings.units,frameCount);
 if(screen==='garage'||screen==='photo'){orbit.update();return;}
 const center=car.root.position;
 if(screen==='menu'||screen==='loading'){
  const sway=Math.sin(time*.08)*.35;
  camera.position.copy(innerWidth<700?localPosition(9.8+sway,3.3,11.8-sway):localPosition(6.1+sway,2.5,7.4-sway));cameraTarget.copy(center).add(new THREE.Vector3(0,.75,0));
  camera.fov=innerWidth<700?42:37;camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(innerWidth<700?.02:.16),-innerHeight*(innerWidth<700?.21:.04),innerWidth,innerHeight);camera.lookAt(cameraTarget);camera.updateProjectionMatrix();return;
 }
 camera.clearViewOffset();
 forward.set(Math.sin(physics.heading),0,Math.cos(physics.heading));right.set(Math.cos(physics.heading),0,-Math.sin(physics.heading));
 const speed=Math.abs(physics.speed),road=route.nearest(physics.x,physics.z);
 const lookAhead=route.at((road.t+Math.sign(physics.speed||1)*.003)%1);
 let desired:THREE.Vector3,target:THREE.Vector3,fov:number;
 if(cameraMode===0){
  desired=center.clone().addScaledVector(forward,-7.6-speed*.025).add(new THREE.Vector3(0,3.05+speed*.008,0));
  target=center.clone().addScaledVector(forward,5).add(new THREE.Vector3(0,1.0+road.grade*4,0));fov=48+Math.min(speed*.21,13);
 }else if(cameraMode===1){
  desired=localPosition(-.35,1.04,.28);target=desired.clone().addScaledVector(forward,20);target.y+=road.grade*20+physics.pitch*3;fov=65+Math.min(speed*.12,7);
 }else if(cameraMode===2){
  desired=localPosition(0,.83,1.22);target=desired.clone().addScaledVector(forward,22);target.y+=road.grade*22;fov=60+Math.min(speed*.13,8);
 }else{
  const a=Math.sin(time*.13)*.8;desired=physics.tunnel?localPosition(3,2.2,-6):localPosition(8*Math.cos(a),2.2,7*Math.sin(a)-2);target=center.clone().add(new THREE.Vector3(0,.65,0));fov=43;
 }
 // Ground-aware camera stays above the actual road and roadside terrain.
 const n=route.nearest(desired.x,desired.z),floor=n.distance<8?n.height:route.terrain(desired.x,desired.z);
 if(!physics.tunnel)desired.y=Math.max(desired.y,floor+.45);
 if(cameraSnap){camera.position.copy(desired);cameraTarget.copy(target);camera.fov=fov;cameraSnap=false;}
 else{const response=cameraMode===1||cameraMode===2?25:5;camera.position.lerp(desired,1-Math.exp(-response*dt));cameraTarget.lerp(target,1-Math.exp(-8*dt));camera.fov+=(fov-camera.fov)*(1-Math.exp(-3*dt));}
 if(physics.impact>.2)camera.position.y+=Math.sin(time*40)*physics.impact*.016;
 camera.lookAt(cameraTarget);camera.updateProjectionMatrix();
 void lookAhead;void right;
}
function updateHUD(){
 const displaySpeed=Math.round(Math.abs(physics.speed)*(settings.units==='mph'?2.23694:3.6));$('speed').textContent=String(displaySpeed).padStart(3,'0');$('speed-unit').textContent=settings.units==='mph'?'MPH':'KM/H';$('gear').textContent=physics.gear<0?'R':String(physics.gear);$('rpm').textContent=`${Math.round(physics.rpm/50)*50} RPM`;$('rpm-fill').style.width=`${physics.rpm/8000*100}%`;$('rpm-fill').style.background=physics.rpm>7000?'#e48e6c':'#e3ca9c';$('camera-name').textContent=cameraNames[cameraMode];$('drive-state').textContent=input.handbrake?'HANDBRAKE':physics.slip>.65?'GRIP LIMIT':physics.offroad?'SHOULDER':'SPORT';
 const gate=$('route-dot-target');gate.style.display=activeActivity?'block':'none';if(activeActivity){const p=route.at(activeActivity.checkpoints[Math.min(checkpoint,activeActivity.checkpoints.length-1)]);gate.setAttribute('cx',String(20+(p.x-map.minX)*map.scale));gate.setAttribute('cy',String(15+(p.z-map.minZ)*map.scale));}
 $('route-dot').setAttribute('cx',String(20+(physics.x-map.minX)*map.scale));$('route-dot').setAttribute('cy',String(15+(physics.z-map.minZ)*map.scale));
 $('road-name').textContent=physics.tunnel?'GALERIE DES PINS':(physics.roadT<.17||physics.roadT>.999)?'VALLÉE DU SOLEIL':physics.roadT<.25?'VIADUC DE LUMIÈRE':physics.roadT<.5?'LACETS DU SOMMET':physics.roadT<.7?'BELVÉDÈRE':'ROUTE DES SAPINS';
 if(activeActivity){$('checkpoint-label').textContent=`${activeActivity.id==='scenic'?'VIEWPOINT':'CHECKPOINT'} ${Math.min(checkpoint+1,activeActivity.checkpoints.length).toString().padStart(2,'0')} / ${activeActivity.checkpoints.length.toString().padStart(2,'0')}`;$('timer').textContent=activeActivity.id==='speed'?`${Math.round(runTopSpeed)} KM/H`:activeActivity.id==='scenic'?`${checkpoint} / ${activeActivity.checkpoints.length}`:formatTime(elapsed+penalty);}
 $('countdown').textContent=countdown>.6?String(Math.ceil(countdown-.6)):countdown>0?'DRIVE':'';
}
function updateChallenge(dt:number,oldX:number,oldZ:number){
 if(!activeActivity||countdown>0)return;elapsed+=dt;runTopSpeed=Math.max(runTopSpeed,physics.speed*3.6);penaltyCooldown=Math.max(0,penaltyCooldown-dt);
 if(activeActivity.id==='corner'&&penaltyCooldown===0&&(physics.impact>.2||physics.offroad)){penalty+=2;penaltyCooldown=2;roadMessage('KEEP IT CLEAN · +2 SECONDS');}
 const target=route.at(activeActivity.checkpoints[checkpoint]);
 // Swept XZ checkpoint test prevents missed gates at low frame rates or high speed.
 const dx=physics.x-oldX,dz=physics.z-oldZ,l2=dx*dx+dz*dz;
 const u=l2>0?THREE.MathUtils.clamp(((target.x-oldX)*dx+(target.z-oldZ)*dz)/l2,0,1):0;
 const distance=Math.hypot(oldX+dx*u-target.x,oldZ+dz*u-target.z);
 if(distance<8.8){world.checkpointObjects[checkpoint].visible=false;checkpoint++;$('challenge-progress').style.width=`${checkpoint/activeActivity.checkpoints.length*100}%`;if(checkpoint===activeActivity.checkpoints.length){finish();return;}world.checkpointObjects[checkpoint].visible=true;roadMessage(activeActivity.id==='scenic'?['THE VALLEY OPENS UP.','A LITTLE CLOSER TO THE SKY.','THIS IS WHY YOU TOOK THE LONG WAY.'][checkpoint-1]||'TAKE IT ALL IN.':'CHECKPOINT · KEEP YOUR RHYTHM');sound.click();}
}
function animate(now:number){
 requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;frameCount++;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}if(routeTimer>0){routeTimer-=dt;if(routeTimer<=0)$('route-message').textContent='';}
 const driving=screen==='drive'&&!paused;readInput();
 if(driving){
  if(countdown>0){countdown=Math.max(0,countdown-dt);accumulator=0;}else{
   accumulator+=dt;while(accumulator>=1/120){const oldX=physics.x,oldZ=physics.z,before=physics.distance;physics.update(1/120,input);records.distance+=physics.distance-before;records.topSpeed=Math.max(records.topSpeed,physics.topSpeed);updateChallenge(1/120,oldX,oldZ);accumulator-=1/120;if(paused)break;}
  }
 }else accumulator=0;
 if(car.model){if(screen!=='photo'&&!paused)car.update(physics,driving&&input.brake>0,time);updateCamera(dt);world.update(car.root.position,time);effects.update(physics,input,dt,driving&&countdown===0);}
 if(screen==='drive'&&frameCount%2===0)updateHUD();
 sound.update(physics,input,driving&&countdown===0);if(driving&&Math.abs(physics.speed)>.1)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
 saveTimer+=dt;if(saveTimer>12){saveTimer=0;save();}
}
setWeather(settings.weather);
car.load(p=>{$('load-bar').style.width=`${Math.round(p*95)}%`;$('load-status').textContent=p<.99?'LOADING THE ORIGINAL PORSCHE':'BRINGING THE MOUNTAIN TO LIFE';}).then(()=>{
 physics.reset(.195);car.update(physics,false,0);$('load-bar').style.width='100%';setTimeout(()=>{$('loading').classList.add('hidden');setScreen('menu');},350);
}).catch(error=>{console.error('Porsche asset loading failed',error);$('load-status').textContent='THE PORSCHE COULD NOT LOAD. PLEASE RELOAD TO TRY AGAIN.';$('loading').insertAdjacentHTML('beforeend','<button class="secondary" style="margin-top:25px" onclick="location.reload()">Try again ↗</button>');});
requestAnimationFrame(animate);
// Read-only observability for browser smoke tests and performance diagnostics.
Object.defineProperty(window,'__alpine',{value:{get state(){return {screen,modal,paused,speed:physics.speed,rpm:physics.rpm,gear:physics.gear,position:[physics.x,physics.y,physics.z],heading:physics.heading,slip:physics.slip,roadT:physics.roadT,checkpoint,elapsed,countdown,cameraMode,modelLoaded:!!car.model,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,records:{...records},weather:settings.weather};}},writable:false});
