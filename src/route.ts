import * as THREE from 'three';

export const ROAD_WIDTH = 11.6;
export const ROUTE_POINTS = [
  [0,48,0], [0,52,-150], [24,66,-300], [132,88,-395],
  [305,108,-382], [430,124,-296], [447,142,-180],
  [354,155,-118], [300,168,-37], [403,181,33],
  [455,188,135], [362,179,215], [245,155,205],
  [166,128,295], [55,98,360], [-90,73,330],
  [-221,58,210], [-245,49,90], [-198,49,-12],
  [-128,49,12], [-84,48,105], [-28,48,133],
];
export class Route {
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
  length: number;
  count = 1000;
  constructor() {
    this.curve = new THREE.CatmullRomCurve3(ROUTE_POINTS.map(p => new THREE.Vector3(...p)), true, 'centripetal');
    this.curve.arcLengthDivisions = 4000;
    this.length = this.curve.getLength();
    this.points = Array.from({length:this.count},(_,i)=>this.curve.getPointAt(i/this.count));
    this.tangents = Array.from({length:this.count},(_,i)=>this.curve.getTangentAt(i/this.count));
    this.normals = this.tangents.map(t=>new THREE.Vector3(-t.z,0,t.x).normalize());
  }
  at(t:number) { return this.curve.getPointAt(((t%1)+1)%1); }
  tangent(t:number) { return this.curve.getTangentAt(((t%1)+1)%1); }
  nearest(x:number,z:number) {
    let best=Infinity,index=0;
    for(let i=0;i<this.count;i++) {
      const p=this.points[i], d=(p.x-x)**2+(p.z-z)**2;
      if(d<best){best=d;index=i;}
    }
    let result={index,t:index/this.count,distance:Math.sqrt(best),offset:0,height:this.points[index].y,grade:0,heading:0};
    let segBest=Infinity;
    for(const a of [(index+this.count-1)%this.count,index]){
      const b=(a+1)%this.count,p=this.points[a],q=this.points[b];
      const dx=q.x-p.x,dz=q.z-p.z,l2=dx*dx+dz*dz;
      const u=THREE.MathUtils.clamp(((x-p.x)*dx+(z-p.z)*dz)/l2,0,1);
      const ex=x-p.x-u*dx,ez=z-p.z-u*dz, dist=ex*ex+ez*ez;
      if(dist<segBest){segBest=dist;const l=Math.sqrt(l2);result={index:a,t:(a+u)/this.count,distance:Math.sqrt(dist),offset:(ex*-dz+ez*dx)/l,height:p.y+(q.y-p.y)*u,grade:(q.y-p.y)/l,heading:Math.atan2(dx,dz)};}
    }
    return result;
  }
  terrain(x:number,z:number) {
    const n=this.nearest(x,z);
    const natural=24+Math.sin(x*.008+1)*26+Math.cos(z*.009)*19+Math.sin(x*.017+z*.006)*12+Math.sin(z*.028+x*.024)*4;
    const bridge=n.t>.174&&n.t<.224;
    const influence=1-THREE.MathUtils.smoothstep(n.distance,7,bridge?22:100);
    const roadHeight=bridge?n.height-36:n.height-1.1;
    return THREE.MathUtils.lerp(natural,roadHeight,influence);
  }
}
export const formatTime=(s:number)=>{const ticks=Math.max(0,Math.round(s*100));return `${Math.floor(ticks/6000).toString().padStart(2,'0')}:${(Math.floor(ticks/100)%60).toString().padStart(2,'0')}.${(ticks%100).toString().padStart(2,'0')}`;};
