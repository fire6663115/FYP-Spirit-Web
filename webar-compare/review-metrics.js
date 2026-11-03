(function(root){
 'use strict';
 class Metrics{
  constructor(){this.manual=null;this.gap=null;this.hadFresh=false;this.recovery=null;this.round=1;this.initialQuality=null;this.qualityChanged=false;}
  reset(){this.manual=null;this.gap=null;this.hadFresh=false;this.recovery=null;this.initialQuality=null;this.qualityChanged=false;this.round++;}
  markEntry(t){this.manual=t;}
  observe(fresh,t){if(fresh){if(this.gap!==null)this.recovery={ms:t-this.gap,start:this.gap,end:t};this.hadFresh=true;this.gap=null;}else if(this.hadFresh&&this.gap===null)this.gap=t;}
  snapshot(report,fps,quality){
   const events=report.events||[],find=name=>events.find(e=>e.name===name);
   const origin=this.manual??find('mindar_ready')?.t??find('start_clicked')?.t??0;
   const first=find('first_engine_match'),visible=events.find(e=>e.name==='summon_first_visible_estimate'&&e.t>=origin),found=events.find(e=>e.name==='target_found'&&e.t>=origin);
   const valid=!(this.manual!==null&&first&&first.t<origin),delta=e=>valid&&e&&e.t>=origin?e.t-origin:null;
   let lost=null,eventRecovery=null;for(const e of events){if(e.name==='target_lost')lost=e.t;if(e.name==='target_found'&&lost!==null){eventRecovery=e.t-lost;lost=null;}}
   if(!this.initialQuality&&quality)this.initialQuality=quality;if(quality&&this.initialQuality!==quality)this.qualityChanged=true;
   return{round:this.round,originMs:origin,originKind:this.manual===null?'MindAR ready / scan start':'manual card-entry mark; includes human action',recognitionMs:delta(first),foundMs:delta(found),firstVisibleEstimateMs:delta(visible),nativeRecoveryMs:this.recovery?.ms??null,targetEventRecoveryMs:eventRecovery,freshPoseFPS:report.tracking?.freshPoseFPS??0,processFPS:report.tracking?.processFPS??0,poseToRenderAgeMs:report.tracking?.latestPoseToRenderMs??null,renderFPS:Number.isFinite(fps)?fps:null,quality,qualityChanged:this.qualityChanged,invalidManual:!valid};
  }
 }
 root.SpiritReviewMetrics=Metrics;if(typeof module!=='undefined'&&module.exports)module.exports=Metrics;
})(typeof window==='undefined'?globalThis:window);
