(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoutiquePrepare=api.controller(api.browser(root))})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const media=s=>typeof s==='string'&&/^\/(?:assets|uploads)\/[a-zA-Z0-9/_.+-]+$/.test(s)&&!s.split('/').some(x=>x==='..'||x==='.');
 function jobs(products,ready=[]){const out=[];for(const p of products){
  if(!p.active||p.isSample||!['پوشاک','کفش'].includes(p.cat))continue;
  const colors=p.options?.colors?.length?p.options.colors:[{id:''}];
  for(const c of colors){const source=c.imageUrl||p.imageUrl;if(!media(source))continue;
   if(ready.some(r=>Number(r.productId)===Number(p.id)&&(r.colorId||'')===(c.id||'')&&r.sourceImage===source))continue;
   out.push({product:p,productId:Number(p.id),colorId:c.id||'',sourceImage:source,sources:[...new Set([source,...(colors.length<=1?p.gallery||[]:[])].filter(media))]});
  }
 }return out}
 function controller(deps){
  let running=null,stopped=false,priority={},memo=new Map();
  const api={get running(){return!!running},prioritize(productId,colorId=''){priority={productId:Number(productId),colorId}},cancel(){stopped=true;deps.cancel?.()},
   start(products,ready,{progress=()=>{},accept=async()=>{},onReady=()=>{}}={}){
    if(running)return running;stopped=false;
    const pending=jobs(products,ready),total=pending.length;
    running=(async()=>{
     let saved=0,failed=0;const errors=[];
     if(!total)return{total,saved,failed,errors};
     try{
      progress('آماده‌سازی خودکار در همین دستگاه؛ اولین استفاده ممکن است برای دریافت موتور زمان ببرد.');await deps.load();
      while(pending.length&&!stopped){
       let at=pending.findIndex(j=>j.productId===priority.productId&&j.colorId===priority.colorId);if(at<0)at=pending.findIndex(j=>j.productId===priority.productId);if(at<0)at=0;
       const job=pending.splice(at,1)[0];progress('حذف پس‌زمینه '+(saved+failed+1)+' از '+total+' · '+job.product.name);
       try{
        const key=JSON.stringify([2,job.productId,deps.kind(job.product),job.sources]);let image=memo.get(key);
        if(!image){const blob=await deps.cached(key);if(blob)try{image=await deps.fromCache(blob,job)}catch{}}
        if(!image){let last;
         for(const source of job.sources){if(stopped)break;try{const result=await deps.extract(source,job,progress);if(!result?.data?.startsWith('data:image/png;base64,'))throw Error('خروجی شفاف PNG آماده نشد.');image=await deps.normalize(result.data,job);break}catch(e){last=e;if(e.code==='MODEL_UNAVAILABLE')break}}
         if(!image)throw last||Error('عکس لباس قابل جداسازی نبود.');
         if(!stopped)await deps.store(key,image.blob);
        }
        if(stopped){if(image)deps.release(image);break}
        delete image.data; // The preview/cache need the Blob, not a duplicate base64 string.
        memo.set(key,image);
        const row={productId:job.productId,colorId:job.colorId,sourceImage:job.sourceImage,imageUrl:image.url,local:true};
        await accept(row,image);saved++;onReady(row);
       }catch(e){failed++;errors.push({productId:job.productId,error:e.message});if(e.code==='MODEL_UNAVAILABLE')break}
      }
      if(!stopped)progress(saved+' تصویر آماده شد'+(failed?'؛ '+failed+' تصویر آماده نشد. '+errors[0].error:'؛ تصاویر روی چوب‌لباسی قرار گرفتند.')+(pending.length?' '+pending.length+' تصویر در صف باقی ماند.':''));
     }catch(e){failed++;errors.push({error:e.message});progress('آماده‌سازی انجام نشد: '+e.message)}
     return{total,saved,failed,remaining:pending.length,errors};
    })().finally(()=>{running=null});return running;
   }
  };return api;
 }
 function browser(w){
  let loading;
  const load=()=>loading||(loading=(async()=>{for(const name of ['boutique-cache','cutout-check','garment-mask','boutique-segment'])await new Promise((resolve,reject)=>{const s=w.document.createElement('script');s.src='/'+name+'.js';s.onload=resolve;s.onerror=()=>reject(Error('فایل موتور آماده‌سازی بارگذاری نشد.'));w.document.head.append(s)})})().catch(e=>{loading=null;throw e}));
  return{load,kind:p=>w.GarmentMask.guess(p),cached:key=>w.BoutiqueCache.get(key),store:(key,blob)=>w.BoutiqueCache.put(key,blob),
   extract:(source,job,progress)=>w.BoutiqueSegment.extract(source,w.GarmentMask.guess(job.product),'auto',progress),
   normalize:(data,job)=>w.BoutiqueCutout.normalize(data,{allowPair:job.product.cat==='کفش',markQuality:true}),
   async fromCache(blob,job){const image=await w.BoutiqueCutout.normalize(blob,{allowPair:job.product.cat==='کفش'});if(image.qualityVersion<w.BoutiqueCutout.QUALITY){w.URL.revokeObjectURL(image.url);throw Error('برش ذخیره‌شده قدیمی است.')}return image},
   release:image=>w.URL.revokeObjectURL(image.url),cancel:()=>w.BoutiqueSegment?.cancel()
  };
 }
 return{jobs,controller,browser};
});
