/* Read-only animated geometry measurement. Never recentres or rescales the GLB. */
(function(root){
 'use strict';
 function measure(object,THREE){
    if(object.parent)object.parent.updateWorldMatrix(true,false);
    object.updateMatrixWorld(true);
    const inverse=object.matrixWorld.clone().invert(),min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity),point=new THREE.Vector3();
    let vertices=0;
    object.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});
    object.traverseVisible(n=>{if(!n.isMesh||!n.geometry?.attributes.position)return;
        for(let i=0;i<n.geometry.attributes.position.count;i++){
            n.getVertexPosition(i,point);point.applyMatrix4(n.matrixWorld).applyMatrix4(inverse);
            if(![point.x,point.y,point.z].every(Number.isFinite))continue;
            min.min(point);max.max(point);vertices++;
        }
    });
    const height=max.y-min.y,radius=min.distanceTo(max)*0.5;
    if(!vertices||!Number.isFinite(height)||height<=1e-7||!Number.isFinite(radius))throw Error('模型没有可测量的有效高度，请检查几何或坐标。');
    return{min,max,height,center:min.clone().add(max).multiplyScalar(.5),radius:radius*1.18,vertices};
 }
 function heightScale(heightM,envelope){
    if(!Number.isFinite(heightM)||heightM<=0||heightM>1000000)throw Error('现实身高需大于 0 且不超过 1,000,000 米；这是数值精度保护，非世界观上限。');
    if(!envelope||!Number.isFinite(envelope.height)||envelope.height<=1e-7)throw Error('模型高度不可用。');
    return heightM/envelope.height;
 }
 root.SpiritGeometry={measure,heightScale};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritGeometry;
})(typeof window==='undefined'?globalThis:window);
