/* THE SPIRIT: session ownership and conservative frame-rate protection.
   Original project integration code; no third-party implementation copied. */
(function (root) {
    'use strict';
    const PROFILES = Object.freeze({
        high: { label:'高画质', pixelRatio:1.75, maxCanvas:1440, sampleMs:500, fill:1 },
        standard: { label:'标准画质', pixelRatio:1, maxCanvas:1080, sampleMs:1000, fill:1 },
        economy: { label:'省电画质', pixelRatio:0.65, maxCanvas:720, sampleMs:2000, fill:0 }
    });
    class PerformanceGuard {
        constructor(change, severe) { this.level='standard'; this.manual=false; this.change=change; this.severe=severe; this.reset(); }
        reset() { this.windowStart=0; this.frames=0; this.low=0; this.good=0; this.critical=0; this.warmup=0; this.fps=null; }
        choose(level) { this.manual=level!=='auto'; if (level==='auto') level='standard'; if (!PROFILES[level]) throw Error('Unknown quality'); this.level=level; this.reset(); this.change(level); }
        observe(fps) {
            this.fps=fps; this.low=fps<22?this.low+1:0; this.good=fps>50?this.good+1:0;
            this.critical=this.level==='economy' && fps<12?this.critical+1:0;
            if (this.critical>=3) { this.critical=0; this.severe(); return; }
            if (this.low>=3 && this.level!=='economy') {
                this.level=this.level==='high'?'standard':'economy'; this.low=0; this.good=0; this.change(this.level);
            } else if (!this.manual && this.good>=10 && this.level!=='high') {
                this.level=this.level==='economy'?'standard':'high'; this.good=0; this.low=0; this.change(this.level);
            }
        }
        frame(now) {
            if (!this.warmup) this.warmup=now;
            if (now-this.warmup<5000) return;
            if (!this.windowStart) this.windowStart=now;
            this.frames++;
            if (now-this.windowStart>=3000) { this.observe(this.frames*1000/(now-this.windowStart)); this.windowStart=now; this.frames=0; }
        }
    }
    class MindCameraSession {
        constructor(scene, media) {
            this.scene=scene; this.media=media; this.initialized=false; this.running=false; this.pending=null;
            this.cancelled=false; this.needsReload=false; this.width=0; this.height=0;
        }
        get system() { return this.scene.systems['mindar-image-system']; }
        release() {
            const s=this.system; if (!s) return;
            if (s.controller && s.video) { try { s.pause(); } catch (_) {} }
            const video=s.video;
            if (video) { const stream=video.srcObject; if (stream) stream.getTracks().forEach(t=>t.stop()); video.srcObject=null; video.style.display='none'; }
            this.running=false;
        }
        start() {
            if (this.pending) return this.pending;
            if (this.running) return Promise.resolve();
            if (this.needsReload) return Promise.reject(Error('请重新加载页面，再开始 AR。'));
            this.cancelled=false;
            this.pending=this.activate().catch(error=>{
                if(!this.cancelled&&['NotAllowedError','SecurityError'].includes(error.name))error=Error('摄像头权限被拒绝。请在此网站设置中允许摄像头，再重新加载。');
                else if(!this.cancelled&&['NotReadableError','AbortError'].includes(error.name))error=Error('摄像头暂不可用，可能被其他应用占用。请关闭占用后重新加载。');
                this.needsReload=error.name!=='AbortError';this.release();throw error;
            }).finally(()=>{ this.pending=null; });
            return this.pending;
        }
        async activate() {
            const s=this.system;
            if (!this.initialized) {
                await new Promise((resolve,reject)=>{
                    const clean=()=>{ clearTimeout(timer); this.scene.removeEventListener('arReady',ready); this.scene.removeEventListener('arError',fail); };
                    const ready=()=>{ clean(); resolve(); };
                    const fail=()=>{ clean(); reject(Error('摄像头无法启动。请允许摄像头权限，并关闭其他占用摄像头的应用；此页面需 HTTPS 或 localhost。')); };
                    const timer=setTimeout(()=>{ clean(); reject(Error('启动超时，请重新加载页面后重试。')); },45000);
                    this.scene.addEventListener('arReady',ready); this.scene.addEventListener('arError',fail);
                    // autoStart is false; all anchors are registered before this call.
                    try { s.start(); } catch (error) { clean(); reject(error); }
                });
                this.initialized=true; this.width=s.video.videoWidth; this.height=s.video.videoHeight;
                if(typeof cardViews!=='undefined'&&cardViews.some(v=>!v.anchor.components['mindar-image-target'].postMatrix))throw Error('卡牌编号超出识别库，或锚点尚未准备好。请核对配置并重新编译卡图后重载。');
            } else {
                const stream=await this.media.getUserMedia({ audio:false, video:{ facingMode:'environment', width:{ideal:this.width}, height:{ideal:this.height} } });
                if (this.cancelled) { stream.getTracks().forEach(t=>t.stop()); throw new DOMException('已取消','AbortError'); }
                // Native first-start video has a persistent loadedmetadata handler. Reuse
                // the controller with a fresh video, so that handler cannot start a second one.
                const old=s.video, video=document.createElement('video');
                video.autoplay=true; video.muted=true; video.playsInline=true; video.style.cssText=old.style.cssText; video.style.display='';
                old.replaceWith(video); s.video=video;
                await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>reject(Error('摄像头画面没有就绪，请重载。')),15000);
                    video.addEventListener('loadedmetadata',()=>{ clearTimeout(timer); resolve(); },{once:true});
                    video.srcObject=stream;
                });
                if (video.videoWidth!==this.width || video.videoHeight!==this.height) throw Error('摄像头分辨率已改变，请重新加载页面以安全恢复。');
                if (!this.cancelled) { await video.play(); s._resize(); s.unpause(); }
            }
            if (this.cancelled) { this.release(); throw new DOMException('已取消','AbortError'); }
            this.observeFreshTracking(s.controller);
            this.running=true;
        }
        observeFreshTracking(controller){
            if(this.observedController===controller||typeof controller?.onUpdate!=='function')return;
            this.observedController=controller;const original=controller.onUpdate;
            controller.onUpdate=function(data){
                const result=original.call(controller,data);
                // A paused native anchor may remain visible, so its next genuine
                // pose does not produce another targetFound transition. Rearm only
                // our presentation state after that fresh pose has been applied.
                if(data.type==='updateMatrix'&&data.worldMatrix&&root.SpiritApp?.mode==='ar'&&typeof cardViews!=='undefined'){
                    const view=cardViews.find(v=>v.config.targetIndex===data.targetIndex);
                    if(view&&!view.tracked)view.anchor.emit('targetFound');
                }
                return result;
            };
        }
        async stop() { this.cancelled=true; this.release(); if (this.pending) { try { await this.pending; } catch (_) {} } this.release(); }
    }
    const exported={PerformanceGuard,MindCameraSession,PROFILES};
    if (typeof module!=='undefined' && module.exports) module.exports=exported;
    root.SpiritRuntime=exported;
    if (!root.document) return;
    const byId=id=>document.getElementById(id), screen=byId('launch-screen'), status=byId('launch-status');
    const startButton=byId('btn-start-ar'), retry=byId('btn-reload-ar');
    const app={mode:'home',pending:null,camera:null,performance:null,ready:null,stopping:null};
    root.SpiritApp=app;
    const scene=byId('ar-scene');
    let noticeTimer=null;
    const notice=(text)=>{ clearTimeout(noticeTimer);byId('notice-text').textContent=text;byId('system-notice').hidden=false;noticeTimer=setTimeout(()=>{byId('system-notice').hidden=true;},4500); };
    app.notice=notice;
    const showHome=text=>{
        app.mode='home'; document.body.dataset.appMode='home'; screen.hidden=false;
        startButton.disabled=false; status.textContent=text||'把卡牌平放，在安全的环境中开始。';
    };
    function quality(level) {
        if(app.disposed)return;
        const p=PROFILES[level];
        if (scene.renderer) {
            const ratio=Math.min(root.devicePixelRatio||1,p.pixelRatio,p.maxCanvas/Math.max(innerWidth,innerHeight));
            scene.renderer.setPixelRatio(ratio);
            // renderer is an A-Frame system, not a component: pass its complete data.
            scene.setAttribute('renderer',{...scene.systems.renderer.data,maxCanvasWidth:p.maxCanvas,maxCanvasHeight:p.maxCanvas});
            scene.resize();
        }
        if (typeof environmentLight!=='undefined') { environmentLight.sampleMs=p.sampleMs; environmentLight.fillFactor=p.fill; }
        document.body.dataset.quality=level;
        byId('performance-readout').textContent=p.label+' · 自适应保护中（非温度检测）';
        if (typeof cardViews!=='undefined') cardViews.forEach(v=>{ if(v.ring) v.ring.setAttribute('animation','enabled',level!=='economy'); });
    }
    app.performance=new PerformanceGuard(quality,()=>app.exit('持续卡顿，AR 已暂停。可选省电画质后重新开始，或查看图鉴。'));
    app.canRender=()=>app.mode==='ar';
    app.fail=async(text)=>{ retry.hidden=false; await app.exit(text); };
    app.exit=async(text)=>{
        if(root.SpiritPhoto)SpiritPhoto.cancel();
        showHome(text); byId('system-notice').hidden=true;
        if (app.camera && typeof clearLossGrace==='function') {
            clearLossGrace(); resetInteraction(); isDetached=false; isDetected=false;
            worldAnchor.setAttribute('visible',false);
            cardViews.forEach(v=>{v.tracked=false; hideCardView(v);});
            syncTrackingUI(); tweakPanel.classList.remove('open');
        }
        scene.pause?.(); app.performance.reset();
        if (app.stopping) return app.stopping;
        startButton.disabled=!!app.pending;
        app.stopping=(app.camera?app.camera.stop():Promise.resolve()).finally(()=>{app.stopping=null; startButton.disabled=false;});
        return app.stopping;
    };
    app.navigate=async url=>{await app.exit();if(app.camera&&typeof evictViewModel==='function')cardViews.forEach(evictViewModel);location.href=url;};
    app.openCodex=()=>app.navigate('./codex.html');
    app.start=function(options={}) {
        if (app.pending) return app.pending;
        if (app.mode==='ar') return Promise.resolve();
        // Fullscreen is requested synchronously in this click handler, before awaits.
        if (options.fullscreen!==false && !document.fullscreenElement && document.documentElement.requestFullscreen) {
            try { Promise.resolve(document.documentElement.requestFullscreen()).catch(()=>{}); } catch (_) {}
        }
        startButton.disabled=true; status.textContent='正在准备摄像头与卡牌识别…';
        app.mode='starting';
        app.pending=(async()=>{
            try {
                await app.ready;
                if (app.mode!=='starting') return;
                if (app.stopping) await app.stopping;
                scene.play(); quality(app.performance.level);
                await app.camera.start();
                if (app.mode!=='starting') { await app.camera.stop(); return; }
                app.mode='ar'; document.body.dataset.appMode='ar'; screen.hidden=true; retry.hidden=true;
                app.performance.reset(); syncTrackingUI();
            } catch(error) { if (error.name!=='AbortError') { if(app.camera)await app.exit(error.message);else showHome(error.message);retry.hidden=false; } }
            finally { app.pending=null; startButton.disabled=false; }
        })();
        return app.pending;
    };
    const sceneReady=new Promise((resolve,reject)=>{
        if (!root.AFRAME || typeof configReady==='undefined') { reject(Error('3D 资源未加载，请检查网络并重载页面。')); return; }
        if(scene.hasLoaded) resolve(); else scene.addEventListener('loaded',resolve,{once:true});
    });
    let configurationReady;
    try{configurationReady=typeof configReady==='undefined'?Promise.resolve():configReady;}catch(_){configurationReady=Promise.reject(Error('3D 依赖未就绪，请检查网络并重载。'));}
    app.ready=Promise.all([sceneReady,configurationReady]).then(async()=>{
        const deadline=performance.now()+15000;
        while (!cardViews.length || cardViews.some(v=>!v.anchor.components['mindar-image-target'])) {
            if(performance.now()>deadline) throw Error('卡牌配置未就绪，请检查配置后重载。');
            await new Promise(r=>setTimeout(r,30));
        }
        if(typeof spiritCatalog!=='undefined'&&spiritCatalog)scene.systems['mindar-image-system'].imageTargetSrc=spiritCatalog.mindFile;
        app.camera=new MindCameraSession(scene,navigator.mediaDevices);
        // A delayed native permission response must not reactivate an exited page.
        scene.addEventListener('arReady',()=>queueMicrotask(()=>{ if(app.mode!=='ar'&&app.mode!=='starting') app.camera.release();if(app.disposed){try{app.camera.system.controller?.dispose();}catch(_){}} }));
        app.handleContextLoss=e=>{e.preventDefault();if(!app.disposed)app.fail('画面资源已中断。可重载恢复，或返回图鉴查看资料。');};
        scene.canvas.addEventListener('webglcontextlost',app.handleContextLoss);
        scene.canvas.addEventListener('webglcontextrestored',()=>{ retry.hidden=false; status.textContent='画面资源已恢复，请重载以重新建立 AR 状态。'; });
        quality('standard'); if(app.mode==='home') scene.pause(); return true;
    });
    app.ready.catch(error=>{scene.pause?.();status.textContent=error.message; retry.hidden=false;});
    startButton.addEventListener('click',()=>app.start());
    byId('btn-exit-ar').addEventListener('click',()=>app.exit('已停止摄像头。可以再次开始。'));
    byId('btn-open-codex').addEventListener('click',()=>app.openCodex());
    byId('btn-session-codex').addEventListener('click',()=>app.openCodex());
    byId('btn-notice-exit').addEventListener('click',()=>app.exit());
    byId('quality-select').addEventListener('change',e=>app.performance.choose(e.target.value));
    retry.addEventListener('click',()=>location.reload());
    document.addEventListener('visibilitychange',()=>{ if(document.hidden&&(app.mode==='ar'||app.mode==='starting')) app.exit('已切换到后台并停止摄像头。点击开始 AR 继续。'); });
    root.addEventListener('pagehide',()=>{ if(app.camera) {app.camera.cancelled=true; app.camera.release();} });
    app.shutdown=()=>{
        if(app.disposed)return;app.disposed=true;app.mode='home';
        if(root.SpiritPhoto)SpiritPhoto.cancel();
        if(app.camera){app.camera.cancelled=true;app.camera.release();try{app.camera.system.controller?.dispose();}catch(_){}app.camera.needsReload=true;}
        if(app.camera&&typeof evictViewModel==='function')cardViews.forEach(evictViewModel);
        scene.pause?.();scene.renderer?.dispose();scene.renderer?.forceContextLoss();
    };
    root.addEventListener('pagehide',app.shutdown);
    root.addEventListener('pageshow',event=>{if(event.persisted&&app.disposed)location.reload();});
    root.addEventListener('resize',()=>{if(scene.renderer) requestAnimationFrame(()=>quality(app.performance.level));});
    if(root.AFRAME) AFRAME.registerComponent('spirit-performance-monitor',{
        tock:function(){ if(app.canRender()&&!document.hidden) app.performance.frame(performance.now()); }
    });
    if(root.AFRAME) scene.setAttribute('spirit-performance-monitor','');
})(typeof window==='undefined'?globalThis:window);
