(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./garment-batch.js'):root.GarmentBatch);if(typeof module==='object'&&module.exports)module.exports=api;else root.GarmentAuto=api})(typeof window!=='undefined'?window:this,function(B){
 'use strict';
 async function extractJob(job,extract){let last;for(const source of job.sourceImages?.length?job.sourceImages:[job.sourceImage]){try{return await extract(source,job)}catch(e){last=e;if(e.code==='MODEL_UNAVAILABLE'||e.serviceBlocked||[401,403,429].includes(e.status))throw e}}throw last||Error('عکس قابل استفاده برای محصول موجود نیست.')}
 async function run(products,rows,{extract,save,progress=()=>{},cancelled=()=>false,failures=new Map(),now=()=>Date.now()}={}){
  const jobs=B.jobs(products,rows,{includeInactive:true});let saved=0,failed=0,skipped=0;const errors=[];
  for(let i=0;i<jobs.length;i++){
   if(cancelled())break;const job=jobs[i],key=B.key(job),previous=failures.get(key);
   if(previous&&now()-previous.time<10*60000){skipped++;errors.push({name:job.name,color:job.colorName,error:previous.error});continue}
   progress({total:jobs.length,index:i+1,saved,failed,skipped,job});
   try{
    if(job.requiresPhoto)throw Error('عکس اختصاصی این رنگ موجود نیست.');
    const cutout=await extract(job);if(cancelled())break;
    if(!cutout?.data?.startsWith('data:image/png;base64,'))throw Error('خروجی شفاف PNG آماده نشد.');
    const stored=await save({...job,base64:cutout.data});
    rows.push({...stored,productId:job.productId,colorId:job.colorId,sourceImage:job.sourceImage});failures.delete(key);saved++;
   }catch(e){
    failed++;errors.push({name:job.name,color:job.colorName,error:e.message});failures.set(key,{time:now(),error:e.message});
    if(e.code==='MODEL_UNAVAILABLE'||e.serviceBlocked||[401,403,429].includes(e.status))break;
   }
  }return{total:jobs.length,saved,failed,skipped,remaining:jobs.length-saved-failed-skipped,errors};
 }
 let running=false,pending=null,status='آماده‌سازی خودکار مانکن منتظر دریافت محصولات است.',failures=new Map();
 function render(){const el=document.querySelector('#autoGarmentsStatus');if(el)el.textContent=status}
 function show(s){status=s;render()}
 function readFailures(){try{failures=new Map(JSON.parse(localStorage.getItem('dayamora-auto-cutout-failures')||'[]'))}catch{failures=new Map()}}
 function storeFailures(){try{localStorage.setItem('dayamora-auto-cutout-failures',JSON.stringify([...failures].slice(-300)))}catch{}}
 async function process(){
  while(pending){const products=pending;pending=null;
   const ready=await Daya.api('/outfit-api/cutouts?all=1');if(!Array.isArray(ready.cutouts))throw Error('فهرست تصاویر مانکن معتبر نیست.');
   const result=await run(products,ready.cutouts,{failures,progress:({index,total,saved,job})=>show(`مانکن: آماده‌سازی خودکار ${index} از ${total} · ${job.name} · ${saved} ثبت‌شده. پنل را باز نگه دارید.`),extract:job=>extractJob(job,(source)=>GarmentSegment.extract(source,GarmentMask.guess(job.product),'auto',s=>show('مانکن: '+job.name+' · '+s+' · پنل را باز نگه دارید.'))),save:job=>Daya.api('/outfit-api/cutouts',{method:'POST',body:JSON.stringify({productId:job.productId,colorId:job.colorId,sourceImage:job.sourceImage,base64:job.base64,garmentOnly:true,preparation:'automatic'})})});
   storeFailures();
   show(result.total?`مانکن: ${result.saved} تصویر خودکار ثبت شد؛ ${result.failed+result.skipped} تصویر آماده نشد؛ ${result.remaining} تصویر در صف باقی ماند.`+(result.errors.length?' '+result.errors.slice(0,3).map(e=>e.name+(e.color?' / '+e.color:'')+': '+e.error).join(' | '):''):'مانکن: تصاویر تمام محصولات فعلی آماده‌اند.');
  }
 }
 async function start(products){
  pending=products;if(running){render();return}running=true;readFailures();
  try{
   if(navigator.locks){show('مانکن: در انتظار شروع آماده‌سازی خودکار…');await navigator.locks.request('dayamora-auto-cutouts',async()=>process())}
   else await process();
  }catch(e){show('آماده‌سازی خودکار مانکن متوقف شد: '+e.message)}finally{running=false;storeFailures()}
 }
 return{run,start,render,extractJob};
});
