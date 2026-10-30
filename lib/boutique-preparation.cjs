'use strict';
const crypto=require('node:crypto'),Engine=require('./boutique-engine.cjs'),Registry=require('./cutout-registry.cjs');
const PREFIX='boutique-auto:v1:',LEASE='boutique-auto:lease',parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{}}catch{return{}}};
const key=j=>PREFIX+crypto.createHash('sha256').update(JSON.stringify([j.productId,Engine.kind(j.product),j.colorIds,j.sourceImage,j.sources])).digest('hex');
const publicPath=s=>typeof s==='string'&&/^\/(assets|uploads)\/[a-zA-Z0-9/_.-]+$/.test(s)&&!s.split('/').some(x=>x==='.'||x==='..');
function jobs(products){const out=[];for(const raw of products){const p={...raw,options:parse(raw.options),gallery:Array.isArray(parse(raw.gallery))?parse(raw.gallery):[]};if(!p.active||p.is_sample||p.isSample||!['پوشاک','کفش'].includes(p.cat))continue;
 const colors=p.options.colors?.length?p.options.colors:[{id:''}],group=new Map();for(const c of colors){const source=c.imageUrl||p.image_url||p.imageUrl;if(!publicPath(source))continue;let j=group.get(source);if(!j){j={productId:Number(p.id),product:p,colorIds:[],sourceImage:source,sources:[...new Set([source,...(colors.length<=1?p.gallery:[])].filter(publicPath))]};group.set(source,j)}j.colorIds.push(c.id||'');}out.push(...group.values());}return out}
async function put(db,k,v){await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[k,JSON.stringify(v)])}
async function states(db,keys){const result=new Map();for(let i=0;i<keys.length;i+=400){const batch=keys.slice(i,i+400);for(const r of await db.all('SELECT key,value FROM shop_settings WHERE key IN ('+batch.map(()=>'?').join(',')+')',batch))result.set(r.key,parse(r.value))}return result}
function message(state){return state==='ready'?'تصویر شفاف آماده است.':state==='failed'?'جداسازی این تصویر موفق نبود؛ خودکار دوباره بررسی می‌شود.':state==='processing'?'تصویر روی سرور در حال آماده‌سازی است.':'تصویر در صف آماده‌سازی خودکار سرور است.'}
async function publicStatus(db,products){const queue=jobs(products),ss=await states(db,queue.map(key));return queue.map(j=>{const s=ss.get(key(j))||{},status=j.colorIds.every(cid=>Registry.matching(j.product,cid))?'ready':['ready','processing','failed'].includes(s.status)?s.status:'pending';return{productId:j.productId,colorIds:j.colorIds,status,message:message(status)}})}
function secret(){const s=process.env.DAYAMORA_S3_SECRET_ACCESS_KEY;if(!s||s.length<16)throw Error('Storage credentials unavailable');return s}
function sign(time){return crypto.createHmac('sha256',secret()).update('dayamora:boutique-worker:v1:'+String(time)).digest('hex')}
function authorized(req,now=Date.now()){
 try{const time=req.headers.get('x-boutique-time')||'',value=req.headers.get('x-boutique-signature')||'';if(!/^\d{13}$/.test(time)||Math.abs(now-Number(time))>120000||!/^[a-f0-9]{64}$/.test(value))return false;return crypto.timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(sign(time),'hex'))}catch{return false}
}
async function dispatch(origin){
 // The existing store origin is fixed, never derived from an incoming Host header.
 const expected=require('./seo.cjs').ORIGIN;if(origin!==expected)throw Error('Invalid worker origin');const time=Date.now();
 const r=await fetch(origin+'/boutique-preparation-worker',{method:'POST',headers:{'x-boutique-time':String(time),'x-boutique-signature':sign(time)},signal:AbortSignal.timeout(15000)});if(r.status!==202)throw Error('Boutique worker was not accepted');
}
function createWorker({withDatabase,extract=Engine.extract,readSource=Engine.readSource,upload,remove,now=()=>Date.now(),token=()=>crypto.randomUUID()}={}){
 return async()=>{
  const owner=token(),started=now(),leaseUntil=started+16*60000;let leased=false,localStates=new Map();
  const update=async(k,v)=>{await withDatabase(true,db=>put(db,k,v));localStates.set(k,v)};
  try{
   leased=await withDatabase(true,async db=>{const row=await db.one('SELECT value FROM shop_settings WHERE key=?',[LEASE]),old=parse(row?.value);if(Number(old.until)>now())return false;await put(db,LEASE,{owner,until:leaseUntil});return true});if(!leased)return{busy:true};
   const snapshot=await withDatabase(false,async db=>({products:await db.all("SELECT id,name,cat,image_url,options,gallery,active,is_sample FROM products WHERE active=1 AND is_sample=0 AND cat IN ('پوشاک','کفش') ORDER BY id"),ready:await db.all('SELECT product_id,color_id,image_url,source_image,updated_at FROM garment_cutouts'),admin:await db.one("SELECT id FROM users WHERE role='admin' AND email=?",['hesamsnh@gmail.com'])}));
   if(!snapshot.admin)throw Error('Store owner account unavailable');let processed=0,saved=0,failed=0;
   const queue=jobs(snapshot.products);snapshot.states=localStates=await withDatabase(false,db=>states(db,queue.map(key)));
   const readyFor=j=>j.colorIds.every(cid=>{const previous=localStates.get(key(j))||{},row=snapshot.ready.findLast(r=>Number(r.product_id)===j.productId&&r.color_id===cid&&r.source_image===j.sourceImage);return Registry.matching(j.product,cid)||row&&previous.status==='ready'&&previous.quality===2&&row.image_url===previous.imageUrl});
   for(const j of queue){
    if(processed>=2||now()-started>11*60000)break;const k=key(j),previous=snapshot.states.get(k)||{};
    if(readyFor(j)||Number(previous.nextAttempt)>now())continue;processed++;
    const attempt=Number(previous.attempts||0)+1,attemptAt=now();await update(k,{status:'processing',attempts:attempt,updatedAt:attemptAt,nextAttempt:leaseUntil});
    let imageUrl='',committed=false;
    try{
     let bytes,last;for(const source of j.sources.slice(((attempt-1)*8)%j.sources.length).concat(j.sources.slice(0,((attempt-1)*8)%j.sources.length)).slice(0,8)){if(now()-started>11*60000)break;try{bytes=await extract(await readSource(source),Engine.kind(j.product));break}catch(e){last=e;if(e.code==='MODEL_UNAVAILABLE')break}}
     if(!bytes)throw last||Error('No usable source');
     const base64='data:image/png;base64,'+Buffer.from(bytes).toString('base64');require('./cutout-png.cjs').validatePng(base64);imageUrl=await upload(base64,false);
     committed=await withDatabase(true,async db=>{
      const held=parse((await db.one('SELECT value FROM shop_settings WHERE key=?',[LEASE]))?.value);if(held.owner!==owner||Number(held.until)<now())return false;
      const current=await db.one('SELECT id,name,cat,image_url,options,gallery,active,is_sample FROM products WHERE id=?',[j.productId]);if(!current||!jobs([current]).some(candidate=>key(candidate)===k))return false;
      const rows=await db.all('SELECT color_id,updated_at FROM garment_cutouts WHERE product_id=?',[j.productId]);if(rows.some(r=>j.colorIds.includes(r.color_id)&&Number(r.updated_at)>attemptAt))return false;
      await db.run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,0,?)',[imageUrl,snapshot.admin.id,now()]);
      for(const cid of j.colorIds)await db.run('INSERT INTO garment_cutouts(product_id,color_id,image_url,updated_by,updated_at,source_image) VALUES(?,?,?,?,?,?) ON CONFLICT(product_id,color_id) DO UPDATE SET image_url=excluded.image_url,updated_by=excluded.updated_by,updated_at=excluded.updated_at,source_image=excluded.source_image',[j.productId,cid,imageUrl,snapshot.admin.id,now(),j.sourceImage]);
      await put(db,k,{status:'ready',quality:2,imageUrl,attempts:attempt,updatedAt:now()});return true;
     });
     if(committed){saved++;localStates.set(k,{status:'ready',quality:2,imageUrl});for(const cid of j.colorIds)snapshot.ready.push({product_id:j.productId,color_id:cid,image_url:imageUrl,source_image:j.sourceImage});}else await update(k,{status:'pending',attempts:0,updatedAt:now(),nextAttempt:now()+60000});
    }catch(e){failed++;await update(k,{status:'failed',attempts:attempt,updatedAt:now(),nextAttempt:now()+(attempt===1?10*60000:attempt===2?3600000:86400000),reason:e.code==='MODEL_UNAVAILABLE'?'model_unavailable':'image_rejected'});if(e.code==='MODEL_UNAVAILABLE')return{processed,saved,failed,more:false}}
    finally{if(imageUrl&&!committed)await remove(imageUrl).catch(()=>{})}
   }
   return{processed,saved,failed,more:queue.some(j=>!readyFor(j)&&!(Number(localStates.get(key(j))?.nextAttempt)>now()))};
  }finally{if(leased)await withDatabase(true,async db=>{const current=parse((await db.one('SELECT value FROM shop_settings WHERE key=?',[LEASE]))?.value);if(current.owner===owner)await put(db,LEASE,{owner,until:0})}).catch(()=>{})}
 };
}
module.exports={PREFIX,LEASE,key,jobs,publicStatus,createWorker,sign,authorized,dispatch};
