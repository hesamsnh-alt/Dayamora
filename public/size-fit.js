(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SizeFit=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function numeric(value){const s=String(value??'').trim().replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/٫/g,'.');return /^\d{1,3}(?:\.\d)?$/.test(s)?Number(s):NaN}
 function valid(row){return row&&['heightMin','heightMax','weightMin','weightMax'].every(k=>Number.isFinite(numeric(row[k])))&&numeric(row.heightMin)>=60&&numeric(row.heightMax)<=230&&numeric(row.heightMin)<=numeric(row.heightMax)&&numeric(row.weightMin)>=5&&numeric(row.weightMax)<=250&&numeric(row.weightMin)<=numeric(row.weightMax)}
 function recommend(rows,variants,height,weight){
  const h=numeric(height),w=numeric(weight);if(!Number.isFinite(h)||!Number.isFinite(w)||h<60||h>230||w<5||w>250)return{status:'invalid',sizes:[]};
  const rules=(Array.isArray(rows)?rows:[]).filter(r=>valid(r)&&variants.includes(r.size));if(!rules.length)return{status:'missing',sizes:[]};
  const hits=rules.filter(r=>h>=numeric(r.heightMin)&&h<=numeric(r.heightMax)&&w>=numeric(r.weightMin)&&w<=numeric(r.weightMax));
  return{status:hits.length?'matched':'outside',sizes:[...new Set(hits.map(r=>r.size))]};
 }
 function open(p,{stock=()=>p.stock,select=()=>{},guide=()=>{}}={}){
  document.querySelector('#sizeFitDialog')?.remove();const E=Daya.escape,rules=Catalog.sizeGuide(p).fit||[],dialog=document.createElement('dialog');dialog.id='sizeFitDialog';dialog.className='size-fit-dialog';dialog.setAttribute('aria-label','پیشنهاد سایز با قد و وزن');
  dialog.innerHTML=`<header><div><h2>سایز مناسب من</h2><p>${E(p.name)}</p></div><button type="button" class="dialog-close" aria-label="بستن پیشنهاد سایز">×</button></header><p>قد و وزنت را وارد کن؛ نتیجه تخمینی است؛ اگر فروشگاه بازهٔ اختصاصی ثبت نکرده باشد از الگوی عمومی زنانه استفاده می‌شود. جدول واقعی برند اولویت دارد.</p><form id="sizeFitForm" class="daya-form"><div class="size-fit-inputs"><label>قد — سانتی‌متر<input name="height" type="text" inputmode="decimal" maxlength="5" required placeholder="مثلاً ۱۶۵" autocomplete="off"></label><label>وزن — کیلوگرم<input name="weight" type="text" inputmode="decimal" maxlength="5" required placeholder="مثلاً ۶۰" autocomplete="off"></label></div><button class="pink" type="submit">سایزم را پیشنهاد بده</button></form><div id="sizeFitResult" role="status" aria-live="polite"></div><p class="size-fit-notice">قد و وزن به‌تنهایی اندازهٔ دقیق بدن را مشخص نمی‌کنند؛ قواره، جنس و تفاوت برندها هم مؤثرند.</p><button type="button" class="text-link" id="fitOpenGuide">مشاهدهٔ جدول اندازه‌های لباس</button>`;
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('#fitOpenGuide').onclick=()=>{dialog.close();guide()};
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target.elements,result=recommend(rules,p.variants,f.height.value,f.weight.value),node=dialog.querySelector('#sizeFitResult');
   const messages={invalid:'قد را بین ۶۰ تا ۲۳۰ سانتی‌متر و وزن را بین ۵ تا ۲۵۰ کیلوگرم وارد کن.',missing:'بازهٔ قد و وزن این لباس هنوز ثبت نشده است؛ فعلاً از جدول اندازه‌ها یا راهنمایی فروشگاه استفاده کن.',outside:'قد و وزن واردشده در بازه‌های ثبت‌شدهٔ این لباس قرار نمی‌گیرد؛ نمی‌توانیم سایز قابل اتکایی پیشنهاد بدهیم.'};
   if(result.status!=='matched'){node.textContent=messages[result.status];return}
   node.innerHTML='<h3>'+(result.sizes.length===1?'سایز پیشنهادی: '+E(result.sizes[0]):'بین این سایزها هستی: '+result.sizes.map(E).join(' / '))+'</h3>'+result.sizes.map((s,i)=>'<button type="button" class="small-button" data-fit-select="'+i+'" '+(stock(s)>0?'':'disabled')+'>'+E(s)+(stock(s)>0?' · انتخاب این سایز':' · در رنگ انتخابی ناموجود است')+'</button>').join(' ')+(result.sizes.length>1?'<p>بازه‌ها هم‌پوشانی دارند؛ برای انتخاب نهایی جدول اندازه‌های لباس را بررسی کن.</p>':'');
   node.querySelectorAll('[data-fit-select]').forEach(b=>b.onclick=()=>{const size=result.sizes[Number(b.dataset.fitSelect)];if(stock(size)<1)return;select(size);dialog.close()});
  };
  document.body.append(dialog);dialog.showModal();
 }
 return{numeric,valid,recommend,open};
});
