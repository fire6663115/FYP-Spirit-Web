/* Single selected-model preview; same approved A-Frame / Three.js version. */
(function(root){
 'use strict';let enginePromise;
 function engine(){
    if(root.AFRAME)return Promise.resolve(root.AFRAME.THREE);
    if(!enginePromise)enginePromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script'),timer=setTimeout(()=>reject(Error('3D 引擎加载超时，请检查网络。')),30000);
        script.src='https://aframe.io/releases/1.5.0/aframe.min.js';
        script.onload=()=>{clearTimeout(timer);resolve(root.AFRAME.THREE);};script.onerror=()=>{clearTimeout(timer);reject(Error('无法加载 3D 引擎。'));};document.head.appendChild(script);
    });return enginePromise;
 }
 function dispose(object){
    const gs=new Set(),ms=new Set(),ts=new Set();
    object?.traverse(n=>{if(n.geometry)gs.add(n.geometry);if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>ms.add(m));if(n.skeleton?.boneTexture)ts.add(n.skeleton.boneTexture);});
    ms.forEach(m=>Object.values(m).forEach(v=>{if(v?.isTexture)ts.add(v);}));ts.forEach(t=>t.dispose());ms.forEach(m=>m.dispose());gs.forEach(g=>g.dispose());
 }
 class ModelViewer{
    constructor(container){this.container=container;this.closed=false;this.frame=null;this.last=null;this.angle=0;this.dragging=false;this.onVisibility=()=>{if(!document.hidden&&!this.closed){this.last=null;this.animate();}else{cancelAnimationFrame(this.frame);this.frame=null;}};}
    async load(url){
        const THREE=await engine();if(this.closed)return;
        this.THREE=THREE;this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:false});this.renderer.useLegacyLights=true;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);this.scene=new THREE.Scene();
        this.scene.add(new THREE.AmbientLight(0xffffff,.6));const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(2,3,4);this.scene.add(light);
        this.camera=new THREE.PerspectiveCamera(40,1,.001,1000);
        const gltf=await new THREE.GLTFLoader().loadAsync(url);
        if(this.closed){dispose(gltf.scene);return;}
        this.model=gltf.scene;this.scene.add(this.model);this.mixer=new THREE.AnimationMixer(this.model);
        const clip=gltf.animations.find(a=>a.name.toLowerCase()==='idle')||gltf.animations[0];if(clip)this.mixer.clipAction(clip).play();this.mixer.update(0);
        this.envelope=SpiritGeometry.measure(this.model,THREE);
        const canvas=this.renderer.domElement;canvas.style.touchAction='none';
        canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.pointerX=e.clientX;canvas.setPointerCapture(e.pointerId);});
        canvas.addEventListener('pointermove',e=>{if(this.dragging){this.angle+=(e.clientX-this.pointerX)*.008;this.pointerX=e.clientX;}});
        canvas.addEventListener('pointerup',()=>{this.dragging=false;});canvas.addEventListener('pointercancel',()=>{this.dragging=false;});
        this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.container);
        document.addEventListener('visibilitychange',this.onVisibility);this.resize();this.animate();
    }
    resize(){if(!this.envelope||this.closed)return;const width=Math.max(1,this.container.clientWidth),height=Math.max(1,this.container.clientHeight),e=this.envelope;
        this.renderer.setSize(width,height);this.camera.aspect=width/height;
        const half=Math.min(Math.PI/9,Math.atan(Math.tan(Math.PI/9)*this.camera.aspect)),distance=e.radius/Math.sin(half)*1.1;
        this.camera.near=Math.max(.001,distance*.001);this.camera.far=distance+e.radius*6;
        this.camera.position.copy(e.center).add(new this.THREE.Vector3(0,e.height*.05,distance));this.camera.lookAt(e.center);this.camera.updateProjectionMatrix();
    }
    animate(){if(this.closed||document.hidden||this.frame!==null)return;
        const loop=now=>{if(this.closed||document.hidden){this.frame=null;return;}const dt=this.last===null?0:Math.min(.05,(now-this.last)/1000);this.last=now;
            this.mixer?.update(dt);if(this.model)this.model.rotation.y=this.angle;this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(loop);};
        this.frame=requestAnimationFrame(loop);
    }
    close(){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.frame);this.frame=null;this.observer?.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);
        this.mixer?.stopAllAction();if(this.model){this.mixer?.uncacheRoot(this.model);dispose(this.model);}this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer?.domElement.remove();
    }
 }
 root.SpiritViewer={engine,dispose,ModelViewer};
})(window);
