/* One state machine per loaded view. Native Three.js clipping supports skinning. */
(function(root){
 'use strict';
 class SummonState {
    constructor(duration=2400){this.duration=duration;this.serial=0;this.reset();}
    reset(){this.phase='waiting';this.progress=0;this.elapsed=0;this.last=null;}
    found(){if(this.phase==='waiting'){this.serial++;this.elapsed=0;this.progress=0;}this.phase=this.progress<1?'summoning':'recovering';this.last=null;}
    lost(){if(this.phase!=='waiting')this.phase='grace';this.last=null;}
    detach(){this.progress=1;this.elapsed=this.duration;this.phase='detached';this.last=null;}
    tick(now,tracked,recovering){
        if(this.phase==='waiting'||this.phase==='grace'||this.phase==='detached'||!tracked){this.last=null;return;}
        if(this.progress<1){if(this.last!==null)this.elapsed+=Math.max(0,Math.min(now-this.last,100));this.progress=Math.min(1,this.elapsed/this.duration);}
        this.last=now;this.phase=this.progress<1?'summoning':recovering?'recovering':'ready';
    }
 }
 function attach(view,reveal,THREE){
    view.reveal=reveal;view.summon=new SummonState();view.clipPlane=new THREE.Plane(new THREE.Vector3(0,0,1),1e12);
    view.localClipPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-.002);
 }
 function prepare(view,object,renderer){
    renderer.localClippingEnabled=true;
    object.traverse(n=>{if(n.isMesh){const ms=Array.isArray(n.material)?n.material:[n.material];ms.forEach(m=>{m.clippingPlanes=[view.clipPlane];m.clipShadows=false;m.needsUpdate=true;});}});
 }
 function update(view,now,detached){
    if(!view.summon||!view.modelEnvelope)return;
    if(detached){view.summon.detach();view.reveal.object3D.position.y=0;view.clipPlane.constant=1e12;view.shadow.summonOpacity=1;return;}
    view.summon.tick(now,view.tracked,!!view.recovery);
    const p=view.summon.progress,eased=p*p*(3-2*p),scale=Math.max(view.pivot.object3D.scale.y,1e-7);
    // Reserve animated-pose headroom while letting the body emerge before halfway.
    const offset=view.modelEnvelope.max.y+view.modelEnvelope.height*.5+Math.max(0,(view.pivot.object3D.position.z-.002)/scale)+.01;
    view.reveal.object3D.position.y=-offset*(1-eased);
    view.root.object3D.updateWorldMatrix(true,false);
    view.clipPlane.copy(view.localClipPlane).applyMatrix4(view.root.object3D.matrixWorld);
    view.shadow.summonOpacity=eased;
 }
 root.SpiritSummon={SummonState,attach,prepare,update};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritSummon;
})(typeof window==='undefined'?globalThis:window);
