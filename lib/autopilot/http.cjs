'use strict';
const {createStore,fault}=require('./store.cjs');
const {createEngine,UNIT_USD,MODEL,note}=require('./engine.cjs');
const A=require('./auth.cjs');
const BASE='/dayamora-autopilot-api';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function createHTTP(store,{env=process.env,engine=createEngine(store,{env})}={}){
 return async function handle(req){try{
  const path=new URL(req.url).pathname.slice(BASE.length);
  if(!new URL(req.url).pathname.startsWith(BASE+'/'))throw fault('مسیر پیدا نشد.',404);
  if(req.method!=='GET')A.sameOrigin(req,env);
  if(path==='/login'&&req.method==='POST'){
   const b=await A.body(req);A.key(env);await store.checkCAS();
   const allowed=await store.mutate(s=>{const at=Date.now();if(s.login.since+900000<at)s.login={since:at,count:0};s.login.count++;return s.login.count<=20;});
   if(!allowed)throw fault('تلاش‌های ورود زیاد است؛ ۱۵ دقیقه دیگر تلاش کنید.',429);
   if(typeof b.key!=='string'||b.key.length>256||!A.equal(b.key,A.key(env)))throw fault('کلید مدیریت معتبر نیست.',401);
   await store.mutate(s=>{note(s,'admin_login');});
   return json({ok:true},200,{'Set-Cookie':A.cookie(env)});
  }
  if(!A.authenticated(req,env))throw fault('با کلید مستقل اتوپایلت وارد شوید.',401);
  if(path==='/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':A.cookie(env,true)});
  if(path==='/state'&&req.method==='GET'){const {state}=await store.read();const {login,...safe}=state;return json({...safe,unitUSD:UNIT_USD,model:MODEL,openaiConfigured:!!env.AUTOPILOT_OPENAI_API_KEY});}
  const b=await A.body(req);
  if(path==='/enabled'&&req.method==='POST')return json(await engine.setEnabled(b.enabled));
  if(path==='/settings'&&req.method==='POST')return json(await engine.configure(b));
  if(path==='/jobs'&&req.method==='POST'){
   if(typeof b.id!=='string'||!/^manual:\d{13}:[0-9a-f-]{36}$/.test(b.id)||Math.abs(Number(b.id.split(':')[1])-Date.now())>300000)throw fault('شناسه درخواست منقضی یا نامعتبر است.',400);
   const j=await engine.queue(b.kind,b.id);const dispatched=j.status==='queued'?await engine.dispatch(j.id):false;return json({id:j.id,status:j.status,dispatched},202);
  }
  if(path==='/review'&&req.method==='POST')return json(await engine.review(b.id,b.status,b.patch));
  throw fault('مسیر یا روش درخواست پیدا نشد.',404);
 }catch(e){return json({error:e.status?e.message:'سرویس مستقل اتوپایلت در دسترس نیست؛ تنظیمات فضای ذخیره‌سازی را بررسی کنید.'},e.status||503);}};
}
let instance;
async function handle(req){try{if(!instance)instance=createHTTP(createStore());return await instance(req);}catch(e){return json({error:e.status?e.message:'پیکربندی اتوپایلت کامل نیست.'},e.status||503);}}
module.exports={handle,createHTTP,BASE};
