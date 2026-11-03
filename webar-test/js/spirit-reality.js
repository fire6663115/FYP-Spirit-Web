/* Metre settings and compatibility framing. Compatibility is not world tracking. */
(function(root){
 'use strict';
 function frame(envelope,camera,settings,THREE){
    const modelScale=SpiritGeometry.heightScale(settings.heightM,envelope),distance=settings.distanceM;
    if(!Number.isFinite(distance)||distance<.5||distance>10000000)throw Error('近似构图距离需在 0.5～10,000,000 米之间。');
    const radius=envelope.radius*modelScale,closest=Math.max(.1,distance-Math.min(radius,distance*.8));
    const unit=Math.max(1,camera.near*4/closest),upper=camera.far*.8/(distance+radius);
    if(unit>upper)throw Error('此身高与距离超出兼容镜头范围。请增加构图距离，或使用支持的空间 AR；身高没有被自动缩小。');
    const halfV=THREE.MathUtils.degToRad(camera.fov)/2,halfH=Math.atan(Math.tan(halfV)*camera.aspect);
    const angle=THREE.MathUtils.degToRad(settings.yaw||0),cos=Math.cos(angle),sin=Math.sin(angle);
    let minX=Infinity,maxX=-Infinity;
    for(const x of[envelope.min.x,envelope.max.x])for(const z of[envelope.min.z,envelope.max.z]){const v=(x*cos+z*sin)*modelScale;minX=Math.min(minX,v);maxX=Math.max(maxX,v);}
    const margin=Math.min(.1,distance*.01),halfW=distance*Math.tan(halfH),halfHeight=distance*Math.tan(halfV);
    const centerX=(minX+maxX)*.5;
    // Keep the model's centre within the image; permitting the whole bounding
    // width beyond an edge can lose a narrow rotated silhouette completely.
    const x=THREE.MathUtils.clamp((settings.x||0)+centerX,-halfW*.8,halfW*.8)-centerX;
    const y=THREE.MathUtils.clamp(settings.y??-1.6,-halfHeight-envelope.max.y*modelScale+margin,halfHeight-envelope.min.y*modelScale-margin);
    return{modelScale,unit,x,y,z:-distance,radius};
 }
 function pan(camera,distance,dx,dy,width,height){return{x:dx*distance*2*Math.tan(Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect))/Math.max(width,1),y:-dy*distance*2*Math.tan(camera.fov*Math.PI/360)/Math.max(height,1)};}
 root.SpiritReality={frame,pan};if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritReality;
})(typeof window==='undefined'?globalThis:window);
