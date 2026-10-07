import * as THREE from 'three';
import { VehiclePhysics,Controls } from './physics';
export class DrivingEffects {
 marks:THREE.InstancedMesh;particles:THREE.Points;index=0;particleIndex=0;timer=0;
 positions=new Float32Array(48*3);life=new Float32Array(48);dummy=new THREE.Object3D();
 constructor(scene:THREE.Scene){
  const g=new THREE.PlaneGeometry(.23,1);g.rotateX(-Math.PI/2);
  this.marks=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:'#101812',transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),384);
  this.marks.frustumCulled=false;this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<384;i++)this.marks.setMatrixAt(i,this.dummy.matrix);scene.add(this.marks);
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!,gr=ctx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(225,220,197,.48)');gr.addColorStop(.4,'rgba(225,220,197,.21)');gr.addColorStop(1,'rgba(225,220,197,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);
  const pg=new THREE.BufferGeometry();for(let i=0;i<48;i++)this.positions[i*3+1]=-10000;pg.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
  this.particles=new THREE.Points(pg,new THREE.PointsMaterial({map:new THREE.CanvasTexture(c),size:1.2,color:'#c1bda6',transparent:true,opacity:.32,depthWrite:false,sizeAttenuation:true}));this.particles.frustumCulled=false;scene.add(this.particles);
 }
 reset(){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<384;i++)this.marks.setMatrixAt(i,this.dummy.matrix);this.marks.instanceMatrix.needsUpdate=true;this.life.fill(0);for(let i=0;i<48;i++)this.positions[i*3+1]=-10000;this.particles.geometry.attributes.position.needsUpdate=true;}
 update(p:VehiclePhysics,c:Controls,dt:number,active:boolean){
  this.timer+=dt;
  if(active&&this.timer>.045&&Math.abs(p.speed)>5){
   this.timer=0;
   const fx=Math.sin(p.heading),fz=Math.cos(p.heading),rx=Math.cos(p.heading),rz=-Math.sin(p.heading);
   for(const side of [-1,1]){
    const x=p.x-fx*1.42+rx*.79*side,z=p.z-fz*1.42+rz*.79*side;
    const road=p.route.nearest(x,z);
    if((p.slip>.36||c.handbrake)&&!p.offroad){this.dummy.position.set(x,road.height+.025,z);this.dummy.rotation.set(0,p.heading,0);this.dummy.scale.set(1,1,Math.max(.25,Math.abs(p.speed)*.07));this.dummy.updateMatrix();this.marks.setMatrixAt(this.index++%384,this.dummy.matrix);this.marks.instanceMatrix.needsUpdate=true;}
    if(p.offroad||p.slip>.78){const i=this.particleIndex++%48;this.positions[i*3]=x;this.positions[i*3+1]=road.height+.22;this.positions[i*3+2]=z;this.life[i]=1.2;}
   }
  }
  if(active)for(let i=0;i<48;i++){
   if(this.life[i]>0){this.life[i]-=dt;this.positions[i*3]+=.25*dt;this.positions[i*3+1]+=.65*dt;if(this.life[i]<=0)this.positions[i*3+1]=-10000;}
  }
  this.particles.geometry.attributes.position.needsUpdate=true;
 }
}
