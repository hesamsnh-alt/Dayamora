'use strict';
(()=>{
 document.querySelectorAll?.('[data-route]').forEach(card=>{card.addEventListener('click',e=>{if(!e.target.closest('a,button,input,label,select'))location.assign(card.dataset.route)});card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();location.assign(card.dataset.route)}})});
 const root=document.getElementById('campaignSlider');if(!root)return;
 const slides=[...root.querySelectorAll('[data-slide]')],dots=[...root.querySelectorAll('[data-slide-to]')];
 const pause=document.getElementById('slidePause'),status=document.getElementById('slideStatus');
 let index=0,timer=null,paused=false;const delay=Number(root.dataset.interval)||5000;
 function stop(){if(timer!==null){clearTimeout(timer);timer=null}}
 function schedule(){stop();if(!paused&&!document.hidden)timer=setTimeout(()=>{show(index+1);schedule()},delay)}
 function show(next){index=(next+slides.length)%slides.length;slides.forEach((s,i)=>{s.hidden=i!==index;s.setAttribute('aria-hidden',String(i!==index))});dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===index)));status.textContent=`اسلاید ${index+1} از ${slides.length}`;root.dataset.active=String(index)}
 function go(next){show(next);schedule()}
 document.getElementById('slidePrev').addEventListener('click',()=>go(index-1));
 document.getElementById('slideNext').addEventListener('click',()=>go(index+1));
 dots.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.slideTo))));
 pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'ادامه پخش خودکار':'توقف پخش خودکار');pause.setAttribute('aria-pressed',String(paused));schedule()});
 // Keep keyboard focus on its current slide; autoplay resumes after focus leaves.
 root.addEventListener('focusin',stop);root.addEventListener('focusout',()=>{if(!root.contains(document.activeElement))schedule()});
 root.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();go(index+1)}if(e.key==='ArrowRight'){e.preventDefault();go(index-1)}});
 document.addEventListener('visibilitychange',schedule);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',schedule);
 show(0);schedule();
})();
