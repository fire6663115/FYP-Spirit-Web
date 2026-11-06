(function(root){
 'use strict';let token=0,resultUrl=null;
 function coverRect(sourceWidth,sourceHeight,width,height){
    if(![sourceWidth,sourceHeight,width,height].every(v=>Number.isFinite(v)&&v>0))throw Error('摄像头画面尺寸尚未就绪。');
    const scale=Math.max(width/sourceWidth,height/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale;
    return{left:(width-w)/2,top:(height-h)/2,width:w,height:h};
 }
 function outputSize(width,height,dpr,maxPixels=4000000){if(![width,height,maxPixels].every(v=>Number.isFinite(v)&&v>0))throw Error('照片尺寸无效。');const scale=Math.min(Math.max(1,dpr||1),Math.sqrt(maxPixels/(width*height)));return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale};}
 function close(){token++;if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl=null;}if(root.document){document.getElementById('photo-preview').hidden=true;document.getElementById('photo-image').removeAttribute('src');document.getElementById('photo-save').removeAttribute('href');}}
 async function capture(scene,video){
    if(!video||video.readyState<2||!video.videoWidth)throw Error('摄像头画面尚未就绪，请开始 AR 后再拍照。');
    const ticket=++token,size=outputSize(innerWidth,innerHeight,devicePixelRatio),out=document.createElement('canvas');out.width=size.width;out.height=size.height;
    const ctx=out.getContext('2d'),scaleX=size.width/innerWidth,scaleY=size.height/innerHeight;
    let rect=video.getBoundingClientRect();if(!rect.width||!rect.height)rect=coverRect(video.videoWidth,video.videoHeight,innerWidth,innerHeight);
    ctx.drawImage(video,rect.left*scaleX,rect.top*scaleY,rect.width*scaleX,rect.height*scaleY);
    // Draw in the same task to avoid an already-cleared default framebuffer.
    scene.object3D.updateMatrixWorld(true);scene.renderer.render(scene.object3D,scene.camera);const canvas=scene.canvas,view=canvas.getBoundingClientRect();
    ctx.drawImage(canvas,view.left*scaleX,view.top*scaleY,view.width*scaleX,view.height*scaleY);
    const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('浏览器无法生成照片，请重试。')),'image/png'));
    if(ticket!==token)return false;
    if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(blob);
    const image=document.getElementById('photo-image'),save=document.getElementById('photo-save');image.src=resultUrl;save.href=resultUrl;save.download='THE_SPIRIT_'+Date.now()+'.png';document.getElementById('photo-preview').hidden=false;
    return{width:out.width,height:out.height};
 }
 root.SpiritPhoto={coverRect,outputSize,capture,close,cancel:close};if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritPhoto;
})(typeof window==='undefined'?globalThis:window);
