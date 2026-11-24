'use strict';
(()=>{
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.visibilityState==='hidden')return;
 try{
  const key='dayamora-intro-black-friday-2026';
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,'1');
 }catch{return}
 let intro=document.getElementById('first-visit-intro');
 if(!intro){
  intro=document.createElement('div');intro.id='first-visit-intro';intro.className='first-visit-intro';intro.hidden=true;
  intro.innerHTML='<video width="496" height="496" muted playsinline preload="none" aria-hidden="true"></video><button type="button">رد کردن</button>';
  document.body.prepend(intro);
 }
 const video=intro.querySelector('video'),skip=intro.querySelector('button');
 const close=()=>{clearTimeout(timeout);intro.hidden=true;video.pause();};
 const timeout=setTimeout(close,1900);
 intro.hidden=false;
 skip.addEventListener('click',close,{once:true});
 video.addEventListener('ended',close,{once:true});
 video.addEventListener('error',close,{once:true});
 addEventListener('pagehide',close,{once:true});
 video.src='/assets/first-visit-intro.mp4';
 video.play().catch(close);
})();

addEventListener('DOMContentLoaded',()=>{
 const video=document.getElementById('homeAnimation');
 if(!video||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const intro=document.getElementById('first-visit-intro');
 const play=()=>{video.muted=true;video.play().catch(()=>{});};
 if(!intro||intro.hidden){play();return;}
 const observer=new MutationObserver(()=>{
  if(!intro.hidden)return;
  observer.disconnect();
  play();
 });
 observer.observe(intro,{attributes:true,attributeFilter:['hidden']});
},{once:true});
