'use strict';
const {randomUUID}=require('node:crypto'),{fail}=require('./validation.cjs');
const PREFIX='journal-post:',idOk=id=>/^[a-f0-9-]{36}$/.test(id),imageOk=s=>typeof s==='string'&&/^\/(assets\/[a-z0-9/-]+\.(webp|png|jpg)|uploads\/[a-f0-9-]+\.(jpg|png|webp))$/.test(s)&&!s.includes('..');
const str=(v,n)=>String(v??'').trim().slice(0,n);
function validate(b){
 const title=str(b.title,180),summary=str(b.summary,800),cover=str(b.cover,250),status=b.status;
 if(!title||!['draft','published','archived'].includes(status))throw fail(400,'عنوان و وضعیت مقاله را وارد کنید.');
 if(cover&&!imageOk(cover))throw fail(400,'عکس کاور معتبر نیست.');
 if(!Array.isArray(b.blocks)||b.blocks.length>40)throw fail(400,'حداکثر ۴۰ بخش متن یا عکس برای مقاله مجاز است.');
 const blocks=b.blocks.map(x=>{if(x?.type==='text')return{type:'text',text:str(x.text,10000)};if(x?.type==='image'&&imageOk(x.src))return{type:'image',src:x.src,caption:str(x.caption,500),alt:str(x.alt,200)};throw fail(400,'بخش متن یا عکس معتبر نیست.');});
 if(status==='published'&&(!cover||!blocks.some(x=>x.type==='text'&&x.text)))throw fail(400,'برای انتشار، عکس کاور و حداقل یک بخش متن لازم است.');
 const out={title,summary,cover,coverAlt:str(b.coverAlt,200),category:str(b.category,60),seoTitle:str(b.seoTitle,180),seoDescription:str(b.seoDescription,300),status,blocks};
 if(Buffer.byteLength(JSON.stringify(out))>180000)throw fail(413,'متن مقاله بیش از حد طولانی است.');return out;
}
function summary(p){const {blocks,...rest}=p;return{...rest,summary:p.summary||blocks.find(x=>x.type==='text')?.text.slice(0,220)||''}}
async function route(req,{db,admin,body,json}){
 const path=new URL(req.url).pathname,m=req.method,isAdmin=path.startsWith('/api/admin/journal');
 if(!/^\/api\/(admin\/)?journal(?:\/[a-f0-9-]+)?$/.test(path))return null;
 if(isAdmin)await admin();else if(m!=='GET')throw fail(405,'این مسیر فقط برای خواندن مقاله است.');
 const rawId=path.split('/').slice(isAdmin?4:3).join('/'),id=rawId||'';if(id&&!idOk(id))throw fail(400,'شناسه مقاله معتبر نیست.');
 if(m==='GET'){
  if(id){const r=await db.one('SELECT value FROM shop_settings WHERE key=?',[PREFIX+id]),post=r?JSON.parse(r.value):null;if(!post||!isAdmin&&post.status!=='published')throw fail(404,'مقاله پیدا نشد.');return json({post});}
  const posts=(await db.all("SELECT value FROM shop_settings WHERE key LIKE 'journal-post:%' LIMIT 1000")).map(r=>JSON.parse(r.value)).filter(p=>isAdmin||p.status==='published').sort((a,b)=>(isAdmin?b.updatedAt-a.updatedAt:b.publishedAt-a.publishedAt)).map(summary);return json({posts});
 }
 if(!isAdmin)throw fail(403,'فقط مدیر اجازه ویرایش مجله را دارد.');
 if(m==='POST'&&!id||m==='PUT'&&id){
  const b=await body(req),data=validate(b),old=id?await db.one('SELECT value FROM shop_settings WHERE key=?',[PREFIX+id]):null;
  if(id&&!old)throw fail(404,'مقاله پیدا نشد.');const previous=old?JSON.parse(old.value):null;
  if(previous&&b.revision!==previous.revision)throw fail(409,'این مقاله تغییر کرده است. نسخه تازه را باز کن تا تغییرات دیگری بازنویسی نشود.');
  const images=[data.cover,...data.blocks.filter(x=>x.type==='image').map(x=>x.src)].filter(Boolean);
  for(const src of new Set(images))if(src.startsWith('/uploads/')&&!await db.one('SELECT path FROM uploads WHERE path=? AND private=0',[src]))throw fail(400,'یکی از عکس‌ها در فضای ذخیره‌سازی پیدا نشد؛ دوباره بارگذاری کن.');
  const now=Date.now(),post={...data,id:id||randomUUID(),createdAt:previous?.createdAt||now,updatedAt:now,publishedAt:data.status==='published'?(previous?.publishedAt||now):previous?.publishedAt||null,revision:(previous?.revision||0)+1};
  if(previous){const changed=await db.one('UPDATE shop_settings SET value=? WHERE key=? AND value=? RETURNING key',[JSON.stringify(post),PREFIX+id,old.value]);if(!changed)throw fail(409,'مقاله هم‌زمان تغییر کرده؛ نسخه تازه را باز کن.');}
  else await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?)',[PREFIX+post.id,JSON.stringify(post)]);
  return json({post},previous?200:201);
 }
 throw fail(405,'عملیات پشتیبانی نمی‌شود.');
}
module.exports={route,validate,imageOk};
