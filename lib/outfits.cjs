'use strict';
const {createHash,randomUUID}=require('node:crypto'),{withDatabase,rateLimit}=require('./db.cjs'),{validate,fail}=require('./outfit-validation.cjs'),Core=require('../public/outfit-core.js');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
function token(req){const raw=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dayamora_session='));const t=raw?.slice(17);return /^[a-f0-9]{64}$/.test(t||'')?t:null}
async function body(req){if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'درخواست باید JSON باشد.');let size=0,parts=[];const reader=req.body?.getReader();if(reader)while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4500000){await reader.cancel();fail(413,'حجم درخواست زیاد است.')}parts.push(Buffer.from(r.value))}try{return JSON.parse(Buffer.concat(parts).toString()||'{}')}catch{fail(400,'اطلاعات ارسالی معتبر نیست.')}}
const parse=v=>typeof v==='string'?JSON.parse(v):v;
function createHandler(deps={withDatabase,rateLimit,upload:(...args)=>require('./storage.cjs').upload(...args)}){
 return async function handle(req){
  const url=new URL(req.url),write=!['GET','HEAD'].includes(req.method),parts=url.pathname.split('/').filter(Boolean);
  try{
   if(write&&(req.headers.get('sec-fetch-site')==='cross-site'||req.headers.get('origin')&&req.headers.get('origin')!==url.origin))fail(403,'درخواست از این سایت مجاز نیست.');
   if(!['GET','POST','PUT'].includes(req.method))return json({error:'روش درخواست مجاز نیست.'},405);
   if(req.method==='GET'&&parts.length===2&&parts[1]==='cutouts')return await deps.withDatabase(false,async db=>json(await require('./cutout-registry.cjs').list(db)));
   const raw=token(req);if(!raw)fail(401,'برای ذخیره یا مشاهده کمد، وارد حساب خودت شو.');
   const hash=createHash('sha256').update(raw).digest('hex');
   return await deps.withDatabase(write,async db=>{
    const u=await db.one('SELECT u.id,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[hash,Date.now()]);if(!u)fail(401,'نشست تمام شده؛ دوباره وارد حساب شو.');
    const path=parts.slice(1),id=path[1];
    const ownImage=async image=>{if(image.startsWith('/private-uploads/')&&!await db.one('SELECT path FROM uploads WHERE path=? AND user_id=? AND private=1',[image,u.id]))fail(403,'تصویر خصوصی متعلق به این حساب نیست.');if(image.startsWith('/uploads/')&&!await db.one('SELECT path FROM uploads WHERE path=? AND private=0',[image]))fail(400,'تصویر محصول پیدا نشد.')};
    if(path[0]==='cutouts'&&req.method==='POST'&&path.length===1){
     if(u.role!=='admin')fail(403,'فقط مدیر می‌تواند تصویر لباس را ثبت کند.');
     await deps.rateLimit(u.id,'garment-cutout');const b=await body(req),pid=Number(b.productId),cid=String(b.colorId||'');
     if(!Number.isSafeInteger(pid)||pid<1||cid.length>80||b.garmentOnly!==true)fail(400,'محصول و تأیید فقط لباس الزامی است.');
     const row=await db.one('SELECT to_jsonb(p) AS data FROM products p WHERE id=?',[pid]);if(!row)fail(404,'محصول پیدا نشد.');let opts;try{opts=parse(row.data.options||'{}')}catch{opts={}}const colors=opts.colors||[];
     if(colors.length&&!colors.some(c=>c.id===cid)||!colors.length&&cid)fail(400,'برای هر رنگ، تصویر دقیق همان رنگ را ثبت کن.');
     if(b.sourceImage!==require('./cutout-registry.cjs').source(row.data,cid))fail(409,'عکس محصول تغییر کرده؛ دوباره تصویر جدید را آماده کن.');require('./cutout-png.cjs').validatePng(b.base64);
     const imageUrl=await deps.upload(b.base64,false),now=Date.now();await db.run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,?,?)',[imageUrl,u.id,0,now]);
     await db.run('INSERT INTO garment_cutouts(product_id,color_id,image_url,updated_by,updated_at,source_image) VALUES(?,?,?,?,?,?) ON CONFLICT(product_id,color_id) DO UPDATE SET image_url=excluded.image_url,updated_by=excluded.updated_by,updated_at=excluded.updated_at,source_image=excluded.source_image',[pid,cid,imageUrl,u.id,now,b.sourceImage]);return json({imageUrl,productId:pid,colorId:cid},201);
    }
    if(req.method==='POST'&&path[0]==='assets'&&path.length===1){await deps.rateLimit(u.id,'outfit-assets');const b=await body(req);if(b.kind!==undefined&&!['cutout','snapshot'].includes(b.kind))fail(400,'نوع تصویر ست معتبر نیست.');if(b.kind==='cutout')require('./cutout-png.cjs').validatePng(b.base64);const imageUrl=await deps.upload(b.base64,true);await db.run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,?,?)',[imageUrl,u.id,1,Date.now()]);return json({imageUrl},201)}
    if(path[0]!=='looks'||path.length>2)return json({error:'مسیر پیدا نشد.'},404);
    if(req.method==='GET'){
     if(!id){const looks=await db.all('SELECT id,name,snapshot_url AS "snapshot",revision,created_at,updated_at FROM outfits WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',[u.id]);return json({looks})}
     const row=await db.one('SELECT * FROM outfits WHERE id=? AND user_id=?',[id,u.id]);if(!row)fail(404,'این ست پیدا نشد.');return json({look:{...parse(row.manifest),id:row.id,revision:row.revision,updatedAt:row.updated_at}});
    }
    if(req.method==='POST'&&id||req.method==='PUT'&&!id)return json({error:'مسیر ذخیره معتبر نیست.'},405);
    const b=await body(req),look=validate(b);await deps.rateLimit(u.id,'outfit-save');
    if(!look.layers.length)fail(400,'اول یک لباس به ست اضافه کن.');
    for(const l of look.layers){
     await ownImage(l.image);
     if(l.source==='shop'){
      const product=await db.one('SELECT to_jsonb(p) AS data FROM products p WHERE id=?',[l.id]);if(!product)fail(409,'یکی از محصولات حذف شده؛ آن را از ست بردار.');
      const p=product.data,vs=parse(p.variants);let opts;try{opts=parse(p.options||'{}')}catch{opts={}}
      if(!vs.includes(l.variant))fail(400,'سایز یا مدل انتخاب‌شده برای '+p.name+' معتبر نیست.');
      const colors=opts.colors||[];const c=colors.find(c=>c.id===l.colorId);if(colors.length&&!c||!colors.length&&l.colorId)fail(400,'رنگ انتخابی برای '+p.name+' معتبر نیست.');
      if(!l.image.startsWith('/private-uploads/')&&!require('./cutout-registry.cjs').matching(p,l.colorId,l.image)&&!await db.one('SELECT product_id FROM garment_cutouts WHERE product_id=? AND color_id=? AND image_url=? AND source_image=?',[l.id,l.colorId,l.image,require('./cutout-registry.cjs').source(p,l.colorId)]))fail(409,'تصویر فقط لباس برای این انتخاب آماده نیست.');
      l.name=p.name;l.brand=p.brand;l.price=Number(p.price);l.colorName=c?.name||'';
     }else if(l.source==='wardrobe'&&!await db.one('SELECT id FROM wardrobe WHERE id=? AND user_id=?',[l.id,u.id]))fail(403,'آیتم کمد متعلق به این حساب نیست.');
     else if(l.source==='demo'&&!/^\/outfit-assets\//.test(l.image))fail(400,'تصویر نمونه معتبر نیست.');
    }
    if(look.snapshot)await ownImage(look.snapshot);
    if(req.method==='PUT'){
     const row=await db.one('SELECT revision FROM outfits WHERE id=? AND user_id=?',[id,u.id]);if(!row)fail(404,'این ست پیدا نشد.');if(row.revision!==Number(b.revision))fail(409,'این ست در جای دیگری تغییر کرده؛ دوباره بازش کن.');
     await db.run('UPDATE outfits SET name=?,manifest=?,snapshot_url=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=?',[look.name,JSON.stringify(look),look.snapshot||null,Date.now(),id,u.id]);return json({id,revision:row.revision+1});
    }
    if(Number((await db.one('SELECT COUNT(*) n FROM outfits WHERE user_id=?',[u.id])).n)>=100)fail(400,'حداکثر ۱۰۰ ست در کمد قابل ذخیره است.');
    const newid=randomUUID(),now=Date.now();await db.run('INSERT INTO outfits(id,user_id,name,manifest,snapshot_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[newid,u.id,look.name,JSON.stringify(look),look.snapshot||null,now,now]);return json({id:newid,revision:1},201);
   });
  }catch(e){const status=e.status||503;return json({error:e.status?e.message:'ذخیره‌سازی کمد فعلاً در دسترس نیست. تنظیمات سرور را بررسی کنید.'},status)}
 };
}
module.exports={handle:createHandler(),createHandler};
