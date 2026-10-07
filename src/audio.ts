import { VehiclePhysics, Controls } from './physics';
export class Soundscape {
  context?:AudioContext; master?:GainNode; engineGain?:GainNode; engineFilter?:BiquadFilterNode;
  oscillators:OscillatorNode[]=[]; tire?:GainNode; wind?:GainNode; road?:GainNode; reverb?:GainNode; volume=.65;
  async init(){
    if(this.context){await this.context.resume();return;}
    const c=new AudioContext();this.context=c;this.master=c.createGain();this.master.gain.value=this.volume*.45;this.master.connect(c.destination);
    const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=5;compressor.connect(this.master);
    this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engineFilter=c.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=500;this.engineGain.connect(this.engineFilter);this.engineFilter.connect(compressor);
    for(let i=0;i<4;i++){const o=c.createOscillator(),g=c.createGain();o.type=i===0?'sawtooth':'triangle';o.frequency.value=45*(i+1);g.gain.value=[.35,.3,.14,.06][i];o.connect(g);g.connect(this.engineGain);o.start();this.oscillators.push(o);}
    const len=c.sampleRate*4,buffer=c.createBuffer(1,len,c.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<len;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*8;}
    const noise=(type:BiquadFilterType,freq:number)=>{const s=c.createBufferSource();s.buffer=buffer;s.loop=true;const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=c.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(compressor);s.start();return g;};
    this.tire=noise('bandpass',1800);this.wind=noise('lowpass',750);this.road=noise('bandpass',240);
    const delay=c.createDelay(.5);delay.delayTime.value=.12;this.reverb=c.createGain();this.reverb.gain.value=0;this.engineFilter.connect(delay);delay.connect(this.reverb);this.reverb.connect(compressor);
    const feedback=c.createGain();feedback.gain.value=.32;delay.connect(feedback);feedback.connect(delay);
    await c.resume();
  }
  update(p:VehiclePhysics,input:Controls,active:boolean){
    if(!this.context||!this.master)return;const t=this.context.currentTime;
    this.master.gain.setTargetAtTime(active?this.volume*.45:0,t,.2);
    const freq=p.rpm/60*3;
    this.oscillators.forEach((o,i)=>o.frequency.setTargetAtTime(freq*(i+1)*.5+(i%2?.6:0),t,.04));
    this.engineGain!.gain.setTargetAtTime(.13+input.throttle*.2+Math.abs(p.speed)*.001,t,.06);
    this.engineFilter!.frequency.setTargetAtTime(280+p.rpm*.22+input.throttle*650,t,.07);
    this.tire!.gain.setTargetAtTime((p.slip*.36+input.brake*.035)*Math.min(Math.abs(p.speed)/12,1),t,.08);
    this.wind!.gain.setTargetAtTime(Math.min(.3,.012+(p.speed/80)**2*.4),t,.2);
    this.road!.gain.setTargetAtTime(Math.min(.19,Math.abs(p.speed)*.003)+(p.offroad?.12:0)+p.impact*.2,t,.05);
    this.reverb!.gain.setTargetAtTime(p.tunnel?.65:0,t,.4);
  }
  click(){if(!this.context||!this.master)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(680,c.currentTime);o.frequency.exponentialRampToValueAtTime(420,c.currentTime+.08);g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.09);o.connect(g);g.connect(this.master);o.start();o.stop(c.currentTime+.1);}
}
