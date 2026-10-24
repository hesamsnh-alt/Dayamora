'use strict';
const {randomUUID}=require('node:crypto'),storage=require('./storage.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status}),prefix='video-upload:';
async function route(req,{db,admin,body,json,store=storage,time=Date.now(),ctx={afterCommit:[]}}){
 const u=new URL(req.url),p=u.pathname,m=req.method;if(!p.startsWith('/api/admin/video/'))return null;const user=await admin();
 if(p==='/api/admin/video/frame'&&m==='GET'){
  const origin=new URL(process.env.DAYAMORA_S3_ENDPOINT||'https://invalid.local').origin;
  if(!origin.startsWith('https://'))throw fail(503,'آدرس فضای ذخیره‌سازی باید HTTPS باشد.');
  const policy="default-src 'none'; script-src 'self'; connect-src 'self' "+origin+"; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";
  return new Response('<!doctype html><html><head><meta charset="utf-8"></head><body><script src="/video-upload-frame.js"></script></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':policy,'X-Frame-Options':'SAMEORIGIN','Cache-Control':'no-store'}});
 }
 if(p==='/api/admin/video/cors'&&m==='POST'){await store.configureVideoCors(u.origin);return json({ok:true})}
 if(p==='/api/admin/video/start'&&m==='POST'){
  const b=await body(req),metadata=store.videoMetadata(b.size,b.type),id=randomUUID(),record={...metadata,key:'video-pending/'+id+'.'+metadata.ext,videoUrl:'/uploads/'+randomUUID()+'.'+metadata.ext,userId:user.id,expiresAt:time+30*60000,done:false};
  const uploadUrl=await store.signVideoUpload(record);await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?)',[prefix+id,JSON.stringify(record)]);return json({id,uploadUrl,type:metadata.type,maxBytes:store.MAX_VIDEO_BYTES});
 }
 if(p==='/api/admin/video/complete'&&m==='POST'){
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(b.id||''))throw fail(400,'شناسه آپلود معتبر نیست.');const r=await db.one('SELECT value FROM shop_settings WHERE key=?',[prefix+b.id]),record=r?JSON.parse(r.value):null;
  if(!record||record.userId!==user.id)throw fail(404,'آپلود ویدیو پیدا نشد.');if(record.done)return json({videoUrl:record.videoUrl});if(record.expiresAt<time)throw fail(410,'مهلت آپلود تمام شده؛ فایل را دوباره انتخاب کنید.');
  const videoUrl=await store.finishVideo(record);await db.run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,0,?)',[videoUrl,user.id,time]);await db.run('UPDATE shop_settings SET value=? WHERE key=?',[JSON.stringify({...record,done:true}),prefix+b.id]);ctx.afterCommit.push(()=>store.remove('/'+record.key));return json({videoUrl});
 }
 throw fail(405,'عملیات آپلود ویدیو پشتیبانی نمی‌شود.');
}
module.exports={route};
