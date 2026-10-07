import * as THREE from 'three';
import { Route } from './route';
import { groundTexture, pineTexture } from './textures';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export type Weather = 'Sunset'|'Clear'|'Overcast';
const rand=(seed:number)=>{let s=seed;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
function noiseTexture(kind:'asphalt'|'stone') {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!,img=ctx.createImageData(256,256),r=rand(38);
  for(let i=0;i<img.data.length;i+=4){const v=(kind==='asphalt'?100:145)+r()*45;img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=255;}
  ctx.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='asphalt'?2:1,kind==='asphalt'?200:1);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export class World {
  group=new THREE.Group(); sun:THREE.DirectionalLight; hemisphere:THREE.HemisphereLight; sky:THREE.Mesh; roadMaterial:THREE.MeshStandardMaterial;
  windTime={value:0};
  checkpoints=new THREE.Group(); checkpointObjects:THREE.Group[]=[]; weather:Weather='Sunset'; grass:THREE.InstancedMesh|undefined;
  constructor(public scene:THREE.Scene,public route:Route) {
    scene.add(this.group);scene.fog=new THREE.FogExp2('#bac0ab',.00075);
    this.hemisphere=new THREE.HemisphereLight('#d4e5ed','#69684b',1.7);scene.add(this.hemisphere);
    this.sun=new THREE.DirectionalLight('#ffe0a1',2.8);this.sun.position.set(-130,180,-220);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-42;this.sun.shadow.camera.right=42;this.sun.shadow.camera.top=42;this.sun.shadow.camera.bottom=-42;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=650;this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00015;scene.add(this.sun,this.sun.target);
    const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#5e828c')},horizon:{value:new THREE.Color('#ecc698')},sun:{value:new THREE.Vector3(-.65,.115,.76).normalize()}},vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vPosition;uniform vec3 top;uniform vec3 horizon;uniform vec3 sun;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    void main(){vec3 d=normalize(vPosition);float h=max(d.y,0.);vec3 c=mix(horizon,top,pow(h,.48));float s=max(dot(d,sun),0.);c+=vec3(1.,.61,.26)*pow(s,32.)*.3;c+=vec3(1.,.87,.62)*smoothstep(.99996,.99998,s)*2.;vec2 uv=d.xz/max(.15,d.y+.12)*2.;float cloud=noise(uv)*.55+noise(uv*2.1)*.3+noise(uv*4.2)*.15;c=mix(c,vec3(.65,.62,.53),smoothstep(.53,.78,cloud)*.32*smoothstep(.05,.2,d.y));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(6000,32,24),skyMaterial);scene.add(this.sky);
    this.roadMaterial=new THREE.MeshStandardMaterial({color:'#555958',roughness:.94,map:noiseTexture('asphalt'),bumpScale:.012});this.roadMaterial.bumpMap=this.roadMaterial.map;
    this.terrain();this.road();this.mountains();this.vegetation();this.structures();this.details();scene.add(this.checkpoints);
  }
  private strip(left:number,right:number,material:THREE.Material,y=.03,start=0,end=1) {
    const pos:number[]=[],uv:number[]=[],idx:number[]=[];
    const a=Math.floor(start*this.route.count),b=Math.floor(end*this.route.count);
    for(let i=a;i<=b;i++){const k=i%this.route.count,p=this.route.points[k],n=this.route.normals[k];for(const w of [left,right]){pos.push(p.x+n.x*w,p.y+y,p.z+n.z*w);uv.push(w===left?0:1,i/this.route.count);}if(i>a){const j=(i-a)*2;idx.push(j-2,j-1,j,j-1,j+1,j);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;this.group.add(mesh);return mesh;
  }
  private road(){
    this.strip(-7.7,7.7,new THREE.MeshStandardMaterial({color:'#646954',roughness:1,map:noiseTexture('stone')}),-.03);
    this.strip(-5.8,5.8,this.roadMaterial,0);
    const white=new THREE.MeshStandardMaterial({color:'#dedcc2',roughness:.88});
    this.strip(-5.45,-5.32,white,.025);this.strip(5.32,5.45,white,.025);
    const yellow=new THREE.MeshStandardMaterial({color:'#d8c590',roughness:.85});
    const dashGeometry:THREE.BufferGeometry[]=[];for(let i=0;i<170;i++){const mesh=this.strip(-.055,.055,yellow,.03,i/170,(i+.48)/170);dashGeometry.push(mesh.geometry);this.group.remove(mesh);}
    const dashed=new THREE.Mesh(mergeGeometries(dashGeometry),yellow);dashed.receiveShadow=true;this.group.add(dashed);dashGeometry.forEach(g=>g.dispose());
  }
  private terrain(){
    const size=1850,div=200,g=new THREE.PlaneGeometry(size,size,div,div);g.rotateX(-Math.PI/2);g.translate(90,0,10);
    const p=g.attributes.position,colors:number[]=[],r=rand(16),low=new THREE.Color('#545d3c'),high=new THREE.Color('#8e8c67');
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=this.route.terrain(x,z);p.setY(i,y);const c=low.clone().lerp(high,THREE.MathUtils.clamp(y/180+r()*.3,0,1));colors.push(c.r,c.g,c.b);}
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:groundTexture()}));m.receiveShadow=true;this.group.add(m);
  }
  private mountains(){
    const positions:number[]=[],colors:number[]=[],indices:number[]=[],segments=192,rings=30;
    const stone=new THREE.Color('#737e77'),snow=new THREE.Color('#dadbd0');
    for(let i=0;i<=rings;i++)for(let j=0;j<=segments;j++){
      const a=j/segments*Math.PI*2,radius=830+i/rings*3800;
      const ridge=(.62+.23*Math.sin(a*5+.6)+.2*Math.sin(a*11)+.15*Math.sin(a*23)+.08*Math.cos(a*47));
      const height=-28+Math.sin(Math.min(1,i/16)*Math.PI*.5)*(140+ridge*360)*( .78+.22*Math.sin(radius*.0035+a*4))
        +Math.sin(a*37+radius*.014)*Math.sin(i/rings*Math.PI)*37;
      positions.push(Math.sin(a)*radius,height,Math.cos(a)*radius);
      const c=stone.clone().lerp(snow,THREE.MathUtils.smoothstep(height+Math.sin(a*43)*50,660,845));c.multiplyScalar(.83+.12*Math.sin(i*1.8+a*23));colors.push(c.r,c.g,c.b);
      if(i>0&&j>0){const d=i*(segments+1)+j,b=d-segments-1;indices.push(b-1,d-1,b,b,d-1,d);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const mountains=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));this.group.add(mountains);
  }
  private vegetation(){
    const r=rand(51),dummy=new THREE.Object3D(),count=1450;
    const pine=pineTexture(),material=new THREE.MeshStandardMaterial({map:pine,roughness:1,alphaTest:.4,side:THREE.DoubleSide,color:'#b3be9b'});
    material.onBeforeCompile=shader=>{shader.uniforms.windTime=this.windTime;shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(windTime * 0.7 + instanceMatrix[3].x * 0.11) * position.y * 0.013;');};
    const treeGeometry=new THREE.PlaneGeometry(1,1);treeGeometry.translate(0,.5,0);
    const buckets=new Map<string,{x:number;y:number;z:number;height:number;angle:number;near:boolean}[]>();
    let i=0;
    while(i<count){const x=-580+r()*1280,z=-670+r()*1270,n=this.route.nearest(x,z);if(n.distance<14||n.t>.174&&n.t<.224&&n.distance<35)continue;
      const key=Math.floor(x/120)+','+Math.floor(z/120),trees=buckets.get(key)||[];
      trees.push({x,y:this.route.terrain(x,z),z,height:8+r()*15,angle:r()*Math.PI,near:n.distance<60});buckets.set(key,trees);i++;
    }
    for(const trees of buckets.values()){
      const mesh=new THREE.InstancedMesh(treeGeometry,material,trees.length*2);
      trees.forEach((tree,j)=>{for(let cross=0;cross<2;cross++){dummy.position.set(tree.x,tree.y,tree.z);dummy.rotation.set(0,tree.angle+cross*Math.PI/2,0);dummy.scale.set(tree.height*.52,tree.height,1);dummy.updateMatrix();mesh.setMatrixAt(j*2+cross,dummy.matrix);mesh.setColorAt(j*2+cross,new THREE.Color().setHSL(.12,.08,.78+r()*.2));}});
      mesh.castShadow=trees.some(t=>t.near);mesh.receiveShadow=true;mesh.computeBoundingSphere();this.group.add(mesh);
    }
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#70766a',roughness:1,flatShading:true,map:noiseTexture('stone')}),450);
    for(let j=0;j<450;j++){const t=r(),p=this.route.at(t),n=this.route.tangent(t),d=(10+r()*55)*(r()>.5?1:-1),x=p.x-n.z*d,z=p.z+n.x*d;dummy.position.set(x,this.route.terrain(x,z),z);dummy.rotation.set(r(),r()*6,r());dummy.scale.set(1+r()*5,1+r()*4,1+r()*4);dummy.updateMatrix();rocks.setMatrixAt(j,dummy.matrix);}
    rocks.castShadow=true;rocks.receiveShadow=true;this.group.add(rocks);
    const grassGeo=new THREE.BufferGeometry(),gp:number[]=[],gi:number[]=[];
    for(let blade=0;blade<5;blade++){const a=blade/5*Math.PI*2,x=Math.cos(a)*.19,z=Math.sin(a)*.19,h=.3+r()*.45,k=gp.length/3;gp.push(x-.026,0,z,x+.026,0,z,x+Math.sin(a)*.15,h,z+Math.cos(a)*.12);gi.push(k,k+1,k+2);}
    grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));grassGeo.setIndex(gi);grassGeo.computeVertexNormals();
    const grass=new THREE.InstancedMesh(grassGeo,new THREE.MeshStandardMaterial({color:'#6f7950',roughness:1,side:THREE.DoubleSide}),2600);
    for(let j=0;j<2600;j++){const t=r(),p=this.route.at(t),n=this.route.tangent(t),d=(8+r()*14)*(r()>.5?1:-1),x=p.x-n.z*d,z=p.z+n.x*d;dummy.position.set(x,this.route.terrain(x,z),z);dummy.rotation.set(0,r()*6,0);dummy.scale.setScalar(.5+r());dummy.updateMatrix();grass.setMatrixAt(j,dummy.matrix);}
    this.grass=grass;this.group.add(grass);
  }
  private structures(){
    const concrete=new THREE.MeshStandardMaterial({color:'#9a9989',roughness:.96}),metal=new THREE.MeshStandardMaterial({color:'#969e99',metalness:.65,roughness:.5});
    const postCount=440,posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.85,.15),metal,postCount*2),dummy=new THREE.Object3D();
    for(let i=0;i<postCount;i++)for(let side=0;side<2;side++){const t=i/postCount,p=this.route.at(t),tan=this.route.tangent(t),offset=(side?1:-1)*7.1;dummy.position.set(p.x-tan.z*offset,p.y+.43,p.z+tan.x*offset);dummy.rotation.set(0,Math.atan2(tan.x,tan.z),0);dummy.updateMatrix();posts.setMatrixAt(i*2+side,dummy.matrix);}
    posts.castShadow=true;this.group.add(posts);
    for(const side of [-1,1]){const path=this.route.points.map((p,i)=>new THREE.Vector3(p.x+this.route.normals[i].x*7.12*side,p.y+.76,p.z+this.route.normals[i].z*7.12*side));path.push(path[0]);const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),1000,.09,4,false);const rail=new THREE.Mesh(g,metal);rail.castShadow=true;this.group.add(rail);}
    // A viaduct over the valley: the road deck stays continuous with the route surface.
    this.strip(-6.2,6.2,concrete,-.32,.172,.226);
    for(let i=0;i<8;i++){const p=this.route.at(.177+i*.006);const pillar=new THREE.Mesh(new THREE.BoxGeometry(3,50,4),concrete);pillar.position.set(p.x,p.y-25.5,p.z);pillar.castShadow=true;this.group.add(pillar);}
    // Open-ended, curved tunnel shell; inner normals allow realistic occlusion from inside.
    const pos:number[]=[],idx:number[]=[],steps=60,arc=20;
    for(let i=0;i<=steps;i++){const t=.425+.05*i/steps,p=this.route.at(t),tan=this.route.tangent(t);for(let j=0;j<=arc;j++){const a=j/arc*Math.PI,w=Math.cos(a)*8;pos.push(p.x-tan.z*w,p.y+Math.sin(a)*8.5,p.z+tan.x*w);}if(i>0)for(let j=0;j<arc;j++){const a=(i-1)*(arc+1)+j,b=i*(arc+1)+j;idx.push(a,b,a+1,b,b+1,a+1);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const tunnel=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#676c61',roughness:1,side:THREE.DoubleSide}));tunnel.castShadow=tunnel.receiveShadow=true;this.group.add(tunnel);
    for(let i=0;i<10;i++){const p=this.route.at(.428+i*.0047);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.3,.08,1.8),new THREE.MeshBasicMaterial({color:'#ffdea0'}));lamp.position.copy(p);lamp.position.y+=8;this.group.add(lamp);}
  }
  private sign(text:string,sub:string,t:number){
    const p=this.route.at(t),tan=this.route.tangent(t),canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#243b32';c.fillRect(0,0,512,256);c.strokeStyle='#dde2cf';c.lineWidth=6;c.strokeRect(10,10,492,236);c.fillStyle='#edf0e3';c.textAlign='center';c.font='500 43px Arial';c.fillText(text,256,108);c.font='26px Arial';c.fillText(sub,256,173);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const board=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.7,.1),[new THREE.MeshStandardMaterial({color:'#485548'}),new THREE.MeshStandardMaterial({color:'#485548'}),new THREE.MeshStandardMaterial({color:'#485548'}),new THREE.MeshStandardMaterial({color:'#485548'}),new THREE.MeshStandardMaterial({map:tex}),new THREE.MeshStandardMaterial({color:'#485548'})]);board.position.set(p.x-tan.z*9,p.y+3.2,p.z+tan.x*9);board.rotation.y=Math.atan2(-tan.x,-tan.z);this.group.add(board);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,3.4,6),new THREE.MeshStandardMaterial({color:'#9b9d91',metalness:.7,roughness:.5}));pole.position.copy(board.position);pole.position.y=p.y+1.6;this.group.add(pole);
  }
  private details(){
    this.sign('COL DE LUMIÈRE','SUMMIT  ·  1 842 m',.025);this.sign('BELVÉDÈRE','PANORAMA  ↗',.15);this.sign('GALERIE DES PINS','LIGHTS ON',.408);this.sign('LACET DU SOMMET','SLOW  ·  40',.33);this.sign('VALLÉE DU SOLEIL','ENJOY THE DRIVE',.68);
    // Roadside reflector bollards, paired along the complete loop.
    const d=new THREE.Object3D(),mat=new THREE.MeshStandardMaterial({color:'#d8d6bc',roughness:.8}),reflect=new THREE.MeshStandardMaterial({color:'#ffb16d',emissive:'#ed9a48',emissiveIntensity:.25});
    const base=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,.64,.14),mat,220),tops=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.16,.16),reflect,220);
    for(let i=0;i<110;i++)for(let s=0;s<2;s++){const p=this.route.at(i/110),t=this.route.tangent(i/110),side=s?1:-1;d.position.set(p.x-t.z*6.4*side,p.y+.34,p.z+t.x*6.4*side);d.rotation.y=Math.atan2(t.x,t.z);d.updateMatrix();base.setMatrixAt(i*2+s,d.matrix);d.position.y+=.22;d.updateMatrix();tops.setMatrixAt(i*2+s,d.matrix);}this.group.add(base,tops);
  }
  setCheckpoints(ts:number[]) {
    for(const c of this.checkpointObjects){c.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.checkpoints.remove(c);}this.checkpointObjects=[];
    ts.forEach((t,i)=>{const group=new THREE.Group(),p=this.route.at(t),tan=this.route.tangent(t);group.position.copy(p);group.rotation.y=Math.atan2(tan.x,tan.z);
      const material=new THREE.MeshBasicMaterial({color:'#c8e6b5',transparent:true,opacity:.7,side:THREE.DoubleSide});
      for(const x of [-5.5,5.5]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,4.4,6),material.clone());pole.position.set(x,2.2,0);group.add(pole);const flag=new THREE.Mesh(new THREE.PlaneGeometry(.75,2),material.clone());flag.position.set(x,3.2,0);group.add(flag);}
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(10,.035,.5),material.clone());stripe.position.y=.055;group.add(stripe);group.visible=i===0;this.checkpoints.add(group);this.checkpointObjects.push(group);
    });
  }
  setWeather(w:Weather){
    this.weather=w;const sky=this.sky.material as THREE.ShaderMaterial;
    if(w==='Sunset'){this.sun.color.set('#ffe0a1');this.sun.intensity=2.8;this.hemisphere.intensity=1.7;sky.uniforms.top.value.set('#5e828c');sky.uniforms.horizon.value.set('#ecc698');(this.scene.fog as THREE.FogExp2).color.set('#bac0ab');}
    if(w==='Clear'){this.sun.color.set('#fff4df');this.sun.intensity=3.4;this.hemisphere.intensity=2.8;sky.uniforms.top.value.set('#518fac');sky.uniforms.horizon.value.set('#d2dee0');(this.scene.fog as THREE.FogExp2).color.set('#bdced0');}
    if(w==='Overcast'){this.sun.color.set('#dce5ef');this.sun.intensity=.65;this.hemisphere.intensity=2.8;sky.uniforms.top.value.set('#85979e');sky.uniforms.horizon.value.set('#c4cac7');(this.scene.fog as THREE.FogExp2).color.set('#bac5c7');}
  }
  update(position:THREE.Vector3,time:number){this.windTime.value=time;this.sun.position.copy(position).add(new THREE.Vector3(-180,this.weather==='Clear'?300:130,240));this.sun.target.position.copy(position);this.sky.position.copy(position);if(this.grass)this.grass.rotation.z=Math.sin(time*.7)*.00015;}
}
