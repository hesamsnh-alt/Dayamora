'use strict';
const crypto=require('node:crypto');
const {fault}=require('./store.cjs');
const COOKIE='dayamora_autopilot';
function key(env=process.env){const k=env.AUTOPILOT_ADMIN_KEY;if(!k||k.length<32||k.length>256)throw fault('کلید مدیریت مستقل اتوپایلت باید حداقل ۳۲ کاراکتر باشد.');return k;}
function equal(a,b){const x=crypto.createHash('sha256').update(String(a)).digest(),y=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(x,y);}
function sign(payload,purpose,env=process.env){const p=Buffer.from(JSON.stringify(payload)).toString('base64url');return p+'.'+crypto.createHmac('sha256',key(env)).update(purpose+':'+p).digest('hex');}
function verify(token,purpose,env=process.env,now=Date.now()){
 try{if(typeof token!=='string'||token.length>1024)return null;const [p,s,...rest]=token.split('.');if(rest.length||!p||!s)return null;const sig=crypto.createHmac('sha256',key(env)).update(purpose+':'+p).digest('hex');if(!equal(s,sig))return null;const data=JSON.parse(Buffer.from(p,'base64url').toString());return Number.isSafeInteger(data.exp)&&data.exp>now&&data.exp<=now+86400000?data:null;}catch{return null;}
}
function authenticated(req,env=process.env){const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return !!verify(token,'session',env);}
function cookie(env=process.env,clear=false){return `${COOKIE}=${clear?'':sign({exp:Date.now()+8*3600000,nonce:crypto.randomUUID()},'session',env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear?0:28800}`;}
function sameOrigin(req,env=process.env){const expected=origin(env);if(new URL(req.url).origin!==expected||req.headers.get('origin')!==expected||req.headers.get('sec-fetch-site')==='cross-site')throw fault('درخواست از دامنهٔ مجاز نیست.',403);}
function origin(env=process.env){let u;try{u=new URL(env.AUTOPILOT_SITE_ORIGIN);}catch{throw fault('AUTOPILOT_SITE_ORIGIN تنظیم نشده است.');}if(u.protocol!=='https:'||u.origin!==env.AUTOPILOT_SITE_ORIGIN||!['dayamora.com','www.dayamora.com','dayamora.netlify.app'].includes(u.hostname))throw fault('دامنهٔ مستقل اتوپایلت باید دامنهٔ دایامورا باشد.');return u.origin;}
async function body(req){if(Number(req.headers.get('content-length')||0)>20000)throw fault('درخواست بزرگ است.',413);const reader=req.body?.getReader();if(!reader)return{};let size=0,chunks=[];try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>20000){await reader.cancel();throw fault('درخواست بزرگ است.',413);}chunks.push(Buffer.from(r.value));}return JSON.parse(Buffer.concat(chunks).toString());}catch(e){if(e.status)throw e;throw fault('درخواست معتبر نیست.',400);}finally{reader.releaseLock();}}
module.exports={key,equal,sign,verify,authenticated,cookie,sameOrigin,origin,body};
