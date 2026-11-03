import {Game,SIZE,clamp,orientation} from './engine.js?v=3';
const $=id=>document.getElementById(id),names=['バター','小倉'],colors=['#f3c94b','#874354'];
const params=new URLSearchParams(location.search),isController=params.has('join');
let peer,conn,wake;
function newPeer(){if(!window.Peer)throw Error('接続ライブラリを読み込めません。インターネット接続を確認してください。');return new Peer();}
async function keepAwake(){try{wake=await navigator.wakeLock?.request('screen');}catch{}}
if(isController) controller();else host();
function controller(){
 $('host').hidden=true;$('controller').hidden=false;
 const team=Number(params.get('team'));if(![0,1].includes(team)||!params.get('token')){$('controllerStatus').textContent='参加リンクが不正です。PCのリンクを開き直してください。';return;}
 $('teamName').textContent=(team===0?'🧈 ':'🫘 ')+names[team];
 let raw=null,zero=null,lastSensor=0,filtered={x:0,y:0},enabled=false,ready=false,accepted=false,generation=0,retries=0,retryTimer,connectTimer,lastAngle=screen.orientation?.angle??window.orientation??0;
 function send(d){if(conn?.open&&accepted)conn.send(d);}
 function setSensorStatus(text){$('sensorStatus').textContent=text;}
 function invalidate(){ready=false;zero=null;$('calibrate').disabled=true;setSensorStatus('水平設定が必要です。');send({type:'input',x:0,y:0,ready:false});}
 function fail(message,attempt){
  if(attempt!==generation)return;
  // Invalidate callbacks before closing: late events from an old attempt must not touch the new connection.
  generation++;accepted=false;clearTimeout(connectTimer);clearTimeout(retryTimer);invalidate();conn?.close();peer?.destroy();
  $('controllerStatus').textContent=message;
  if(retries<2&&!document.hidden){retries++;$('controllerStatus').textContent+=` 自動再接続 ${retries}/2…`;retryTimer=setTimeout(()=>connect(false),1500*retries);}
  else $('controllerStatus').textContent+=' 本体で部屋を作り直して新しいQRを開いてください。それでも失敗する場合は、別のWi-Fiまたは本体をスマホのテザリングへ接続して確認してください。';
 }
 function connect(manual=true){
  if(manual)retries=0;
  const attempt=++generation;clearTimeout(retryTimer);clearTimeout(connectTimer);accepted=false;invalidate();conn?.close();peer?.destroy();$('controllerStatus').textContent='本体との通信を接続中…（最大35秒）';
  connectTimer=setTimeout(()=>fail('本体への接続がタイムアウトしました。',attempt),35000);
  try{
   const currentPeer=newPeer();peer=currentPeer;
   currentPeer.on('open',()=>{
    if(attempt!==generation)return;
    const currentConn=currentPeer.connect(params.get('join'),{reliable:true});conn=currentConn;
    currentConn.on('open',()=>{if(attempt!==generation)return;$('controllerStatus').textContent='通信経路を確立。本体の応答待ち…';currentConn.send({type:'hello',team,token:params.get('token')});});
    currentConn.on('data',d=>{
     if(attempt!==generation||!d||typeof d!=='object')return;
     if(d.type==='accepted'){accepted=true;clearTimeout(connectTimer);$('controllerStatus').textContent='本体と接続済み。センサー許可 → 水平設定をしてください。';$('calibrate').disabled=!raw||performance.now()-lastSensor>800;keepAwake();}
     if(d.type==='ready'&&ready&&d.ready)setSensorStatus('水平設定を本体が受信しました。開始できます。');
     if(d.type==='state')$('remotePhase').textContent=d.text;
     if(d.type==='reject'){retries=2;fail(d.text,attempt);}
    });
    currentConn.on('close',()=>fail('本体との通信が切断されました。',attempt));
    currentConn.on('error',e=>fail('本体との通信経路を確立できませんでした：'+e.message,attempt));
   });
   currentPeer.on('error',e=>fail('接続エラー：'+e.type+'。'+(e.message||''),attempt));
  }catch(e){fail(e.message,attempt);}
 }
 $('reconnect').onclick=()=>connect();
 $('sensor').onclick=async()=>{try{if(!isSecureContext)throw Error('HTTPSで開いてください。');if(!window.DeviceOrientationEvent)throw Error('この端末は傾きセンサーに対応していません。');if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('センサーが許可されませんでした。ブラウザの設定を確認してください。');enabled=true;setSensorStatus('センサーの応答待ち…');keepAwake();setTimeout(()=>{if(!raw)setSensorStatus('センサーの応答がありません。対応スマホのSafari／Chromeで開いてください。');},3000);}catch(e){setSensorStatus(e.message);}};
 window.addEventListener('deviceorientation',e=>{if(!enabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;raw={beta:e.beta,gamma:e.gamma};lastSensor=performance.now();$('calibrate').disabled=!accepted;});
 $('calibrate').onclick=()=>{if(!accepted||!conn?.open){setSensorStatus('水平設定の前に本体との接続が必要です。');return;}if(!raw||performance.now()-lastSensor>800)return;zero={...raw};filtered={x:0,y:0};ready=true;setSensorStatus('水平設定済み。本体への送信を確認中…');send({type:'input',x:0,y:0,ready:true,calibration:true});};
 $('stop').onclick=()=>{send({type:'stop'});invalidate();setSensorStatus('緊急停止しました。安全確認後、水平を再設定してください。');};
 document.addEventListener('visibilitychange',()=>{invalidate();if(!document.hidden)keepAwake();});
 setInterval(()=>{const angle=screen.orientation?.angle??window.orientation??0;if(angle!==lastAngle){lastAngle=angle;invalidate();setSensorStatus('画面の向きが変わりました。水平を再設定してください。');}if(performance.now()-lastSensor>800){if(ready)setSensorStatus('センサー応答が途切れました。水平を再設定してください。');ready=false;$('calibrate').disabled=true;}
 let v={x:0,y:0};if(ready&&zero&&raw)v=orientation(raw.beta,raw.gamma,angle,zero);v.x*=$('invertX').checked?-1:1;v.y*=$('invertY').checked?-1:1;filtered.x+=(v.x-filtered.x)*.3;filtered.y+=(v.y-filtered.y)*.3;
 $('dot').style.transform=`translate(${filtered.x*60}px,${filtered.y*60}px)`;
 if(raw)$('angles').textContent=ready?`左右 ${Math.round(filtered.x*100)} / 前後 ${Math.round(filtered.y*100)}`:'水平設定が必要です';
 send({type:'input',x:filtered.x,y:filtered.y,ready:ready&&!document.hidden});},50);connect();
}
function host(){
 const canvas=$('board'),ctx=canvas.getContext('2d'),keys=new Set();let game=new Game(),state='idle',remaining=60,acc=0,last=performance.now(),countdown=0,connections=[null,null],roomToken='',test=false,participants=[false,false];
 const inputs=[{x:0,y:0,ready:false,last:0},{x:0,y:0,ready:false,last:0}];
 const textState=()=>({idle:'準備中',countdown:'まもなくスタート',running:'試合中',paused:'一時停止',finished:'終了'})[state];
 function broadcast(){for(const c of connections)if(c?.open)c.send({type:'state',text:`${textState()} ／ 残り ${Math.ceil(remaining)}秒`});}
 function pause(reason){if(state==='running'||state==='countdown'){state='paused';$('network').textContent=reason;update();broadcast();}}
 function update(){ $('startHelp').textContent=$('network').textContent;$('phase').textContent=state==='countdown'?`スタートまで ${Math.ceil(countdown)}`:textState();$('time').textContent=Math.ceil(remaining);$('pause').disabled=!['running','paused','countdown'].includes(state);$('pause').textContent=state==='paused'?'再開':'一時停止';$('start').disabled=state!=='idle';for(const id of ['mode','duration','test'])$(id).disabled=state!=='idle';}
 function reset(){participants=[false,false];keys.clear();for(let i=0;i<2;i++)$('score'+i).textContent='0.0%';state='idle';remaining=Number($('duration').value);game=new Game($('mode').value);acc=0;$('result').hidden=true;$('rule').textContent=game.mode==='race'?'別々のトーストで、塗れた面積を競います。':'共通のトーストを塗り合います。相手の色を上塗りできます。';update();broadcast();}
 function teamReady(i){return !!(connections[i]?.open&&inputs[i].ready&&performance.now()-inputs[i].last<1000);}
 function available(){return test||(participants.some(Boolean)&&participants.every((active,i)=>!active||teamReady(i)));}
 $('start').onclick=()=>{test=$('test').checked;participants=inputs.map((_,i)=>teamReady(i));if(!available()){$('network').textContent='どちらか1チームの接続・センサー許可・水平設定が必要です。スマホなしなら「机上テスト」を選んでください。';return;}$('network').textContent=test?'机上テストを開始します。':participants.map((active,i)=>active?names[i]+'：参加':names[i]+'：お休み').join(' ／ ');state='countdown';countdown=3;keepAwake();update();broadcast();};
 $('pause').onclick=()=>{if(state==='paused'){if(!available()){$('network').textContent='試合に参加しているチームの接続・水平設定を確認してください。';return;}state='countdown';countdown=3;last=performance.now();update();broadcast();}else pause('進行役が停止しました。');};
 $('reset').onclick=reset;$('again').onclick=()=>{reset();$('board').scrollIntoView({behavior:'smooth'});};$('mode').onchange=reset;$('duration').onchange=reset;$('test').onchange=()=>{test=$('test').checked;};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('host').requestFullscreen();}catch{$('network').textContent='このブラウザでは全画面にできません。';}};
 $('room').onclick=()=>{if(state!=='idle')return;connections.forEach(c=>c?.close());connections=[null,null];peer?.destroy();$('links').replaceChildren();roomToken=crypto.randomUUID();$('network').textContent='接続用リンクを作成中…';
 try{peer=newPeer();peer.on('open',id=>{$('network').textContent='チーム別リンクをスマホで開き、センサー許可 → 水平設定をしてください。';for(let i=0;i<2;i++){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('join',id);url.searchParams.set('team',i);url.searchParams.set('token',roomToken);const a=document.createElement('article'),title=document.createElement('b'),link=document.createElement('a'),copy=document.createElement('button');title.textContent=names[i]+'のスマホ';link.href=url.href;link.textContent=url.href;link.target='_blank';link.rel='noopener';copy.textContent='リンクをコピー';copy.onclick=async()=>{try{await navigator.clipboard.writeText(url.href);copy.textContent='コピーしました';}catch{copy.textContent='リンクを長押ししてコピー';}};const qr=document.createElement('div');qr.className='join-qr';qr.setAttribute('role','img');qr.setAttribute('aria-label',names[i]+'の接続QRコード');try{if(typeof window.qrcode!=='function')throw Error('QRコードを読み込めませんでした。上のリンクを使ってください。');const code=window.qrcode(0,'M');code.addData(url.href);code.make();qr.innerHTML=code.createSvgTag({cellSize:4,margin:16,scalable:true});}catch(error){qr.textContent=error.message;}a.append(title,qr,link,copy);$('links').append(a);}});
 peer.on('connection',c=>{let team=null,timeout;c.on('open',()=>{timeout=setTimeout(()=>{if(team===null)c.close();},10000);});c.on('data',d=>{if(!d||typeof d!=='object')return;if(team===null){if(d.type!=='hello'||d.token!==roomToken||![0,1].includes(d.team))return c.close();if(connections[d.team]?.open){c.send({type:'reject',text:'このチームは接続済みです。前のスマホを閉じてから再接続してください。'});setTimeout(()=>c.close(),300);return;}team=d.team;clearTimeout(timeout);connections[team]=c;c.send({type:'accepted'});broadcast();return;}if(d.type==='stop')pause(names[team]+'が緊急停止しました。');if(d.type==='input'&&Number.isFinite(d.x)&&Number.isFinite(d.y)){const changed=inputs[team].ready!==(d.ready===true);inputs[team]={x:clamp(d.x,-1,1),y:clamp(d.y,-1,1),ready:d.ready===true,last:performance.now()};if(changed||d.calibration===true)c.send({type:'ready',ready:inputs[team].ready});}});c.on('close',()=>{clearTimeout(timeout);if(team!==null&&connections[team]===c){connections[team]=null;inputs[team].ready=false;if(!test&&participants[team])pause(names[team]+'の接続が切れました。');}});c.on('error',()=>pause('通信エラー。接続を確認してください。'));});peer.on('error',e=>{$('network').textContent='接続エラー：'+e.type+'。再度「スマホを接続する」を押すか、机上テストを使用してください。';pause('接続仲介サービスとの通信に失敗しました。');});}catch(e){$('network').textContent=e.message;}};
 window.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON/.test(e.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key===' '&&!e.repeat)$('pause').click();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();pause('画面から離れたため停止しました。');});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause('画面が非表示になったため停止しました。');}});
 function finish(){state='finished';const scores=game.scores();$('winner').textContent=Math.abs(scores[0]-scores[1])<.05?'引き分け！':names[scores[0]>scores[1]?0:1]+'の勝ち！';$('resultText').textContent=`バター ${scores[0].toFixed(1)}% ／ 小倉 ${scores[1].toFixed(1)}%`;$('result').hidden=false;update();broadcast();}
 function draw(){ctx.clearRect(0,0,1200,650);const boards=game.mode==='race'?[{x:70,y:70,w:500,h:500,i:0},{x:630,y:70,w:500,h:500,i:1}]:[{x:350,y:50,w:550,h:550,i:0}];for(const b of boards){ctx.fillStyle='#a55e2e';ctx.beginPath();ctx.roundRect(b.x-20,b.y-20,b.w+40,b.h+40,60);ctx.fill();ctx.fillStyle='#f4d79c';ctx.beginPath();ctx.roundRect(b.x-8,b.y-8,b.w+16,b.h+16,42);ctx.fill();ctx.fillStyle='#f9e6b9';ctx.fillRect(b.x,b.y,b.w,b.h);const map=game.maps[b.i],s=b.w/SIZE;for(let j=0;j<map.length;j++)if(map[j]){ctx.fillStyle=colors[map[j]-1];ctx.fillRect(b.x+j%SIZE*s,b.y+Math.floor(j/SIZE)*s,s+.3,s+.3);}for(let i=0;i<2;i++){if(game.mode==='race'&&i!==b.i)continue;const ball=game.balls[i];ctx.save();ctx.translate(b.x+ball.x*s,b.y+ball.y*s);ctx.shadowColor='#40271455';ctx.shadowBlur=12;ctx.fillStyle=colors[i];ctx.strokeStyle=i===0?'#fff6cb':'#e4a9af';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-19,-19,38,38,i===0?8:18);ctx.fill();ctx.stroke();ctx.fillStyle=i===0?'#6c4c12':'#fff0df';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===0?'B':'O',0,1);ctx.restore();}}
 if(state==='countdown'||state==='paused'){ctx.fillStyle='#38281faa';ctx.fillRect(0,0,1200,650);ctx.fillStyle='#fff9e9';ctx.font='900 70px sans-serif';ctx.textAlign='center';ctx.fillText(state==='countdown'?Math.ceil(countdown):'PAUSE',600,340);}}
 let lastBroadcast=0;function frame(now){const elapsed=(now-last)/1000;last=now;if(elapsed>.5)pause('画面の処理が中断されたため停止しました。');if(['running','countdown'].includes(state)&&!available())pause('接続またはセンサー応答が途切れました。再接続・水平設定後に再開してください。');if(state==='countdown'){countdown-=Math.min(elapsed,.1);if(countdown<=0){state='running';broadcast();}}
 if(state==='running'){acc+=Math.min(elapsed,.1);while(acc>=1/60&&state==='running'){const v=test?[{x:+keys.has('d')-keys.has('a'),y:+keys.has('s')-keys.has('w')},{x:+keys.has('arrowright')-keys.has('arrowleft'),y:+keys.has('arrowdown')-keys.has('arrowup')}]:inputs.map((input,i)=>({...input,active:participants[i]}));game.step(v,1/60);remaining=Math.max(0,remaining-1/60);acc-=1/60;if(remaining<=0)finish();}}
 game.scores().forEach((n,i)=>{$('score'+i).textContent=n.toFixed(1)+'%';$('status'+i).textContent=test?'机上テスト':connections[i]?.open?(inputs[i].ready&&now-inputs[i].last<1000?'接続・水平設定 OK':'水平設定／センサー待ち'):'未接続（片方だけでも開始OK）';});update();draw();if(now-lastBroadcast>500){broadcast();lastBroadcast=now;}requestAnimationFrame(frame);}
 reset();requestAnimationFrame(frame);
}
