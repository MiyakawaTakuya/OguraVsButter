import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,orientation} from '../engine.js';
test('水平設定と画面回転・入力制限',()=>{
 assert.deepEqual(orientation(10,5,0,{beta:10,gamma:5}),{x:0,y:0});
 assert.equal(orientation(0,18,0,{beta:0,gamma:0}).x,1);
 assert.equal(orientation(18,0,90,{beta:0,gamma:0}).x,1);
 assert.equal(orientation(0,80,0,{beta:0,gamma:0}).x,1);
});
test('別々のパンの面積を独立して集計する',()=>{
 const g=new Game('race');g.maps[0].fill(1);g.maps[1].fill(2,0,SIZE*SIZE/2);
 assert.deepEqual(g.scores(),[100,50]);
});
test('陣取りは上塗り後の所有者を数え、合計100%を超えない',()=>{
 const g=new Game('territory');g.maps[0].fill(1);g.maps[0].fill(2,0,SIZE*SIZE/4);
 assert.deepEqual(g.scores(),[75,25]);
 g.balls[1]={x:50,y:50,vx:0,vy:0};g.balls[0]={x:10,y:10,vx:0,vy:0};
 g.step([{x:0,y:0},{x:0,y:0}],1/60);assert.equal(g.maps[0][50*SIZE+50],2);
 assert.ok(g.scores().reduce((a,b)=>a+b)<=100);
});
test('最大傾斜を続けてもパンの外へ出ない',()=>{
 const g=new Game();for(let n=0;n<3600;n++)g.step([{x:1,y:-1},{x:-1,y:1}],1/60);
 for(const b of g.balls){assert.ok(b.x>=4&&b.x<=SIZE-4);assert.ok(b.y>=4&&b.y<=SIZE-4);}
});
test('中央へ向かう左右対称の操作で別パンの塗布率が一致する',()=>{
 const g=new Game();for(let n=0;n<120;n++)g.step([{x:.5,y:.2},{x:-.5,y:.2}],1/60);
 assert.equal(g.scores()[0],g.scores()[1]);
});
