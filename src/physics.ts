import { Route } from './route';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const approach=(v:number,target:number,rate:number,dt:number)=>v+(target-v)*(1-Math.exp(-rate*dt));
export interface Controls { throttle:number; brake:number; steer:number; handbrake:boolean; }
export class VehiclePhysics {
  x=0; z=0; y=0; heading=Math.PI; speed=0; lateral=0; yawRate=0;
  steer=0; rpm=850; gear=1; slip=0; pitch=0; roll=0; acceleration=0;
  distance=0; topSpeed=0; impact=0; offroad=false; roadT=0; tunnel=false;
  private shiftCooldown=0;
  constructor(public route:Route){this.reset(0);}
  reset(t=this.roadT) {
    const p=this.route.at(t),d=this.route.tangent(t);
    this.x=p.x;this.z=p.z;this.y=p.y;this.heading=Math.atan2(d.x,d.z);
    this.speed=0;this.lateral=0;this.yawRate=0;this.steer=0;this.pitch=0;this.roll=0;this.rpm=850;this.gear=1;this.roadT=t;this.impact=0;this.slip=0;this.offroad=false;this.acceleration=0;this.shiftCooldown=0;this.tunnel=t>.425&&t<.475;
  }
  update(dt:number,c:Controls,grip=1) {
    const road=this.route.nearest(this.x,this.z);
    this.roadT=road.t;this.offroad=road.distance>5.15;this.tunnel=road.t>.425&&road.t<.475;
    this.impact=Math.max(0,this.impact-dt*3);
    const abs=Math.abs(this.speed), previous=this.speed;
    // Steering attenuates with speed. Tire relaxation makes turn-in progressive, not instantaneous.
    const maxAngle=.52/(1+abs*.044);
    this.steer=approach(this.steer,-c.steer*maxAngle,7.5,dt);
    const ratios=[0,3.91,2.29,1.58,1.18,.94,.79,.62];
    this.shiftCooldown=Math.max(0,this.shiftCooldown-dt);
    const wheelRPM=abs/2.08*60;
    let targetRPM=Math.max(850,wheelRPM*ratios[Math.max(1,this.gear)]*3.44);
    if(this.shiftCooldown===0&&this.speed>=0){
      if(targetRPM>7200&&this.gear<7){this.gear++;this.shiftCooldown=.26;}
      else if(targetRPM<2600&&this.gear>1){this.gear--;this.shiftCooldown=.22;}
    }
    if(this.speed<-.3)this.gear=-1;else if(this.gear<1)this.gear=1;
    this.rpm=approach(this.rpm,clamp(targetRPM+c.throttle*340,850,7900),13,dt);
    const torqueCurve=.82+.18*Math.sin(clamp((this.rpm-1200)/6500,0,1)*Math.PI);
    let drive=c.throttle*(this.speed<-.4?13:10.8/(1+abs*.019))*torqueCurve;
    if(this.shiftCooldown>.12)drive*=.28;
    if(c.brake>0){
      if(this.speed>.45)drive-=c.brake*15.8;
      else if(c.throttle===0)drive=-c.brake*4.0*(1-clamp(-this.speed/12,0,1));
    }
    let drag=.00115*this.speed*abs+.16*Math.sign(this.speed)+(1-c.throttle)*.018*this.speed;
    if(this.offroad)drag+=this.speed*.65;
    if(c.handbrake&&abs>.3)drag+=Math.sign(this.speed)*7.5;
    const alignedGrade=road.grade*Math.cos(this.heading-road.heading);
    this.speed+=(drive-drag-alignedGrade*9.81)*dt;
    if(c.throttle===0&&c.brake===0&&abs<.12)this.speed=0;
    if(c.brake>0&&previous>.45&&this.speed<0)this.speed=0;
    this.speed=clamp(this.speed,-12,86);
    this.acceleration=(this.speed-previous)/dt;
    // Friction-limited bicycle model. Understeer at high lateral demand; rear slip under handbrake.
    const desiredYaw=this.speed/2.65*Math.tan(this.steer);
    const lateralDemand=Math.abs(desiredYaw*this.speed);
    const availableGrip=10.8*grip*(this.offroad?.48:1)*(1-Math.min(.18,Math.abs(this.acceleration)*.009));
    const saturation=Math.min(1,availableGrip/Math.max(.1,lateralDemand));
    let yaw=desiredYaw*saturation;
    if(c.handbrake)yaw*=1.55;
    this.yawRate=approach(this.yawRate,yaw,c.handbrake?3.5:7,dt);
    const rearSlip=c.handbrake ? -this.yawRate*this.speed*.28 : -this.yawRate*this.speed*.035;
    this.lateral=approach(this.lateral,rearSlip,c.handbrake?2.4:6.8*grip,dt);
    this.heading+=this.yawRate*dt;
    this.x+=(Math.sin(this.heading)*this.speed+Math.cos(this.heading)*this.lateral)*dt;
    this.z+=(Math.cos(this.heading)*this.speed-Math.sin(this.heading)*this.lateral)*dt;
    const next=this.route.nearest(this.x,this.z);
    // Continuous guardrail collision avoids tunnelling at high speed.
    const relativeHeading=this.heading-next.heading;
    const clearance=7.1-(Math.abs(Math.sin(relativeHeading))*2.26+Math.abs(Math.cos(relativeHeading))*.99)-.04;
    if(next.distance>clearance){
      const p=this.route.at(next.t),t=this.route.tangent(next.t),nx=-t.z,nz=t.x,side=Math.sign(next.offset);
      this.x=p.x+nx*(clearance-.035)*side;this.z=p.z+nz*(clearance-.035)*side;
      const hit=Math.abs(this.speed*Math.sin(this.heading-next.heading));
      this.speed*=Math.max(.3,1-hit*.035);this.lateral=0;
      let delta=next.heading-this.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
      this.heading+=delta*Math.min(1,dt*6);this.impact=Math.min(1,hit/14);
    }
    this.y=next.height;
    this.pitch=approach(this.pitch,clamp(-this.acceleration*.004,-.055,.045),6,dt);
    this.roll=approach(this.roll,clamp(this.yawRate*this.speed*.007,-.075,.075),6,dt);
    this.slip=approach(this.slip,clamp((lateralDemand-availableGrip*.77)/10+Math.abs(this.lateral)*.1,0,1),8,dt);
    this.distance+=Math.abs(this.speed)*dt;this.topSpeed=Math.max(this.topSpeed,this.speed*3.6);
  }
}
