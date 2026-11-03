/* Test-package-only setup. Runs before the unchanged scanner dependencies. */
(function(){
 const p=new URLSearchParams(location.search),mode=p.get('mode')==='quality'?'quality':'tracking';
 const quality=mode==='tracking'?'original':(['original','a','b'].includes(p.get('quality'))?p.get('quality'):'original');
 const tracking=mode==='quality'?'legacy':(p.get('tracking')==='balanced'?'balanced':'legacy');
 p.set('mode',mode);p.set('quality',quality);p.set('tracking',tracking);p.set('diag','1');p.set('lighting','off');p.delete('preload');
 history.replaceState(null,'',location.pathname+'?'+p.toString());
 window.SpiritReviewSession={mode,quality,tracking,labels:{original:'Original',a:'Candidate A',b:'Candidate B'}};
})();
