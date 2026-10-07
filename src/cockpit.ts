import * as THREE from 'three';
import { VehiclePhysics } from './physics';
// A lightweight driver-view surround, since the supplied exterior has no separable cockpit rig.
export class Cockpit {
 root=new THREE.Group();wheel=new THREE.Group(); canvas=document.createElement('canvas');texture:THREE.CanvasTexture;ctx:CanvasRenderingContext2D;
 constructor(camera:THREE.Camera){
  camera.add(this.root);this.root.visible=false;
  const leather=new THREE.MeshStandardMaterial({color:'#141918',roughness:.9,envMapIntensity:.3}),rim=new THREE.MeshStandardMaterial({color:'#252c29',roughness:.68,metalness:.12,envMapIntensity:.5}),silver=new THREE.MeshBasicMaterial({color:'#858e86'});
  const dash=new THREE.Mesh(new THREE.BoxGeometry(2.6,.37,.48),leather);dash.position.set(0,-.72,-.92);dash.rotation.x=-.12;this.root.add(dash);
  const seam=new THREE.Mesh(new THREE.BoxGeometry(2.5,.007,.012),rim);seam.position.set(0,-.544,-.67);this.root.add(seam);
  this.wheel.position.set(0,-.30,-.6);this.root.add(this.wheel);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.205,.024,12,64),rim);this.wheel.add(ring);
  for(const angle of [0,Math.PI,Math.PI*1.5]){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.17,.035,.018),rim);spoke.position.set(Math.cos(angle)*.087,Math.sin(angle)*.087,-.003);spoke.rotation.z=angle;this.wheel.add(spoke);}
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.035,32),leather);hub.rotation.x=Math.PI/2;this.wheel.add(hub);
  const badge=new THREE.Mesh(new THREE.PlaneGeometry(.02,.029),new THREE.MeshBasicMaterial({color:'#b9a173'}));badge.position.z=.02;this.wheel.add(badge);
  const centerMark=new THREE.Mesh(new THREE.BoxGeometry(.01,.027,.006),silver);centerMark.position.set(0,.202,.023);this.wheel.add(centerMark);
  this.canvas.width=768;this.canvas.height=256;this.ctx=this.canvas.getContext('2d')!;this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  const gauges=new THREE.Mesh(new THREE.PlaneGeometry(.61,.205),new THREE.MeshBasicMaterial({map:this.texture,transparent:true}));gauges.position.set(0,-.31,-.84);this.root.add(gauges);
  for(const side of [-1,1]){const pillar=new THREE.Mesh(new THREE.BoxGeometry(.047,1.7,.09),leather);pillar.position.set(side*.98,.12,-.93);pillar.rotation.z=side*.2;this.root.add(pillar);}
 }
 update(p:VehiclePhysics,visible:boolean,units:string,frame:number){
  const entering=visible&&!this.root.visible;this.root.visible=visible;if(!visible)return;this.wheel.rotation.z=p.steer*5.5;
  if(frame%5!==0&&!entering)return;const c=this.ctx;c.clearRect(0,0,768,256);c.fillStyle='#0c1311';c.beginPath();c.roundRect(0,0,768,256,44);c.fill();
  for(let k=0;k<3;k++){const x=135+k*249,y=129,r=k===1?112:92;c.lineWidth=2;c.strokeStyle='#687768';c.beginPath();c.arc(x,y,r,.65,Math.PI*2+.65);c.stroke();c.strokeStyle='#e2d6ac';for(let i=0;i<11;i++){const a=Math.PI*.75+i/10*Math.PI*1.5;c.beginPath();c.moveTo(x+Math.cos(a)*(r-9),y+Math.sin(a)*(r-9));c.lineTo(x+Math.cos(a)*(r-17),y+Math.sin(a)*(r-17));c.stroke();}
   if(k===1){const a=Math.PI*.75+p.rpm/8000*Math.PI*1.5;c.strokeStyle='#db674b';c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*82,y+Math.sin(a)*82);c.stroke();}
   c.textAlign='center';c.fillStyle='#dfdec8';c.font=`${k===1?43:32}px Arial`;c.fillText(k===0?String(Math.round(Math.abs(p.speed)*(units==='mph'?2.23694:3.6))):k===1?String(p.gear<0?'R':p.gear):'SPORT',x,y+19);c.fillStyle='#8c9c88';c.font='13px Arial';c.fillText(k===0?(units==='mph'?'MPH':'KM/H'):k===1?'RPM × 1000':'PORSCHE',x,y+47);
  }
  this.texture.needsUpdate=true;
 }
}
