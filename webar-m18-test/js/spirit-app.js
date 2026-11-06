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
            if (this.exhibit) {
                this.fps=fps; this.critical=fps<12?this.critical+1:0;
                if (this.critical>=3) { this.critical=0; this.severe(); }
                return;
            }
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
            root.SpiritDiagnostics?.watchCamera();
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
                await this.waitForNativeFrame();
                if (this.cancelled) throw new DOMException('已取消','AbortError');
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
                // MindAR InputLoader uses these attributes on a replacement video.
                video.width=video.videoWidth; video.height=video.videoHeight;
                if (!this.cancelled) { await video.play(); s._resize(); s.unpause(); }
            }
            if (this.cancelled) { this.release(); throw new DOMException('已取消','AbortError'); }
            this.observeFreshTracking(s.controller);
            this.running=true;
        }
        waitForNativeFrame() {
            // pause() stops scheduling, but an already issued worker request can
            // still complete. Its loop must reach the next frame with processing off.
            return new Promise((resolve, reject) => {
                let raf = 0;
                const timer = setTimeout(() => {
                    this.nativeFrameDrained = null;
                    cancelAnimationFrame(raf);
                    reject(Error('上一次识别没有及时结束。请重新加载后再开始 AR。'));
                }, 2500);
                const next = () => {
                    this.nativeFrameDrained = null;
                    raf = requestAnimationFrame(() => {
                        raf = requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
                    });
                };
                if (this.nativeFrameBusy) this.nativeFrameDrained = next;
                else next();
            });
        }
        observeFreshTracking(controller){
            if(this.observedController===controller||typeof controller?.onUpdate!=='function')return;
            this.observedController=controller;const original=controller.onUpdate;
            const session = this;
            for (const name of ['_detectAndMatch', '_trackAndUpdate']) {
                if (typeof controller[name] !== 'function') continue;
                const step = controller[name];
                controller[name] = function(...args) {
                    session.nativeFrameBusy = true;
                    return step.apply(this, args);
                };
            }
            controller.onUpdate=function(data){
                if (data.type === 'processDone') {
                    session.nativeFrameBusy = false;
                    session.nativeFrameDrained?.();
                }
                const result=original.call(controller,data);
                root.SpiritDiagnostics?.update(controller,data);
                // A paused native anchor may remain visible, so its next genuine
                // pose does not produce another targetFound transition. Rearm only
                // our presentation state after that fresh pose has been applied.
                if(data.type==='updateMatrix'&&data.worldMatrix&&controller.trackingStates?.[data.targetIndex]?.isTracking&&root.SpiritApp?.mode==='ar'&&typeof cardViews!=='undefined'){
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
        byId('performance-readout').textContent=p.label+(app.performance?.exhibit?' · 展览模式保持所选画质':' · 自适应保护中（非温度检测）');
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
        root.SpiritDiagnostics?.attempt();
        // Fullscreen is requested synchronously in this click handler, before awaits.
        if (options.fullscreen!==false && !document.fullscreenElement && document.documentElement.requestFullscreen) {
            try { Promise.resolve(document.documentElement.requestFullscreen()).catch(()=>{}); } catch (_) {}
        }
        startButton.disabled=true; status.textContent='正在准备摄像头与卡牌识别…';
        app.mode='starting';
        app.pending=(async()=>{
            try {
                await (app.waitExhibitReady ? app.waitExhibitReady() : app.ready);
                if (app.mode!=='starting') return;
                if (app.stopping) await app.stopping;
                scene.play(); quality(app.performance.level);
                // Only one main monster, never all catalogue assets; do not block camera.
                const primary=cardViews[0];
                if(primary && new URLSearchParams(location.search).get('preload')!=='off'){
                    const pending=ensureViewModel(primary),version=primary.loadVersion;
                    app.preload=pending.catch(error=>{root.SpiritDiagnostics?.mark('preload_error',{name:error.name});if(primary.loadVersion===version&&primary.model&&!primary.modelEnvelope)evictViewModel(primary);});
                }
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
        root.SpiritTracking?.apply(scene.systems['mindar-image-system']);
        app.camera=new MindCameraSession(scene,navigator.mediaDevices);
        // A delayed native permission response must not reactivate an exited page.
        scene.addEventListener('arReady',()=>{root.SpiritDiagnostics?.mark('mindar_ready');root.SpiritDiagnostics?.attach(app.camera.system.controller);app.camera.observeFreshTracking(app.camera.system.controller);queueMicrotask(()=>{ if(app.mode!=='ar'&&app.mode!=='starting') app.camera.release();if(app.disposed){try{app.camera.system.controller?.dispose();}catch(_){}} });});
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
        tock:function(){ if(app.canRender()&&!document.hidden){app.performance.frame(performance.now());root.SpiritDiagnostics?.frame(typeof activeView==='undefined'?null:activeView);} }
    });
    if(root.AFRAME) scene.setAttribute('spirit-performance-monitor','');
})(typeof window==='undefined'?globalThis:window);

/* THE SPIRIT exhibit mode. Only runs when a player explicitly opens ?exhibit=1. */
(() => {
    'use strict';
    if (typeof window === 'undefined' || new URLSearchParams(location.search).get('exhibit') !== '1') return;
    const app = window.SpiritApp;
    const entry = document.querySelector('.spirit-entry');
    const nav = document.querySelector('#session-nav');
    if (!app || !entry || !nav) return;
    app.performance.exhibit = true;

    const block = document.createElement('details');
    block.id = 'spirit-exhibit';
    block.open = true;
    const title = document.createElement('summary');
    title.textContent = '展览模式';
    const hint = document.createElement('p');
    hint.textContent = '先检查资源，再手动开启摄像头。卡牌请平放、避开反光，对准后稍等。展览模式保留当前画质。';
    const progress = document.createElement('p');
    progress.id = 'spirit-exhibit-progress';
    progress.setAttribute('role', 'status');
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'spirit-secondary';
    check.textContent = '检查展览资源';
    const standard = document.createElement('a');
    standard.href = './index.html';
    standard.textContent = '回到普通扫码';
    standard.style.color = '#8ce9e0';
    block.append(title, hint, check, progress, standard);
    entry.append(block);

    async function checkResources() {
        check.disabled = true;
        try {
            progress.textContent = '正在检查引擎和卡牌配置…';
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            try {
                const ready = Promise.race([app.ready, new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => reject(Error('等待引擎超时，请检查网络后重试。')), { once: true });
                })]);
                await ready;
                const config = typeof spiritCatalog !== 'undefined' ? spiritCatalog : null;
                const urls = [config?.mindFile, typeof cardViews !== 'undefined' ? cardViews[0]?.config?.modelUrl : null];
                if (urls.some(url => !url)) throw Error('找不到卡牌识别库或主怪兽，请重新载入配置。');
                for (const [index, url] of urls.entries()) {
                    progress.textContent = index ? '2/2 检查主怪兽资源…' : '1/2 检查识别库…';
                    const response = await fetch(url, { method:'HEAD', signal:controller.signal, cache:'no-cache' });
                    if (!response.ok) throw Error(index ? '主怪兽资源不可访问。' : '卡牌识别库不可访问。');
                }
                progress.textContent = '通过资源可访问性检查。点击「开始 AR」并允许摄像头。';
            } finally { clearTimeout(timer); }
        } catch (error) {
            progress.textContent = error.name === 'AbortError' ? '网络检查超时，请确认连接后重试。' :
                (error instanceof TypeError ? '无法连接资源，请确认网络后重试。' : error.message);
        } finally { check.disabled = false; }
    }
    check.addEventListener('click', checkResources);

    const restart = document.createElement('button');
    restart.type = 'button';
    restart.id = 'btn-exhibit-restart';
    restart.textContent = '重新扫描';
    nav.append(restart);
    restart.addEventListener('click', async () => {
        restart.disabled = true;
        try {
            await app.exit('正在重新开始扫描…');
            await app.start({ fullscreen:false });
        } finally { restart.disabled = false; }
    });
    let last = performance.now();
    let warned = false;
    const touch = () => { last = performance.now(); };
    document.addEventListener('pointerdown', touch, { passive:true });
    document.addEventListener('keydown', touch);
    const interval = setInterval(() => {
        if (app.mode !== 'ar') {
            last = performance.now();
            warned = false;
            return;
        }
        // A card held by a visitor is also activity even without screen touches.
        if (typeof cardViews !== 'undefined' && cardViews.some(view => view.tracked)) touch();
        if (performance.now() - last >= 180000) {
            app.exit('展览模式已暂停闲置摄像头。请点击「开始 AR」继续。');
            touch();
        } else if (!warned && app.performance.fps !== null && app.performance.fps < 22) {
            warned = true;
            app.notice('画面负载较高。可保留当前画质，或手动选择兼容画质。');
        }
    }, 2000);
    addEventListener('pagehide', event => { if (!event.persisted) clearInterval(interval); });
})();

/* Exhibit-only recovery. All camera requests and reloads remain user initiated. */
(() => {
    'use strict';
    if (typeof window === 'undefined' || new URLSearchParams(location.search).get('exhibit') !== '1') return;
    const app = window.SpiritApp;
    const block = document.querySelector('#spirit-exhibit');
    const status = document.querySelector('#launch-status');
    const reload = document.querySelector('#btn-reload-ar');
    const startButton = document.querySelector('#btn-start-ar');
    const guide = document.querySelector('#scan-guide');
    const scene = document.querySelector('#ar-scene');
    if (!app || !block || !status || !reload || !startButton || !guide || !scene) return;

    const advice = document.createElement('p');
    advice.id = 'spirit-exhibit-advice';
    advice.hidden = true;
    advice.setAttribute('role','status');
    block.querySelector('summary').after(advice);
    const network = document.createElement('p');
    network.id = 'spirit-exhibit-network';
    network.hidden = true;
    network.setAttribute('role','status');
    block.append(network);

    let graphicsBroken = false;
    const updateAdvice = () => {
        const message = status.textContent;
        let text = '';
        if (graphicsBroken) text = '画面已暂停。点「重试加载」重新打开展览，图鉴进度会保留。';
        else if (/权限|被拒绝/.test(message) && !reload.hidden) {
            text = '在浏览器的网站设置中允许摄像头。关掉正在使用摄像头的其他应用，再重试加载。';
        } else if (/网络|资源|模型|加载|超时|未就绪/.test(message) && !reload.hidden) {
            text = '请先确认网络连接，再试一次。也可以打开图鉴查看已发现的怪兽。';
        }
        advice.hidden = !text;
        advice.textContent = text;
        reload.textContent = '重试加载';
    };
    const observer = new MutationObserver(updateAdvice);
    observer.observe(status,{childList:true,subtree:true});
    observer.observe(reload,{attributes:true,attributeFilter:['hidden']});
    updateAdvice();

    function showNetwork(online) {
        const message = online ? '网络已恢复。资源检查失败时可再试一次。' :
            '暂时无法联网。当前画面可以继续使用。若怪兽没有加载，请恢复网络后重试。';
        network.hidden = false;
        network.textContent = message;
        if (app.mode === 'ar') app.notice(message);
    }
    addEventListener('offline',() => showNetwork(false));
    addEventListener('online',() => showNetwork(true));
    if (!navigator.onLine) showNetwork(false);

    app.waitExhibitReady = () => new Promise((resolve,reject) => {
        const timer = setTimeout(() => reject(Error('资源准备超时。请检查网络，然后重试加载。')),15000);
        app.ready.then(resolve,reject).finally(() => clearTimeout(timer));
    });

    const start = app.start;
    const seenTracks = new WeakSet();
    let lastTracking = performance.now();
    app.start = async options => {
        if (graphicsBroken) return;
        await start(options);
        if (app.mode !== 'ar') return;
        lastTracking = performance.now();
        const track = app.camera?.system.video?.srcObject?.getVideoTracks()[0];
        if (!track || seenTracks.has(track)) return;
        seenTracks.add(track);
        track.addEventListener('ended',() => {
            if (app.mode === 'ar' && app.camera?.system.video?.srcObject?.getVideoTracks()[0] === track) {
                app.exit('摄像头已中断。请关闭其他相机应用，再点击「开始 AR」。');
            }
        },{once:true});
    };

    app.ready.then(() => {
        scene.canvas.addEventListener('webglcontextlost',() => {
            if (app.disposed) return;
            graphicsBroken = true;
            startButton.hidden = true;
            reload.hidden = false;
            updateAdvice();
        });
    },() => {});

    const navigate = app.navigate;
    app.navigate = value => {
        const url = new URL(value,location.href);
        if (url.origin === location.origin && /\/(?:codex|xr)\.html$/.test(url.pathname)) {
            url.searchParams.set('exhibit','1');
        }
        return navigate(url.href);
    };

    const controls = document.querySelector('#reality-panel .reality-controls');
    if (controls) {
        const center = document.createElement('button');
        center.id = 'btn-exhibit-center';
        center.type = 'button';
        center.textContent = '居中怪兽';
        center.style.cssText = 'min-height:44px;padding:6px 10px;border:1px solid #42606e;border-radius:5px;color:var(--spirit-cyan);background:transparent';
        center.addEventListener('click',() => {
            if (app.mode !== 'ar' || !isDetached) return;
            try {
                configureDetachedFrame(true);
                updateCardVisuals(performance.now());
            } catch (error) { app.notice(error.message); }
        });
        controls.append(center);
    }

    const timer = setInterval(() => {
        if (app.mode !== 'ar' || isDetached || cardViews.some(view => view.tracked) || lossGraceTimer !== null) {
            lastTracking = performance.now();
            return;
        }
        if (performance.now() - lastTracking >= 8000) {
            guide.textContent = '还没识别到卡牌。请平放并让四角都入镜，避开强光反射。';
        }
    },1000);
    addEventListener('pagehide',event => {
        if (event.persisted) return;
        clearInterval(timer);
        observer.disconnect();
    });
})();
