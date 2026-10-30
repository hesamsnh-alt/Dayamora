'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),B=require('../public/boutique-prepare.js'),C=require('../public/boutique-core.js');
const product=(id=1)=>({id,name:'بلوز '+id,active:true,cat:'پوشاک',imageUrl:'/uploads/aaaa-'+id+'.jpg',gallery:['/uploads/back-'+id+'.jpg'],variants:['M'],options:{}});
function fixture(overrides={}){
 const cache=new Map(),calls=[],images=new Map();let n=0;
 const deps={load:async()=>calls.push('load'),kind:()=> 'top',cached:async key=>cache.get(key),store:async(key,blob)=>cache.set(key,blob),
  extract:async(src,job)=>{calls.push([job.productId,src]);return{data:'data:image/png;base64,YQ=='}},
  normalize:async()=>{const image={url:'blob:https://dayamora.com/aaaaaaaa-'+(++n),blob:new Blob(['png']),qualityVersion:2};images.set(image.url,image);return image},
  fromCache:async blob=>({url:'blob:https://dayamora.com/bbbbbbbb-'+(++n),blob,qualityVersion:2}),release:()=>{},...overrides};
 return{cache,calls,images,deps,controller:B.controller(deps)};
}
test('Guest run automatically extracts, validates and displays images without login or a server write',async()=>{
 const f=fixture(),accepted=[];const r=await f.controller.start([product()],[],{accept:async(row,image)=>{A.equal(row.local,true);A.equal(image.qualityVersion,2);accepted.push(row)}});
 A.equal(r.saved,1);A.equal(r.failed,0);A.equal(f.cache.size,1);A.equal(C.photos(product(),'',accepted).length,1);A.equal(f.controller.running,false);
});
test('Missing colour photos do not block preparing the main product image or invent the colour',async()=>{
 const f=fixture(),p={...product(),options:{colors:[{id:'red'},{id:'blue'}]}},rows=[];
 A.equal(B.jobs([p]).length,2);await f.controller.start([p],[],{accept:async row=>rows.push(row)});
 A.equal(f.calls.filter(Array.isArray).length,1);A.equal(C.photos(p,'red',rows).length,1);A.match(C.photos(p,'red',rows)[0].label,/تأیید نشده/);
});
test('Selected item is prioritized; each subsequent selection can reorder queued jobs',async()=>{
 const f=fixture();f.controller.prioritize(3);await f.controller.start([product(1),product(2),product(3)],[],{onReady:row=>{if(row.productId===3)f.controller.prioritize(2)}});
 A.deepEqual(f.calls.filter(Array.isArray).map(x=>x[0]),[3,2,1]);
});
test('Cached local output is reused after reload; changed source images invalidate it',async()=>{
 const f=fixture();await f.controller.start([product()],[]);const next=B.controller(f.deps);await next.start([product()],[]);A.equal(f.calls.filter(Array.isArray).length,1);
 await next.start([{...product(),imageUrl:'/uploads/new.jpg'}],[]);A.equal(f.calls.filter(Array.isArray).length,2);
});
test('Invalid masks never enter the rack; another real gallery photo is tried automatically',async()=>{
 let n=0;const f=fixture({normalize:async()=>{if(++n===1)throw Error('Opaque image');return{url:'blob:https://dayamora.com/aaaaaaaa-1234',blob:new Blob(),qualityVersion:2}}}),rows=[];
 const r=await f.controller.start([product()],[],{accept:async row=>rows.push(row)});A.equal(r.saved,1);A.equal(f.calls.filter(Array.isArray).length,2);A.equal(rows.length,1);
 const bad=fixture({normalize:async()=>{throw Error('Dirty edges')}});let accepted=false;const result=await bad.controller.start([product()],[],{accept:async()=>{accepted=true}});A.equal(result.failed,1);A.equal(accepted,false);A.equal(bad.cache.size,0);
});
test('Model download failure is visible and stops expensive repeated attempts',async()=>{
 const f=fixture({extract:async()=>{throw Object.assign(Error('download failed'),{code:'MODEL_UNAVAILABLE'})}}),progress=[];const r=await f.controller.start([product(),product(2)],[],{progress:s=>progress.push(s)});A.equal(r.failed,1);A.equal(r.remaining,1);A.match(progress.at(-1),/download failed/);A.equal(f.cache.size,0);
});
test('Cancellation discards unfinished output and never publishes it',async()=>{
 let f;f=fixture({extract:async()=>{f.controller.cancel();return{data:'data:image/png;base64,YQ=='}}});let accepted=false;const r=await f.controller.start([product()],[],{accept:async()=>{accepted=true}});A.equal(r.saved,0);A.equal(accepted,false);A.equal(f.cache.size,0);
});
test('Only public clothing/shoes sources are prepared; invalid/foreign blob rows cannot stand in for originals',()=>{
 const p=product();A.equal(B.jobs([p,{...p,id:2,active:false},{...p,id:3,cat:'کیف'},{...p,id:4,isSample:true}]).length,1);
 for(const src of ['/private-uploads/a.png','https://outside.test/a.png','/assets/../a.png'])A.equal(B.jobs([{...p,imageUrl:src}]).length,0);
 const row={productId:1,colorId:'',sourceImage:p.imageUrl,imageUrl:'blob:https://dayamora.com/aaaaaaaa-1234'};A.equal(C.photos(p,'',[row]).length,0);A.equal(C.photos(p,'',[{...row,local:true}]).length,1);A.equal(C.photos(p,'',[{...row,local:true,sourceImage:'/uploads/old.jpg'}]).length,0);
});
