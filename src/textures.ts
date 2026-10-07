import * as THREE from 'three';
export function seeded(seed:number){let s=seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
export function groundTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!,r=seeded(932),image=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,grain=r()*42,patch=Math.sin(x*.025)*Math.sin(y*.03)*12;image.data[i]=115+grain+patch;image.data[i+1]=118+grain+patch;image.data[i+2]=95+grain+patch;image.data[i+3]=255;}
 ctx.putImageData(image,0,0);for(let i=0;i<4500;i++){const x=r()*512,y=r()*512;ctx.strokeStyle=r()>.5?'#414b3430':'#d2c9a626';ctx.lineWidth=.5+r();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+r()*5-2.5,y+r()*8);ctx.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(92,92);t.anisotropy=8;return t;
}
export function pineTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d')!,r=seeded(104);ctx.clearRect(0,0,512,1024);
 // Needles and drooping branch fans, rather than opaque cone geometry.
 ctx.lineCap='round';ctx.strokeStyle='#655c43';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(254,1024);ctx.lineTo(257,55);ctx.stroke();
 for(let tier=0;tier<48;tier++){
  const y=65+tier*17.5,spread=14+tier*4.5;
  for(let side of [-1,1]){
   const endX=256+side*spread*(.6+r()*.5),endY=y+20+r()*28;
   ctx.strokeStyle='#4b5140';ctx.lineWidth=1.5+tier*.08;ctx.beginPath();ctx.moveTo(256,y-8);ctx.lineTo(endX,endY);ctx.stroke();
   for(let j=0;j<70;j++){
    const u=r(),x=256+(endX-256)*u+(r()-.5)*24,py=y+(endY-y)*u+(r()-.4)*28,light=r();
    ctx.strokeStyle=light<.2?'#263c32':light<.55?'#3c5240':light<.83?'#4b6146':'#697955';ctx.lineWidth=1.3+r()*2.2;
    ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x+side*(4+r()*13),py-6-r()*15);ctx.stroke();
    if(j%4===0){ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x-side*9,py-13);ctx.stroke();}
   }
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
