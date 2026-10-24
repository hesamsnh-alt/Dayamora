(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GarmentBatch=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function key(j){return JSON.stringify([Number(j.productId),j.colorId||'',j.sourceImage])}
 function jobs(products,rows){const out=[],seen=new Set();for(const p of products){
  if(p.active===false||p.active===0||!['پوشاک','کیف','کفش','اکسسوری'].includes(p.cat))continue;
  const colors=p.options?.colors?.length?p.options.colors:[{id:'',name:''}];
  for(const c of colors){const sourceImage=c.imageUrl||p.imageUrl;if(!sourceImage)continue;
   const job={productId:Number(p.id),colorId:c.id||'',colorName:c.name||'',name:p.name,sourceImage,product:p,requiresPhoto:colors.length>1&&!c.imageUrl};
   if(rows.some(r=>Number(r.productId)===job.productId&&(r.colorId||'')===job.colorId&&r.sourceImage===sourceImage))continue;
   const k=key(job);if(!seen.has(k)){seen.add(k);out.push(job)}
  }
 }return out}
 async function prepare(jobs,{extract,onResult=()=>{},progress=()=>{},cancelled=()=>false}){
  const results=[];for(let i=0;i<jobs.length;i++){if(cancelled())break;const job=jobs[i];progress({index:i+1,total:jobs.length,job});
   let result;try{if(job.requiresPhoto)throw Error('عکس اختصاصی این رنگ ثبت نشده است؛ ابتدا عکس همین رنگ را در ویرایش محصول وارد کنید.');const cutout=await extract(job);if(cancelled())break;if(!cutout?.data?.startsWith('data:image/png;base64,'))throw Error('خروجی شفاف PNG دریافت نشد.');result={...job,cutout,status:'review'}}catch(e){if(cancelled())break;result={...job,status:'failed',error:e.message||'آماده‌سازی انجام نشد.'}}
   results.push(result);await onResult(result);
  }return results;
 }
 return{key,jobs,prepare};
});
