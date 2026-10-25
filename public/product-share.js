'use strict';
window.ProductShare=(()=>{
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',link:'<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',whatsapp:'<path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5A8 8 0 1 1 20 11.5Z"/><path d="M8 7c0 4 2 6 6 7l2-2-3-1-1 1-2-2 1-1-1-3Z"/>',telegram:'<path d="m2 11 20-8-4 18-6-5-4 3 1-6 9-7-11 6Z"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7"/>',x:'<path d="m4 3 16 18h-4L1 3Zm16 0L4 21"/>'};
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
 function payload(p,{origin=location.origin,canonical=''}={}){
  const id=Number(p?.id);if(!Number.isSafeInteger(id)||id<1)throw Error('شناسه محصول معتبر نیست.');
  let url=new URL('/product?id='+id,origin);
  try{const c=new URL(canonical);if(c.protocol==='https:'&&!c.username&&!c.password&&!c.port&&['/product','/product.html'].includes(c.pathname)&&c.searchParams.get('id')===String(id))url=new URL('/product?id='+id,c.origin)}catch{}
  const title=String(p.name||'محصول دایامورا').trim().slice(0,200);return{title:title+' | دایامورا',text:title+' در دایامورا',url:url.href};
 }
 function current(p){return payload(p,{canonical:document.querySelector('link[rel="canonical"]')?.href||''})}
 function links(data){return{whatsapp:'https://wa.me/?text='+encodeURIComponent(data.text+'\n'+data.url),telegram:'https://t.me/share/url?url='+encodeURIComponent(data.url)+'&text='+encodeURIComponent(data.text),x:'https://twitter.com/intent/tweet?text='+encodeURIComponent(data.text)+'&url='+encodeURIComponent(data.url)}}
 function html(p){const data=current(p),urls=links(data);return '<details class="product-share"><summary>'+icon('share')+'<span>اشتراک‌گذاری محصول</span></summary><div class="product-share-panel"><div class="product-share-actions">'+[['whatsapp','واتساپ'],['telegram','تلگرام']].map(([key,label])=>'<a class="share-'+key+'" href="'+E(urls[key])+'" target="_blank" rel="noopener noreferrer">'+icon(key)+label+'</a>').join('')+'<button type="button" class="share-instagram" data-product-share="instagram">'+icon('instagram')+'اینستاگرام</button><a href="'+E(urls.x)+'" target="_blank" rel="noopener noreferrer">'+icon('x')+'X</a><button type="button" data-product-share="copy">'+icon('link')+'کپی لینک</button><button type="button" data-product-share="more">'+icon('share')+'سایر برنامه‌ها</button></div><p class="product-share-help">برای اینستاگرام از منوی اشتراک گوشی استفاده کن؛ اگر نمایش داده نشد، لینک را کپی و در دایرکت بچسبان.</p><label class="product-share-link">لینک محصول<input type="text" readonly dir="ltr" aria-label="لینک قابل کپی محصول" value="'+E(data.url)+'"></label><p class="product-share-status" role="status" aria-live="polite"></p></div></details>'}
 async function perform(data,action,{nav=navigator}={}){
  if(action!=='copy'&&typeof nav.share==='function'){
   try{await nav.share(data);return 'shared'}catch(e){if(e?.name==='AbortError')return 'cancelled'}
  }
  try{if(typeof nav.clipboard?.writeText==='function'){await nav.clipboard.writeText(data.url);return 'copied'}}catch{}
  return 'manual';
 }
 function bind(root,p){const group=root.querySelector('.product-share');if(!group)return;group.addEventListener('click',async e=>{const button=e.target.closest('[data-product-share]');if(!button||!group.contains(button)||button.disabled)return;const action=button.dataset.productShare,status=group.querySelector('.product-share-status');button.disabled=true;status.textContent='';try{const result=await perform(current(p),action);if(result==='copied')status.textContent=action==='instagram'?'لینک کپی شد؛ در دایرکت اینستاگرام بچسبان.':'لینک محصول کپی شد.';if(result==='manual'){const input=group.querySelector('input');input.focus();input.select();status.textContent='لینک را دستی کپی کن؛ در موبایل روی لینک لمس طولانی کن.';}}catch{status.textContent='اشتراک‌گذاری انجام نشد؛ لینک محصول را کپی کن.'}finally{button.disabled=false}})}
 return{html,bind,payload,links,perform};
})();
