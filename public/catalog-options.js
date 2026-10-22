(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Catalog=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const colors=p=>p.options?.colors||[];
 const color=(p,id)=>colors(p).find(c=>c.id===id);
 const key=c=>JSON.stringify([Number(c.id),c.variant,c.colorId||'']);
 const valid=(p,c)=>!!p&&p.variants.includes(c.variant)&&(colors(p).length?!!color(p,c.colorId):!c.colorId);
 const stock=(p,variant,colorId)=>colors(p).length?Number(color(p,colorId)?.stock?.[variant]||0):p.stock;
 function canAdd(p,cart,c,qty=1){return valid(p,c)&&Number.isInteger(qty)&&qty>0&&cart.filter(x=>x.id===p.id).reduce((s,x)=>s+x.qty,0)+qty<=Math.min(99,p.stock)&&(!colors(p).length||cart.filter(x=>key(x)===key(c)).reduce((s,x)=>s+x.qty,0)+qty<=stock(p,c.variant,c.colorId))}
 const label=(p,c)=>[c.variant,c.colorName||color(p,c.colorId)?.name].filter(Boolean).join(' · ');
 const image=(p,c)=>color(p,c.colorId)?.imageUrl||p.imageUrl;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function dots(p){return colors(p).length?'<div class="catalog-colors" aria-label="رنگ‌بندی">'+colors(p).map(c=>'<span class="catalog-dot '+(Object.values(c.stock).some(n=>n>0)?'':'sold-out')+'" style="--swatch:'+(/^#[a-f0-9]{6}$/i.test(c.hex)?c.hex:'#888888')+'" title="'+esc(c.name)+'" aria-label="'+esc(c.name)+'"></span>').join('')+'</div>':''}
 return{colors,color,key,valid,stock,canAdd,label,image,dots};
});
