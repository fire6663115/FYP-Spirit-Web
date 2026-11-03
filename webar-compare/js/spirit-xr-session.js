/* Native WebXR ownership only. No emulated camera coordinates presented as tracking. */
(function(root){
 'use strict';
 class XRSessionOwner{
    constructor(xr,activate,deactivate){this.xr=xr;this.activate=activate;this.deactivate=deactivate;this.session=null;this.pending=null;this.cancelled=false;this.reference=null;this.hitSource=null;this.endHandled=false;}
    start(overlayRoot){
        if(this.pending)return this.pending;if(this.session)return Promise.resolve(this.session);this.cancelled=false;this.endHandled=false;
        // Called before any await, preserving the user activation requirement.
        let request;try{request=this.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['local-floor','anchors','dom-overlay'],...(overlayRoot?{domOverlay:{root:overlayRoot}}:{})});}catch(error){return Promise.reject(error);}
        this.pending=Promise.resolve(request).then(async session=>{
            this.session=session;session.addEventListener('end',()=>this.cleanup(),{once:true});
            if(this.cancelled){await session.end();throw new DOMException('已取消','AbortError');}
            this.referenceType='local-floor';
            this.reference=await session.requestReferenceSpace('local-floor').catch(()=>{this.referenceType='local';return session.requestReferenceSpace('local');});
            const viewer=await session.requestReferenceSpace('viewer');
            this.hitSource=await session.requestHitTestSource({space:viewer});
            if(this.cancelled){await session.end();throw new DOMException('已取消','AbortError');}
            await this.activate(session,this.reference,this.hitSource);
            if(this.cancelled)throw new DOMException('已取消','AbortError');return session;
        }).catch(async error=>{if(this.session){try{await this.session.end();}catch(_){}this.cleanup();}throw error;}).finally(()=>{this.pending=null;});
        return this.pending;
    }
    cleanup(){if(this.endHandled)return;this.endHandled=true;this.hitSource?.cancel();this.hitSource=null;this.reference=null;this.session=null;this.deactivate();}
    async stop({waitForPending=true}={}){this.cancelled=true;const session=this.session;if(session){try{await session.end();}finally{this.cleanup();}}if(this.pending&&waitForPending){try{await this.pending;}catch(_){} }this.cleanup();}
 }
 function horizontal(matrix,THREE){const normal=new THREE.Vector3(0,1,0).transformDirection(matrix);return normal.y>.94;}
 root.SpiritXR={XRSessionOwner,horizontal};if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritXR;
})(typeof window==='undefined'?globalThis:window);
