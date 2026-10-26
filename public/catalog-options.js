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
 // Store-selected body defaults from the supplied reference; not garment measurements.
 const BODY_DEFAULTS={S:{waist:'66-70',hips:'91-95',height:'165-170'},M:{waist:'70-74',hips:'95-99',height:'170-175'},L:{waist:'75-81',hips:'100-106',height:'175-180'},XL:{waist:'81-87',hips:'106-112',height:'175-180'}};
 // Indicative adult-women weight bands: umhaneen.com/size-guide (2026-10-26).
 // Its petite/regular/tall height coverage is 145–176 cm, independent of girth.
 const FIT_DEFAULTS={XS:[42,48],S:[49,55],M:[56,63],L:[64,72],XL:[73,82],'2XL':[83,93],'3XL':[94,105],'4XL':[106,118],'5XL':[119,132]};
 const sizeCode=s=>String(s).trim().toUpperCase().replace(/^XXL$/,'2XL').replace(/^XXXL$/,'3XL').replace(/^XXXXL$/,'4XL');
 function sizeGuide(p){
  const saved=JSON.parse(JSON.stringify(p.options?.sizeGuide||{}));
  if(p.cat!=='پوشاک')return saved;
  const vs=p.variants||[],body=Array.isArray(saved.body)?saved.body:[],fit=Array.isArray(saved.fit)?saved.fit:[];
  const adult=!/مردانه|پسرانه|دخترانه|کودک|بچگانه|نوزاد|\b(?:men|mens|boys|girls|kids|baby|children)\b/i.test(p.name||'');
  // An explicit saved row, including deliberately empty fields, always wins.
  saved.body=[...body,...vs.filter(size=>!body.some(r=>r.size===size)).map(size=>adult&&BODY_DEFAULTS[sizeCode(size)]?{size,...BODY_DEFAULTS[sizeCode(size)]}:null).filter(Boolean)];
  saved.fit=[...fit,...vs.filter(size=>!fit.some(r=>r.size===size)).map(size=>adult&&FIT_DEFAULTS[sizeCode(size)]?{size,heightMin:145,heightMax:176,weightMin:FIT_DEFAULTS[sizeCode(size)][0],weightMax:FIT_DEFAULTS[sizeCode(size)][1]}:null).filter(Boolean)];
  return saved;
 }
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function dots(p){return colors(p).length?'<div class="catalog-colors" aria-label="رنگ‌بندی">'+colors(p).map(c=>'<span class="catalog-dot '+(Object.values(c.stock).some(n=>n>0)?'':'sold-out')+'" style="--swatch:'+(/^#[a-f0-9]{6}$/i.test(c.hex)?c.hex:'#888888')+'" title="'+esc(c.name)+'" aria-label="'+esc(c.name)+'"></span>').join('')+'</div>':''}
 return{colors,color,key,valid,stock,canAdd,label,image,dots,sizeGuide};
});
