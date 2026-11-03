(function(){
 'use strict';const T=AFRAME.THREE,$=id=>document.getElementById(id),labels={original:'Original',a:'Candidate A',b:'Candidate B'};
 const state=window.SpiritReview={model:null,mixer:null,variant:null,reference:null,version:0,playing:false,time:0,last:null,loading:false,results:{}};
 document.querySelectorAll('[data-variant]').forEach(b=>b.disabled=true);
 const renderer=state.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.useLegacyLights=true;renderer.setPixelRatio(1);renderer.setSize(800,800);renderer.setClearColor(0x12212d);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;$('stage').append(renderer.domElement);
 const scene=state.scene=new T.Scene(),camera=state.camera=new T.PerspectiveCamera(45,1,.001,100);scene.add(new T.AmbientLight(0xffffff,.4));
 for(const [power,position]of [[1.325,[1,2.5,1.5]],[.23,[-2,1,.5]]]){const light=new T.DirectionalLight(0xffffff,power);light.position.set(...position);scene.add(light);}
 const orbit=state.orbit={target:new T.Vector3(),yaw:0,pitch:0,distance:1};let geometryHelper;
 state.render=()=>{if(!state.model)return;const cp=Math.cos(orbit.pitch);camera.position.set(orbit.target.x+orbit.distance*Math.sin(orbit.yaw)*cp,orbit.target.y+orbit.distance*Math.sin(orbit.pitch),orbit.target.z+orbit.distance*Math.cos(orbit.yaw)*cp);camera.lookAt(orbit.target);camera.updateProjectionMatrix();scene.updateMatrixWorld(true);renderer.render(scene,camera);};
 state.setResolution=n=>{if(![800,1440].includes(n))throw Error('尺寸无效');renderer.setSize(n,n,false);$('resolution').value=String(n);state.render();};
 state.setPreset=name=>{
  const h=state.reference.height,c=state.reference.center;let target,position;
  if(name==='head'){target=new T.Vector3(0,h*.84,0);position=new T.Vector3(.012,h*.84,.17);}
  else if(name==='body'){target=new T.Vector3(0,h*.49,0);position=new T.Vector3(.08,h*.49,.26);}
  else if(name==='arm'){target=new T.Vector3(.19,h*.43,0);position=new T.Vector3(.265,h*.43,.20);}
  else if(name==='tentacle'){target=new T.Vector3(.01,h*.13,.025);position=new T.Vector3(.075,h*.19,.19);}
  else{target=c.clone();position=new T.Vector3(c.x,c.y,state.reference.radius*2.05);name='full';}
  orbit.target.copy(target);const delta=position.sub(target);orbit.distance=delta.length();orbit.yaw=Math.atan2(delta.x,delta.z);orbit.pitch=Math.asin(delta.y/orbit.distance);state.preset=name;$('preset').value=name;state.render();
 };
 function dispose(object){const gs=new Set(),ms=new Set(),ts=new Set();object?.traverse(n=>{if(n.geometry)gs.add(n.geometry);if(n.skeleton?.boneTexture)ts.add(n.skeleton.boneTexture);if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>ms.add(m));});ms.forEach(m=>Object.values(m).forEach(t=>{if(t?.isTexture)ts.add(t);}));ts.forEach(t=>t.dispose());ms.forEach(m=>m.dispose());gs.forEach(g=>g.dispose());}
 state.select=async variant=>{
  if(!Object.prototype.hasOwnProperty.call(labels,variant))throw Error('模型无效');if(state.variant===variant&&state.model)return state.results[variant];
  const revision=++state.version,start=performance.now();state.loading=true;$('status').textContent='加载 '+labels[variant]+'…';state.last=null;
  if(state.model){state.mixer?.stopAllAction();state.mixer?.uncacheRoot(state.model);scene.remove(state.model);dispose(state.model);state.model=null;}
  try{
   const gltf=await new T.GLTFLoader().loadAsync(state.assets.models[variant]);if(revision!==state.version){dispose(gltf.scene);return;}
   state.model=gltf.scene;scene.add(state.model);state.model.traverse(n=>{if(n.isMesh)(Array.isArray(n.material)?n.material:[n.material]).forEach(SpiritReviewReference.enhance);});
   state.mixer=new T.AnimationMixer(state.model);const idle=gltf.animations.find(a=>a.name==='Idle');if(idle)state.mixer.clipAction(idle).play();state.mixer.setTime(state.time);
   if(!state.reference){state.mixer.setTime(0);state.reference=geometryHelper.measure(state.model,T);state.setPreset('full');}
   state.variant=variant;state.render();const result={variant,triangles:0,drawnTriangles:renderer.info.render.triangles,loadAndRenderMs:performance.now()-start,bones:0,animations:gltf.animations.map(a=>a.name),antialias:renderer.getContext().getContextAttributes().antialias};state.model.traverse(n=>{if(n.isBone)result.bones++;if(n.isMesh&&n.geometry)result.triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;});state.results[variant]=result;
   document.querySelectorAll('[data-variant]').forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed',String(b.dataset.variant===variant));});$('summary').textContent=result.triangles.toLocaleString()+' 三角；'+result.bones+' 骨骼；只驻留当前模型。';$('status').textContent=labels[variant]+' · '+(state.playing?'Idle 播放中':'Idle 第 0 帧 / 固定姿态')+' · 切换时保留视角';return result;
  }catch(e){if(revision===state.version)$('status').textContent='模型未打开：'+e.message;throw e;}finally{if(revision===state.version)state.loading=false;}
 };
 state.freeze=()=>{state.playing=false;state.time=0;state.mixer?.setTime(0);$('play').textContent='播放 Idle';state.render();};
 state.benchmark=async()=>{state.freeze();state.setPreset('full');const until=performance.now()+2000;while(performance.now()<until){state.render();await new Promise(r=>requestAnimationFrame(r));}const frames=[],cost=[];for(let i=0;i<60;i++){const t=performance.now();state.render();cost.push(performance.now()-t);frames.push(await new Promise(r=>requestAnimationFrame(r)));}cost.sort((a,b)=>a-b);return{variant:state.variant,pixels:renderer.domElement.width,warmupMs:2000,desktopRAFfps:59000/(frames[59]-frames[0]),cpuSubmitMedianMs:cost[30],scope:'Desktop RAF pacing, not GPU time or phone FPS; sequential loads/cache affect first load.'};};
 const pointers=new Map();let lastPinch=null;
 renderer.domElement.addEventListener('pointerdown',e=>{renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPinch=null;});
 renderer.domElement.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){orbit.yaw-=(e.clientX-prev.x)*.008;orbit.pitch=T.MathUtils.clamp(orbit.pitch+(e.clientY-prev.y)*.006,-1.35,1.35);}else{const[a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch&&d>1)orbit.distance=T.MathUtils.clamp(orbit.distance*lastPinch/d,.025,3);lastPinch=d;}state.render();});
 for(const type of['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,e=>{pointers.delete(e.pointerId);lastPinch=null;});
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();orbit.distance=T.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.001),.025,3);state.render();},{passive:false});
 $('zoom-in').onclick=()=>{orbit.distance=Math.max(.025,orbit.distance/1.2);state.render();};$('zoom-out').onclick=()=>{orbit.distance=Math.min(3,orbit.distance*1.2);state.render();};$('reset').onclick=()=>state.setPreset($('preset').value);$('preset').onchange=()=>state.setPreset($('preset').value);$('resolution').onchange=()=>state.setResolution(Number($('resolution').value));
 document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>state.select(b.dataset.variant).catch(()=>{}));
 $('play').onclick=()=>{state.playing=!state.playing;state.last=null;$('play').textContent=state.playing?'冻结第 0 帧':'播放 Idle';if(!state.playing)state.freeze();};
 $('save').onclick=()=>{state.render();renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shisu-'+state.variant+'-'+state.preset+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
 let frame;function animate(t){if(state.playing&&!state.loading&&!document.hidden&&state.mixer){if(state.last!==null)state.time+=Math.min((t-state.last)/1000,.1);state.mixer.setTime(state.time);state.render();}state.last=t;frame=requestAnimationFrame(animate);}frame=requestAnimationFrame(animate);
 state.ready=(async()=>{state.assets=await(await fetch('./review-assets.json')).json();const script=document.createElement('script');script.src=state.assets.geometryHelper;await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;document.head.append(script);});geometryHelper=window.SpiritGeometry;await state.select('original');return true;})();state.ready.catch(e=>$('status').textContent='预览未就绪，请先启动本地 HTTP 服务并检查网络。'+e.message);
 window.addEventListener('pagehide',()=>{state.version++;cancelAnimationFrame(frame);state.mixer?.stopAllAction();dispose(state.model);renderer.dispose();renderer.forceContextLoss();});
})();
