(function(){
 'use strict';const session=SpiritReviewSession,metrics=new SpiritReviewMetrics();let assets,started=null,disposed=false,lastMode=null;
 document.getElementById('btn-start-ar').disabled=true;
 const panel=document.createElement('details');panel.id='review-test-panel';panel.open=true;panel.dataset.spiritUi='';
 panel.innerHTML='<summary id="test-title"></summary><p id="test-state">等候开始 AR…</p><p id="test-note">模型首露是裁切几何估计；识别计时不含 2.4 秒召唤。</p><dl><dt>首次匹配</dt><dd id="metric-match">—</dd><dt>targetFound</dt><dd id="metric-found">—</dd><dt>模型首露（估计）</dt><dd id="metric-visible">—</dd><dt>新鲜跟踪恢复</dt><dd id="metric-recovery">—</dd><dt>丢失事件→找回事件</dt><dd id="metric-events">—</dd><dt>新鲜位姿 / 处理</dt><dd id="metric-update">—</dd><dt>更新→绘制年龄</dt><dd id="metric-age">—</dd><dt>渲染 FPS / 画质</dt><dd id="metric-fps">—</dd></dl><p id="test-warning" class="warning"></p><button id="test-mark">标记卡片入镜</button><button id="test-restart">遮住卡片，重开本轮</button><button id="test-export">下载本轮 JSON</button><label id="test-switch-label">切换<select id="test-switch"></select></label><button id="test-home">回对比首页</button><p>前两项默认从相机识别就绪起算；可手动标记。新鲜跟踪恢复从引擎首次报告失跟起算，包含它的容错；更新年龄不是物理移动拖尾。</p>';
 const $=id=>panel.querySelector('#'+id),fmt=n=>n===null||!Number.isFinite(n)?'—':Math.round(n)+' ms';
 function nowRelative(){return performance.now()-SpiritDiagnostics.started;}
 function draw(){
  if(disposed)return;if(started!==SpiritDiagnostics.started){started=SpiritDiagnostics.started;metrics.reset();}
  const report=SpiritDiagnostics.report(),q=SpiritApp.performance.level,record=metrics.snapshot(report,SpiritApp.performance.fps,q);window.SpiritReviewTest.latest=record;
  if(lastMode!==SpiritApp.mode){panel.open=SpiritApp.mode==='ar';lastMode=SpiritApp.mode;}
  $('test-title').textContent=(session.mode==='tracking'?'追踪 '+session.tracking:'画质 '+session.labels[session.quality])+' · '+(SpiritApp.mode==='ar'?(record.renderFPS===null?'FPS 预热中':record.renderFPS.toFixed(1)+' FPS'):'未启动')+' · 展开/收起';
  const ready=!!cardViews[0]?.modelEnvelope;$('test-state').textContent=ready?'模型已准备 · '+session.labels[session.quality]:'模型未准备；首次下载请稍等';
  $('test-mark').disabled=SpiritApp.mode!=='ar'||!ready;
  $('metric-match').textContent=fmt(record.recognitionMs);$('metric-found').textContent=fmt(record.foundMs);$('metric-visible').textContent=fmt(record.firstVisibleEstimateMs);$('metric-recovery').textContent=fmt(record.nativeRecoveryMs);$('metric-events').textContent=fmt(record.targetEventRecoveryMs);
  $('metric-update').textContent=record.freshPoseFPS.toFixed(1)+' / '+record.processFPS.toFixed(1)+' 次/s';$('metric-age').textContent=fmt(record.poseToRenderAgeMs);$('metric-fps').textContent=(record.renderFPS===null?'预热中':record.renderFPS.toFixed(1))+' / '+q;
  $('test-warning').textContent=record.invalidManual?'本轮已在标记前匹配，首次计时无效。遮住卡片并重开本轮。':record.qualityChanged?'保护性画质已变化，请勿与不同实际档位直接比较。':metrics.manual===null?'当前从识别就绪计时，包含等待卡片的时间。':'已手动标记，仍包含你的动作差异。';
 }
 $('test-mark').onclick=()=>{metrics.markEntry(nowRelative());draw();};
 $('test-restart').onclick=async()=>{const button=$('test-restart');button.disabled=true;try{await SpiritApp.exit();await SpiritApp.start({fullscreen:false});}finally{button.disabled=false;draw();}};
 $('test-home').onclick=()=>SpiritApp.navigate('./index.html');
 $('test-switch-label').firstChild.textContent=session.mode==='tracking'?'追踪配置':'画质模型';
 const options=session.mode==='tracking'?[['legacy','A · Legacy'],['balanced','B · Balanced']]:Object.entries(session.labels);
 for(const[value,label]of options){const option=document.createElement('option');option.value=value;option.textContent=label;$('test-switch').append(option);}$('test-switch').value=session.mode==='tracking'?session.tracking:session.quality;
 $('test-switch').onchange=async()=>{const p=new URLSearchParams(location.search);p.set(session.mode==='tracking'?'tracking':'quality',$('test-switch').value);await SpiritApp.navigate('./scan.html?'+p.toString());};
 $('test-export').onclick=()=>{draw();const raw=SpiritDiagnostics.report(),sys=SpiritApp.camera?.system;const data={scope:'Local manual comparison, no images recorded/uploaded. First visibility is geometric estimate, not pixel validation.',session,metrics:window.SpiritReviewTest.latest,actualTracking:sys?{filterMinCF:sys.filterMinCF,filterBeta:sys.filterBeta,warmupTolerance:sys.warmupTolerance,missTolerance:sys.missTolerance}:null,assetHashes:assets?.hashes,modelUrl:cardViews[0]?.config.modelUrl,diagnostics:raw};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='spirit-'+session.mode+'-'+session.quality+'-'+session.tracking+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const test=window.SpiritReviewTest={metrics,latest:null};
 test.ready=(async()=>{
  assets=await(await fetch('./review-assets.json')).json();await SpiritApp.ready;
  if(SpiritApp.mode!=='home')throw Error('应在开始之前选择测试模型。');
  const card=cardViews[0];card.config.modelUrl=assets.models[session.quality];
  if(card.config.monster)card.config.monster.modelUrl=assets.models[session.quality];
  const update=SpiritDiagnostics.update;
  SpiritDiagnostics.update=function(controller,data){if(started!==this.started){started=this.started;metrics.reset();}if(data.type==='processDone'){const state=controller.trackingStates?.[card.config.targetIndex];if(state)metrics.observe(!!state.isTracking,nowRelative());}return update.call(this,controller,data);};
  const start=SpiritApp.start;SpiritApp.start=function(...args){if(this.mode==='home'&&!this.pending)this.performance.choose('standard');const p=start.apply(this,args);p.then(draw,draw);return p;};
  const exit=SpiritApp.exit;SpiritApp.exit=async function(...args){const result=await exit.apply(this,args);draw();return result;};
  const quality=document.getElementById('quality-select');quality.value='standard';quality.disabled=true;quality.title='测试固定标准画质；严重卡顿的保护性降档仍保留。';
  document.getElementById('btn-light-toggle').disabled=true;setEnvironmentEnabled(false);
  document.body.append(panel);document.getElementById('btn-start-ar').disabled=false;draw();return true;
 })().catch(e=>{document.body.append(panel);$('test-state').textContent='对比准备失败：'+e.message;document.getElementById('btn-start-ar').disabled=true;throw e;});
 const timer=setInterval(()=>{if(!document.hidden)draw();},500);window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);});
})();
