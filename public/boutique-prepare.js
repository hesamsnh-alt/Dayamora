'use strict';
window.BoutiquePrepare={
 running:false,
 async start(products,validRows,{progress=()=>{},accept=async row=>row,onReady=()=>{}}={}){
  if(this.running||Shop.user?.role!=='admin')return;this.running=true;
  try{
   progress('آماده‌سازی تصاویر در مرورگر مدیر؛ این صفحه را باز نگه دارید.');
   for(const name of ['cutout-check','garment-mask','garment-segment','garment-batch','garment-auto'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+name+'.js';script.onload=resolve;script.onerror=()=>reject(Error('موتور آماده‌سازی بارگذاری نشد.'));document.head.append(script)});
   const targets=products.filter(p=>p.active&&!p.isSample&&['پوشاک','کفش'].includes(p.cat));
   const run=()=>GarmentAuto.run(targets,[...validRows],{
    progress:({index,total,job})=>progress('حذف پس‌زمینه '+index+' از '+total+' · '+job.name+'؛ صفحه را باز نگه دارید.'),
    extract:job=>GarmentAuto.extractJob(job,source=>GarmentSegment.extract(source,GarmentMask.guess(job.product),'auto',progress)),
    save:async job=>{const preview=await BoutiqueCutout.normalize(job.base64,{allowPair:job.product.cat==='کفش'});URL.revokeObjectURL(preview.url);const stored=await Daya.api('/outfit-api/cutouts',{method:'POST',body:JSON.stringify({productId:job.productId,colorId:job.colorId,sourceImage:job.sourceImage,base64:job.base64,garmentOnly:true,preparation:'automatic'})});const row={...stored,productId:job.productId,colorId:job.colorId,sourceImage:job.sourceImage};await accept(row);onReady();return row}
   });
   const result=navigator.locks?await navigator.locks.request('dayamora-auto-cutouts',run):await run();
   progress(result.total?result.saved+' تصویر آماده شد؛ '+(result.failed+result.skipped)+' تصویر آماده نشد.'+(result.errors.length?' '+result.errors[0].error:''):'تصاویر این ویترین آماده‌اند.');
  }catch(e){progress('آماده‌سازی متوقف شد: '+e.message)}finally{this.running=false}
 }
};
