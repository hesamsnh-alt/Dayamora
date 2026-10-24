'use strict';
window.ProductVideo={
 products:new Map(),
 register(products){for(const p of products)this.products.set(p.id,p)},
 preview(root,p,{src=p?.options?.videoUrl,poster=p?.imageUrl||''}={}){
  if(!root)return;root._videoPreview?.destroy();root.replaceChildren();root.hidden=!src;
  if(!src||!(/^(?:https:\/\/|blob:|\/uploads\/)/.test(src)))return;
  const E=Daya.escape;
  root.innerHTML=`<section class="product-video-preview" aria-label="پیش‌نمایش ویدیوی ${E(p?.name||'محصول')}"><div class="video-preview-top"><span>ویدیوی محصول</span><button type="button" data-preview-close aria-label="بستن پیش‌نمایش ویدیو">×</button></div><video autoplay muted loop playsinline preload="metadata" poster="${E(poster)}" aria-label="ویدیوی ${E(p?.name||'محصول')}"></video><div class="video-preview-actions"><button type="button" data-preview-play aria-label="توقف ویدیو">توقف</button><button type="button" data-preview-sound aria-label="روشن کردن صدای ویدیو" aria-pressed="false">صدا</button><button type="button" data-preview-expand aria-label="بزرگ‌نمایی ویدیو" aria-expanded="false">⤢</button></div><p class="video-preview-status" role="status" hidden></p></section>`;
  const box=root.querySelector('section'),video=root.querySelector('video'),play=root.querySelector('[data-preview-play]'),sound=root.querySelector('[data-preview-sound]'),status=root.querySelector('[role="status"]');
  let disposed=false,pausedByUser=false,visible=true,failed=false;
  video.muted=true;video.defaultMuted=true;video.src=src;
  function update(){play.textContent=video.paused?'پخش':'توقف';play.setAttribute('aria-label',video.paused?'پخش ویدیو':'توقف ویدیو')}
  function start(){if(disposed||pausedByUser||!visible||document.hidden||failed)return;const attempt=video.play();attempt?.catch(error=>{if(!disposed&&!video.error&&error?.name!=='AbortError'){status.textContent='برای پخش لمس کنید';status.hidden=false;update()}})}
  video.addEventListener('play',()=>{status.hidden=true;update()});video.addEventListener('pause',update);
  video.addEventListener('error',()=>{failed=true;status.textContent='ویدیو بارگیری نشد.';status.hidden=false;play.disabled=true});
  play.onclick=()=>{pausedByUser=!video.paused;if(pausedByUser)video.pause();else start()};
  sound.onclick=()=>{video.muted=!video.muted;sound.textContent=video.muted?'صدا':'بی‌صدا';sound.setAttribute('aria-pressed',String(!video.muted));sound.setAttribute('aria-label',video.muted?'روشن کردن صدای ویدیو':'بی‌صدا کردن ویدیو')};
  root.querySelector('[data-preview-expand]').onclick=e=>{const expanded=box.classList.toggle('expanded');e.currentTarget.setAttribute('aria-expanded',String(expanded));e.currentTarget.setAttribute('aria-label',expanded?'کوچک کردن ویدیو':'بزرگ‌نمایی ویدیو')};
  const visibility=()=>{if(document.hidden)video.pause();else start()};document.addEventListener('visibilitychange',visibility);
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;if(visible)start();else video.pause()},{threshold:.1}):null;
  function destroy(){if(disposed)return;disposed=true;observer?.disconnect();document.removeEventListener('visibilitychange',visibility);video.pause();video.removeAttribute('src');video.load();delete root._videoPreview}
  root.querySelector('[data-preview-close]').onclick=()=>{destroy();root.replaceChildren();root.hidden=true};
  const controller={destroy};root._videoPreview=controller;observer?.observe(root);start();return controller;
 },
 button(p){return p.options?.videoUrl?`<button type="button" class="product-video-button" data-product-video="${p.id}" aria-label="ویدیوی معرفی ${Daya.escape(p.name)}">▶ معرفی ویدیویی</button>`:''},
 open(p){
  if(!p?.options?.videoUrl)return;document.querySelector('#productVideoDialog')?.remove();
  const E=Daya.escape,dialog=document.createElement('dialog');dialog.id='productVideoDialog';dialog.className='size-guide-dialog';dialog.setAttribute('aria-label','ویدیوی معرفی '+p.name);
  dialog.innerHTML=`<button class="dialog-close" aria-label="بستن ویدیو">×</button><h2>${E(p.name)}</h2><video class="product-video-player" controls playsinline preload="metadata" poster="${E(p.imageUrl)}" src="${E(p.options.videoUrl)}">مرورگر شما پخش ویدیو را پشتیبانی نمی‌کند.</video>${p.options.videoCaption?'<p class="product-video-transcript">'+E(p.options.videoCaption)+'</p>':''}`;
  document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.querySelector('video').pause());dialog.showModal();
 }
};
document.addEventListener('click',e=>{const button=e.target.closest('[data-product-video]');if(button)ProductVideo.open(ProductVideo.products.get(Number(button.dataset.productVideo)))});
