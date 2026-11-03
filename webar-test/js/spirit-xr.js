(function(){
 'use strict';const $=id=>document.getElementById(id);let THREE,renderer,scene,camera,mixer,model,placement,reticle,anchor=null,lastTime=null,wantPlace=false,currentHit=null,currentMatrix=null,monster;
 let placementRevision=0;
 const state={owner:null,supported:false,placed:false,ready:null};window.SpiritXRApp=state;
 const status=text=>{$('xr-status').textContent=text;};
 function cleanup(){
    placementRevision++;
    if(anchor){try{anchor.delete();}catch(_){}anchor=null;}
    renderer?.setAnimationLoop(null);mixer?.stopAllAction();if(model){mixer?.uncacheRoot(model);SpiritViewer.dispose(model);}
    if(reticle){reticle.geometry.dispose();reticle.material.dispose();}renderer?.dispose();renderer?.forceContextLoss();
    renderer=null;model=null;mixer=null;placement=null;reticle=null;state.placed=false;currentHit=null;currentMatrix=null;lastTime=null;wantPlace=false;
    $('xr-canvas').hidden=true;$('xr-start').disabled=!state.supported;$('xr-end').hidden=true;$('xr-place').disabled=true;status('空间 AR 已结束，摄像头会话已释放。可重试或返回卡牌。');
 }
 async function activate(session,reference,hitSource){
    THREE=await SpiritViewer.engine();if(state.owner.cancelled)return;
    renderer=new THREE.WebGLRenderer({canvas:$('xr-canvas'),alpha:true,antialias:false});renderer.useLegacyLights=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType(state.owner.referenceType);await renderer.xr.setSession(session);
    if(state.owner.cancelled||state.owner.session!==session||!renderer)return;
    renderer.xr.setReferenceSpace(reference);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.05,Math.max(1000,monster.realityHeightM*20));
    scene.add(new THREE.AmbientLight(0xffffff,.6));const light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(2,5,3);scene.add(light);
    const markerGeometry=new THREE.PlaneGeometry(.35,.35);markerGeometry.rotateX(-Math.PI/2);
    reticle=new THREE.Mesh(markerGeometry,new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,depthTest:false}));reticle.matrixAutoUpdate=false;reticle.visible=false;scene.add(reticle);
    $('xr-canvas').hidden=false;$('xr-end').hidden=false;$('xr-place').disabled=false;$('xr-loading').textContent='正在加载选中的怪兽…';
    session.addEventListener('select',()=>{if(!state.placed)wantPlace=true;});
    renderer.setAnimationLoop((time,frame)=>{
        if(!frame||!state.owner.session||!renderer)return;
        if(!frame.getViewerPose(reference)){reticle.visible=false;lastTime=null;return;}
        const dt=lastTime===null?0:Math.min(.05,(time-lastTime)/1000);lastTime=time;mixer?.update(dt);
        const hits=frame.getHitTestResults(hitSource);currentHit=null;reticle.visible=false;
        if(hits.length){const pose=hits[0].getPose(reference);if(pose){const matrix=new THREE.Matrix4().fromArray(pose.transform.matrix);if(SpiritXR.horizontal(matrix,THREE)){currentHit=hits[0];currentMatrix=matrix;reticle.matrix.copy(matrix);reticle.visible=!state.placed;}}}
        if(anchor&&placement){const pose=frame.getPose(anchor.anchorSpace,reference);if(pose)placement.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(pose.transform.matrix));}
        if(wantPlace&&currentHit&&placement){
            wantPlace=false;placement.position.setFromMatrixPosition(currentMatrix);placement.visible=true;state.placed=true;reticle.visible=false;
            if(anchor){anchor.delete();anchor=null;}
            if(typeof currentHit.createAnchor==='function'){
                const targetSession=state.owner.session,revision=++placementRevision;
                currentHit.createAnchor().then(value=>{if(state.owner.session!==targetSession||revision!==placementRevision){value.delete();return;}anchor=value;status('已按 '+monster.realityHeightM+' 米放置，使用空间锚点。真实稳定性仍需手机验收。');}).catch(()=>status('已按设定米制放置，使用本次会话的空间坐标；未建立可选锚点。'));
            }else status('已按设定米制放置，使用本次会话空间坐标；浏览器未提供可选锚点。');
        }
        renderer.render(scene,camera);
    });
    const gltf=await new THREE.GLTFLoader().loadAsync(monster.modelUrl);
    if(state.owner.cancelled||state.owner.session!==session){SpiritViewer.dispose(gltf.scene);return;}
    model=gltf.scene;mixer=new THREE.AnimationMixer(model);const clip=gltf.animations.find(a=>a.name.toLowerCase()==='idle')||gltf.animations[0];if(clip)mixer.clipAction(clip).play();mixer.update(0);
    const bounds=SpiritGeometry.measure(model,THREE),scale=SpiritGeometry.heightScale(monster.realityHeightM,bounds);
    placement=new THREE.Group();const metric=new THREE.Group(),foot=new THREE.Group();metric.scale.setScalar(scale);foot.position.y=-bounds.min.y;foot.add(model);metric.add(foot);placement.add(metric);placement.visible=false;scene.add(placement);
    state.metricScale=scale;state.nativeHeight=bounds.height;
    $('xr-loading').textContent='设定身高 '+monster.realityHeightM+' 米；大小已锁定。'+(monster.realityHeightM>1000?'此尺寸存在精度和裁切风险，请谨慎验证。':'');status('对准平坦地面，出现方形定位框后点击放置。');
 }
 state.ready=(async()=>{
    const catalog=await SpiritData.load();monster=catalog.monsters.find(m=>m.id===new URLSearchParams(location.search).get('monster'));
    let storage;try{storage=localStorage;}catch(_){}const progress=new SpiritData.UnlockStore(storage);
    if(!monster||!progress.has(monster.id)){status('请先扫描实体卡牌解锁此怪兽，再从 AR 进入空间实验。');return false;}
    $('xr-monster').textContent=SpiritData.displayName(monster)+' · 设定身高 '+monster.realityHeightM+' 米';
    if(!isSecureContext||!navigator.xr?.isSessionSupported){status('此环境没有 WebXR 空间 AR。卡牌与近似合影仍可使用，请点击返回。');return false;}
    state.supported=await navigator.xr.isSessionSupported('immersive-ar').catch(()=>false);
    if(!state.supported){status('此浏览器不支持 immersive-ar；可返回使用卡牌 AR 与近似合影。');return false;}
    await SpiritViewer.engine();state.owner=new SpiritXR.XRSessionOwner(navigator.xr,activate,cleanup);$('xr-start').disabled=false;status('设备声明支持 immersive-ar。需要进一步请求 Hit Test；实际地面定位仍待验收。');return true;
 })().catch(error=>{status('空间实验未启动：'+error.message+'。可返回近似合影。');return false;});
 $('xr-start').addEventListener('click',()=>{
    if(!state.owner)return;$('xr-start').disabled=true;status('正在请求空间 AR 权限…');
    state.owner.start($('xr-overlay')).catch(error=>{status('空间 AR 未启动：'+error.message+'。请返回近似合影，或重试。');$('xr-start').disabled=false;});
 });
 $('xr-place').addEventListener('click',()=>{wantPlace=true;if(reticle)reticle.visible=true;state.placed=false;});
 $('xr-end').addEventListener('click',()=>state.owner?.stop());
 const back=document.querySelector('#xr-overlay a[href="./index.html"]');
 back.addEventListener('click',async event=>{event.preventDefault();back.textContent='正在结束空间会话…';try{await state.owner?.stop({waitForPending:false});}finally{location.href='./index.html';}});
 $('xr-overlay').addEventListener('beforexrselect',event=>{if(event.target.closest('button,a'))event.preventDefault();});
 window.addEventListener('pagehide',()=>{state.owner?.stop();});
})();
