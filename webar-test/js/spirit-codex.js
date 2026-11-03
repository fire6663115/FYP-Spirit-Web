(function(){
 'use strict';const $=id=>document.getElementById(id);let viewer=null,version=0,storage;
 try{storage=localStorage;}catch(_){}
 const app={catalog:null,store:new SpiritData.UnlockStore(storage)};window.SpiritCodex=app;
 app.getViewer=()=>viewer;
 function field(title,value){const section=document.createElement('section');section.className='codex-field';const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=value===null||value===undefined||value===''?'资料待作者补充':typeof value==='object'?JSON.stringify(value,null,2):String(value);section.append(h,p);return section;}
 app.render=()=>{
    const grid=$('codex-grid');grid.replaceChildren();
    for(const monster of app.catalog.monsters){
        const unlocked=app.store.has(monster.id),button=document.createElement('button');button.className='codex-record';button.dataset.monsterId=monster.id;button.disabled=!unlocked;
        const name=document.createElement('strong'),label=document.createElement('small');name.textContent=unlocked?SpiritData.displayName(monster):'???';label.textContent=unlocked?'已发现 · 查看资料与模型':'未发现 · 扫描实体卡牌解锁';
        if(unlocked&&monster.cardImage){const image=document.createElement('img');image.src=monster.cardImage;image.alt='已发现怪兽的卡牌预览';image.loading='lazy';button.append(image);}
        else{const placeholder=document.createElement('span');placeholder.className='codex-placeholder';placeholder.textContent=unlocked?'灵':'?';button.append(placeholder);}
        button.append(name,label);button.addEventListener('click',()=>app.open(monster.id));grid.append(button);
    }
    $('codex-status').textContent='已发现 '+app.catalog.monsters.filter(m=>app.store.has(m.id)).length+' / '+app.catalog.monsters.length+(app.store.persistent?'':' · 本浏览器无法可靠保存进度');
 };
 app.close=()=>{version++;viewer?.close();viewer=null;$('codex-detail').hidden=true;$('codex-grid').hidden=false;$('codex-model').replaceChildren();app.render();};
 app.open=async id=>{
    const monster=app.catalog.monsters.find(m=>m.id===id);if(!monster||!app.store.has(id))return false;
    version++;const token=version;viewer?.close();$('codex-model').replaceChildren();$('codex-grid').hidden=true;$('codex-detail').hidden=false;
    $('detail-title').textContent=SpiritData.displayName(monster);
    const fields=$('detail-fields');fields.replaceChildren();
    fields.append(field('纯灵等级 / 纯灵值',monster.tier+' / '+monster.power),field('设定现实身高',monster.realityHeightM+' 米'+(monster.realityHeightProvisional?'（系统初值，待作者设定）':'')),field('怪兽介绍',monster.intro),field('背景故事',monster.story));
    monster.skills.forEach(s=>fields.append(field(s.name||'技能',s.description)));
    Object.entries(monster.world).forEach(([key,value])=>fields.append(field(key,value)));
    fields.append(field('关联卡牌识别编号',app.catalog.cards.filter(c=>c.monsterId===id).map(c=>c.targetIndex).join('、')));
    $('model-status').textContent='正在准备此怪兽的模型…';
    const selected=new SpiritViewer.ModelViewer($('codex-model'));viewer=selected;
    try{await selected.load(monster.modelUrl);if(token===version)$('model-status').textContent='左右拖动旋转。此为图鉴预览，不代表现实大小。';}
    catch(error){selected.close();if(token===version)$('model-status').textContent='模型暂不可用：'+error.message+'。文字资料仍可查看。';}
    return true;
 };
 $('codex-close').addEventListener('click',()=>app.close());window.addEventListener('pagehide',()=>viewer?.close());
 window.addEventListener('storage',()=>{app.store=new SpiritData.UnlockStore(storage);if(!$('codex-detail').hidden)app.close();else app.render();});
 app.ready=SpiritData.load().then(data=>{app.catalog=data;app.render();return data;}).catch(error=>{$('codex-status').textContent=error.message;throw error;});
 app.ready.catch(()=>{});
})();
