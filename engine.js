export const SIZE=96;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function orientation(beta,gamma,angle,zero){
 const b=(beta-zero.beta+540)%360-180,g=(gamma-zero.gamma+540)%360-180;
 const r=angle*Math.PI/180;
 return {x:clamp((g*Math.cos(r)+b*Math.sin(r))/18,-1,1),y:clamp((b*Math.cos(r)-g*Math.sin(r))/18,-1,1)};
}
export class Game{
 constructor(mode='race'){this.mode=mode;this.maps=[new Uint8Array(SIZE*SIZE),new Uint8Array(SIZE*SIZE)];this.balls=[{x:24,y:48,vx:0,vy:0},{x:72,y:48,vx:0,vy:0}];this.tick=0;}
 step(inputs,dt){
  this.tick++;
  this.balls.forEach((b,i)=>{if(inputs[i].active===false){b.vx=0;b.vy=0;return;}b.vx=(b.vx+inputs[i].x*95*dt)*Math.exp(-2.8*dt);b.vy=(b.vy+inputs[i].y*95*dt)*Math.exp(-2.8*dt);b.x=clamp(b.x+b.vx*dt,4,SIZE-4);b.y=clamp(b.y+b.vy*dt,4,SIZE-4);if(b.x===4||b.x===SIZE-4)b.vx=0;if(b.y===4||b.y===SIZE-4)b.vy=0;});
  // Alternate overlap ownership each simulation tick to avoid a fixed team advantage.
  const order=this.tick%2?[0,1]:[1,0];
  for(const i of order){if(inputs[i].active===false)continue;const b=this.balls[i],map=this.maps[this.mode==='race'?i:0];for(let y=Math.max(0,Math.floor(b.y-4));y<Math.min(SIZE,Math.ceil(b.y+4));y++)for(let x=Math.max(0,Math.floor(b.x-4));x<Math.min(SIZE,Math.ceil(b.x+4));x++)if((x+.5-b.x)**2+(y+.5-b.y)**2<=16)map[y*SIZE+x]=i+1;}
 }
 scores(){return [0,1].map(i=>{const m=this.maps[this.mode==='race'?i:0];return m.reduce((n,v)=>n+(v===i+1),0)/m.length*100;});}
}
