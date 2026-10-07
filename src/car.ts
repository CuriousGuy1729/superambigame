import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { VehiclePhysics } from './physics';
export class Car {
  root=new THREE.Group(); body=new THREE.Group(); model?:THREE.Group;
  brakeMaterial=new THREE.MeshStandardMaterial({color:'#7c0804',emissive:'#ff1a05',emissiveIntensity:.5,roughness:.25});
  headMaterial=new THREE.MeshStandardMaterial({color:'#fff1d2',emissive:'#fff0cc',emissiveIntensity:2});
  headlights=new THREE.Group();
  constructor(public scene:THREE.Scene){scene.add(this.root);this.root.add(this.body);}
  async load(progress:(p:number)=>void){
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf=await loader.loadAsync('/assets/porsche-driving.glb',e=>progress(e.total?e.loaded/e.total:.5));
    const model=gltf.scene;
    const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const scale=4.52/size.x;model.scale.setScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    const pivot=new THREE.Group();pivot.add(model);pivot.rotation.y=-Math.PI/2;this.body.add(pivot);this.model=model;
    model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=o.receiveShadow=true;const m=o.material as THREE.MeshStandardMaterial;m.envMapIntensity=.75;m.normalScale.set(.12,.12);m.metalness=.7;m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,0.34);");};if(m.map)m.map.anisotropy=8;}});
    // The supplied mesh is fused. No invented wheel rigs or replacement body geometry.
    const brake=new THREE.Mesh(new THREE.BoxGeometry(1.22,.027,.016),this.brakeMaterial);brake.position.set(0,.66,-2.08);this.body.add(brake);
    const beamCanvas=document.createElement('canvas');beamCanvas.width=64;beamCanvas.height=256;const beamCtx=beamCanvas.getContext('2d')!;
    const beamGradient=beamCtx.createRadialGradient(32,16,3,32,90,150);beamGradient.addColorStop(0,'rgba(255,235,180,.36)');beamGradient.addColorStop(1,'rgba(255,235,180,0)');beamCtx.fillStyle=beamGradient;beamCtx.fillRect(0,0,64,256);
    for(const x of [-.63,.63]){const beam=new THREE.Mesh(new THREE.PlaneGeometry(3.5,17),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(beamCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));beam.rotation.x=-Math.PI/2;beam.position.set(x,.035,10);this.headlights.add(beam);}
    this.body.add(this.headlights);
    // Soft contact patch complements the moving directional shadow.
    const cv=document.createElement('canvas');cv.width=cv.height=64;const ctx=cv.getContext('2d')!,gr=ctx.createRadialGradient(32,32,4,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.48)');gr.addColorStop(.6,'rgba(0,0,0,.3)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false,opacity:.6}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;this.root.add(shadow);
    progress(1);
  }
  update(p:VehiclePhysics,braking:boolean,time:number){
    this.root.position.set(p.x,p.y+.045,p.z);this.root.rotation.y=p.heading;
    const road=p.route.nearest(p.x,p.z),grade=road.grade*Math.cos(p.heading-road.heading);
    this.body.rotation.x=-Math.atan(grade)+p.pitch;this.body.rotation.z=p.roll;
    this.body.position.y=Math.sin(time*27)*Math.min(.009,Math.abs(p.speed)*.0002)+p.impact*.024;
    this.brakeMaterial.emissiveIntensity=braking?5:.6;this.headlights.visible=p.tunnel;
  }
}
