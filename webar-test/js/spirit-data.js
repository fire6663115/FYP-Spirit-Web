/* Shared catalogue, legacy migration and local discovery progress. No network service. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function hash(text){let h=2166136261;for(const c of text){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
 function newId(prefix='monster'){return prefix+'-'+(root.crypto?.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
 function assetPath(value,optional=false){
    if(optional&&!value)return '';
    let decoded;try{decoded=decodeURIComponent(typeof value==='string'?value.trim():value).trim();}catch(_){throw Error('资源路径编码无效。');}
    if(typeof value!=='string'||!value.trim()||/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(decoded)||decoded.split(/[\\/]/).includes('..')||/[?#\x00-\x1f]/.test(decoded))throw Error('资源必须是项目内的相对文件路径，不能是电脑路径、临时 Blob 或外站地址。');
    return value.trim();
 }
 const displayName=m=>m.nameZh+(m.nameEn?' ('+m.nameEn+')':'');
 function validate(raw){
    if(!raw||!Array.isArray(raw.monsters)||!Array.isArray(raw.cards)||!raw.monsters.length||!raw.cards.length)throw Error('配置需要怪兽和卡牌资料。');
    assetPath(raw.mindFile);
    if(!raw.mindFile.toLowerCase().endsWith('.mind'))throw Error('识别库必须是 .mind 文件。');
    const ids=new Set(),indices=new Set(),cards=new Set();
    for(const m of raw.monsters){
        if(typeof m.id!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(m.id)||ids.has(m.id))throw Error('怪兽 ID 缺失、无效或重复。');ids.add(m.id);
        if(typeof m.nameZh!=='string'||!m.nameZh.trim())throw Error('请填写怪兽中文名称。');
        if(['nameEn','tier','intro','story'].some(k=>typeof m[k]!=='string'))throw Error('名称、介绍和故事必须是文字。');
        if(!Number.isFinite(m.power)||m.power<0)throw Error('纯灵值必须是非负数。');
        if(!Number.isFinite(m.realityHeightM)||m.realityHeightM<=0||m.realityHeightM>1000000)throw Error('现实身高需大于 0、不超过 1,000,000 米（精度保护）。');
        if(!assetPath(m.modelUrl).toLowerCase().endsWith('.glb'))throw Error('模型路径必须是 .glb 文件。');
        assetPath(m.cardImage||'',true);
        if(!Array.isArray(m.skills)||m.skills.some(s=>typeof s.name!=='string'||typeof s.description!=='string'))throw Error('技能需要名称和说明。');
        if(!m.world||Array.isArray(m.world)||typeof m.world!=='object')throw Error('世界观字段需要键值资料。');
    }
    for(const c of raw.cards){
        if(typeof c.id!=='string'||!c.id||cards.has(c.id))throw Error('卡牌 ID 缺失或重复。');cards.add(c.id);
        if(!ids.has(c.monsterId))throw Error('卡牌引用了不存在的怪兽 ID。');
        if(!Number.isInteger(c.targetIndex)||c.targetIndex<0||indices.has(c.targetIndex))throw Error('识别编号必须是不同的非负整数。');indices.add(c.targetIndex);
        if(Number.isInteger(raw.targetCount)&&c.targetIndex>=raw.targetCount)throw Error('卡牌编号超出识别库清单，请先按顺序重新编译卡图。');
        if(!Number.isFinite(c.scale)||c.scale<=0||c.scale>1000)throw Error('卡牌展示缩放无效。');
        if(['posX','posY','posZ','rotY'].some(k=>!Number.isFinite(c[k])))throw Error('位置与旋转必须是有限数字。');
        if(c.rotX!==90)throw Error('本项目卡牌固定平放 X=90°。');
    }
    if(raw.compiledTargets){
        if(!Array.isArray(raw.compiledTargets)||raw.compiledTargets.length!==raw.targetCount)throw Error('编译图片清单数量不一致。');
        for(const item of raw.compiledTargets){const card=raw.cards.find(c=>c.targetIndex===item.targetIndex);if(!card||card.id!==item.cardId||card.monsterId!==item.monsterId)throw Error('识别编号映射已改变，请重新编译图片清单。');}
    }
    return true;
 }
 function normalize(input){
    const raw=clone(input);let migrated=false;
    if(raw.schemaVersion&&raw.schemaVersion>2)throw Error('此配置版本较新，请使用匹配的工作台，避免误改资料。');
    if(!Array.isArray(raw.monsters)){
        migrated=true;raw.monsters=[];raw.cards=(raw.cards||[]).map((c,i)=>{
            const parts=/^(.*?)\s*\(([^)]+)\)\s*$/.exec(c.name||'');
            const id=c.monsterId||'legacy-'+hash((c.name||'')+'|'+c.modelUrl);
            if(!raw.monsters.some(m=>m.id===id))raw.monsters.push({id,nameZh:parts?parts[1].trim():(c.name||'未命名'),nameEn:parts?parts[2]:'',tier:c.tier||'',power:Number(c.power)||0,realityHeightM:c.realityHeightM??3,realityHeightProvisional:c.realityHeightM===undefined,intro:'',story:'',skills:c.desc?[{name:'专属奥义',description:c.desc}]:[],modelUrl:c.modelUrl,cardImage:c.cardImage||'',world:{}});
            return{id:c.id||'card-'+hash(id+'|'+i),monsterId:id,targetIndex:c.targetIndex,scale:c.scale??.85,posX:c.posX??0,posY:c.posY??0,posZ:c.posZ??.005,rotX:90,rotY:c.rotY??0};
        });
    }
    raw.schemaVersion=2;
    raw.monsters=raw.monsters.map(m=>({nameEn:'',tier:'',power:0,realityHeightM:3,intro:'',story:'',skills:[],cardImage:'',world:{},...m,realityHeightProvisional:m.realityHeightM===undefined?true:!!m.realityHeightProvisional}));
    raw.cards=raw.cards.map(c=>({scale:.85,posX:0,posY:0,posZ:.005,rotX:90,rotY:0,...c}));
    validate(raw);
    const byId=new Map(raw.monsters.map(m=>[m.id,m]));
    return{...raw,migrated,cards:raw.cards.map(c=>{const m=byId.get(c.monsterId);return{...c,name:displayName(m),tier:m.tier,power:m.power,desc:m.intro||m.skills.map(s=>s.name+'：'+s.description).join('\n'),modelUrl:m.modelUrl,monster:m};})};
 }
 function serialize(editor){
    const out={...clone(editor),schemaVersion:2};delete out.migrated;
    out.cards=out.cards.map(({name,tier,power,desc,modelUrl,monster,...c})=>c);
    validate(out);
    // Read-only compatibility projection for an older scanner still cached by a
    // browser. New pages always resolve authoritative records from monsters.
    out.cards=normalize(out).cards.map(({monster,...card})=>card);
    out.compatibility={...(typeof out.compatibility==='object'?out.compatibility:{}),legacyCardFields:'derived-from-monsters'};
    return out;
 }
 async function load(url='./cards_config.json'){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('无法读取怪兽配置：HTTP '+response.status);return normalize(await response.json());}
    catch(error){if(error.name==='AbortError')throw Error('读取怪兽资料超时，请检查网络后重试。');throw error;}
    finally{clearTimeout(timer);}
 }
 class UnlockStore{
    constructor(storage,key='the-spirit.webar.discoveries.v1'){
        this.storage=storage;this.key=key;this.records={};this.persistent=true;
        try{const d=JSON.parse(storage.getItem(key)||'{}');if(d&&typeof d==='object'&&!Array.isArray(d))this.records=d;}
        catch(_){this.persistent=false;}
    }
    has(id){return typeof this.records[id]==='string';}
    unlock(id,catalog){
        if(!catalog.monsters.some(m=>m.id===id))throw Error('无法解锁不存在的怪兽。');
        if(this.has(id))return false;
        this.records[id]=new Date().toISOString();
        try{this.storage.setItem(this.key,JSON.stringify(this.records));}catch(_){this.persistent=false;}
        return true;
    }
 }
 root.SpiritData={normalize,serialize,validate,load,assetPath,displayName,newId,UnlockStore};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.SpiritData;
})(typeof window==='undefined'?globalThis:window);
