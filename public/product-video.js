'use strict';
window.ProductVideo={
 products:new Map(),
 register(products){for(const p of products)this.products.set(p.id,p)},
 button(p){return p.options?.videoUrl?`<button type="button" class="product-video-button" data-product-video="${p.id}" aria-label="ویدیوی معرفی ${Daya.escape(p.name)}">▶ معرفی ویدیویی</button>`:''},
 open(p){
  if(!p?.options?.videoUrl)return;document.querySelector('#productVideoDialog')?.remove();
  const E=Daya.escape,dialog=document.createElement('dialog');dialog.id='productVideoDialog';dialog.className='size-guide-dialog';dialog.setAttribute('aria-label','ویدیوی معرفی '+p.name);
  dialog.innerHTML=`<button class="dialog-close" aria-label="بستن ویدیو">×</button><h2>${E(p.name)}</h2><video class="product-video-player" controls playsinline preload="metadata" poster="${E(p.imageUrl)}" src="${E(p.options.videoUrl)}">مرورگر شما پخش ویدیو را پشتیبانی نمی‌کند.</video>${p.options.videoCaption?'<p class="product-video-transcript">'+E(p.options.videoCaption)+'</p>':''}`;
  document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.querySelector('video').pause());dialog.showModal();
 }
};
document.addEventListener('click',e=>{const button=e.target.closest('[data-product-video]');if(button)ProductVideo.open(ProductVideo.products.get(Number(button.dataset.productVideo)))});
