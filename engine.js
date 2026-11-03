export const SIZE=96;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function orientation(beta,gamma,angle,zero){
 const b=(beta-zero.beta+540)%360-180,g=(gamma-zero.gamma+540)%360-180;
 const r=angle*Math.PI/180;
 return {x:clamp((g*Math.cos(r)+b*Math.sin(r))/18,-1,1),y:clamp((b*Math.cos(r)-g*Math.sin(r))/18,-1,1)};
}
export class Game{
 constructor(mode='race'){this.mode=mode;this.maps=[new Uint8Array(SIZE*SIZE),new Uint8Array(SIZE*SIZE)];this.balls=[24,72].map(x=>({x,y:48,vx:0,vy:0,fallRemaining:0,falls:0}));this.tick=0;}
 step(inputs,dt){
  this.tick++;
  this.balls.forEach((b,i)=>{
   if(inputs[i].active===false){b.vx=0;b.vy=0;return;}
   if(b.fallRemaining>0){
    b.fallRemaining=Math.max(0,b.fallRemaining-dt);
    if(b.fallRemaining<1e-9){b.fallRemaining=0;b.x=i===0?24:72;b.y=48;b.vx=0;b.vy=0;}
    return;
   }
   b.vx=(b.vx+inputs[i].x*95*dt)*Math.exp(-2.8*dt);
   b.vy=(b.vy+inputs[i].y*95*dt)*Math.exp(-2.8*dt);
   b.x+=b.vx*dt;b.y+=b.vy*dt;
   // The centre crossing the edible square's edge counts as a fall.
   if(b.x<=0||b.x>=SIZE||b.y<=0||b.y>=SIZE){b.fallRemaining=3;b.falls=(b.falls||0)+1;b.vx=0;b.vy=0;}
  });
  // Alternate overlap ownership each simulation tick to avoid a fixed team advantage.
  const order=this.tick%2?[0,1]:[1,0];
  for(const i of order){if(inputs[i].active===false)continue;const b=this.balls[i];if(b.fallRemaining>0)continue;const map=this.maps[this.mode==='race'?i:0];for(let y=Math.max(0,Math.floor(b.y-4));y<Math.min(SIZE,Math.ceil(b.y+4));y++)for(let x=Math.max(0,Math.floor(b.x-4));x<Math.min(SIZE,Math.ceil(b.x+4));x++)if((x+.5-b.x)**2+(y+.5-b.y)**2<=16)map[y*SIZE+x]=i+1;}
 }
 scores(){return [0,1].map(i=>{const m=this.maps[this.mode==='race'?i:0];return m.reduce((n,v)=>n+(v===i+1),0)/m.length*100;});}
}
