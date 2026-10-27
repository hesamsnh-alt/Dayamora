'use strict';
// Dedicated object storage only. No imports from the shop DB, storage or auth.
const {S3Client,GetObjectCommand,PutObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {randomUUID}=require('node:crypto');
const {storageError}=require('./storage-error.cjs');
const KEY='dayamora-autopilot/v1/state.json';
function fault(message,status=503){return Object.assign(new Error(message),{status});}
function initial(){return {version:1,enabled:false,generation:0,config:{domains:['amazon.ae','noon.com','temu.com'],brief:'پوشاک زنانه، کیف، کفش و اکسسوری برای مخاطب فارسی‌زبان؛ پیشنهادهای مناسب خرید از امارات.',paths:['/'],dailyUnits:4,monthlyUnits:80},jobs:[],drafts:[],logs:[],usage:{},login:{since:0,count:0}};}
function createStore(env=process.env){
 const required=['AUTOPILOT_S3_BUCKET','AUTOPILOT_S3_ACCESS_KEY_ID','AUTOPILOT_S3_SECRET_ACCESS_KEY','AUTOPILOT_S3_REGION'];
 if(required.some(k=>!env[k]))throw fault('فضای ذخیره‌سازی مستقل اتوپایلت تنظیم نشده است.');
 if(env.AUTOPILOT_S3_BUCKET===(env.DAYAMORA_S3_BUCKET||'uploads'))throw fault('برای اتوپایلت یک باکت جدا انتخاب کنید.');
 if(env.AUTOPILOT_S3_ACCESS_KEY_ID===env.DAYAMORA_S3_ACCESS_KEY_ID)throw fault('دسترسی ذخیره‌سازی اتوپایلت باید مستقل از فروشگاه باشد.');
 let endpoint;
 if(env.AUTOPILOT_S3_ENDPOINT){let u;try{u=new URL(env.AUTOPILOT_S3_ENDPOINT);}catch{throw fault('آدرس Endpoint فضای اتوپایلت معتبر نیست؛ باید یک آدرس کامل https باشد.');}if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw fault('آدرس فضای مستقل معتبر نیست.');endpoint=u.origin;}
 const c=new S3Client({region:env.AUTOPILOT_S3_REGION,endpoint,forcePathStyle:!!endpoint,maxAttempts:1,credentials:{accessKeyId:env.AUTOPILOT_S3_ACCESS_KEY_ID,secretAccessKey:env.AUTOPILOT_S3_SECRET_ACCESS_KEY},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 const Bucket=env.AUTOPILOT_S3_BUCKET;
 async function send(command){try{return await c.send(command);}catch(e){
  // The state adapter owns these control-flow responses; preserve CAS and empty-state behavior.
  if(e.name==='NoSuchKey'||[409,412].includes(e.$metadata?.httpStatusCode))throw e;
  throw storageError(e,command.constructor.name);
 }}
 async function read(){
  try{const r=await send(new GetObjectCommand({Bucket,Key:KEY}));if(r.ContentLength>1500000)throw fault('آرشیو اتوپایلت به سقف مجاز رسیده است.');const state=JSON.parse(await r.Body.transformToString());if(state.version!==1||!Array.isArray(state.jobs)||!Array.isArray(state.drafts))throw fault('نسخهٔ ذخیره‌سازی قابل خواندن نیست.');return{state,tag:r.ETag};}
  catch(e){if(e.name==='NoSuchKey')return{state:initial(),tag:null};throw e;}
 }
 async function write(state,tag){const Body=JSON.stringify(state);if(Buffer.byteLength(Body)>1500000)throw fault('آرشیو پر شده؛ پیش‌نویس‌های قدیمی را خروجی گرفته و حذف کنید.',409);try{await send(new PutObjectCommand({Bucket,Key:KEY,Body,ContentType:'application/json',CacheControl:'no-store',...(tag?{IfMatch:tag}:{IfNoneMatch:'*'})}));return true;}catch(e){if([409,412].includes(e.$metadata?.httpStatusCode))return false;throw e;}}
 async function mutate(fn){for(let n=0;n<8;n++){const {state,tag}=await read();const result=fn(state);if(result&&typeof result.then==='function')throw fault('Mutation must be synchronous');if(await write(state,tag))return result;}throw fault('درخواست هم‌زمان زیاد است؛ دوباره تلاش کنید.',409);}
 let checked;
 async function checkCAS(){if(!checked)checked=(async()=>{const Key='dayamora-autopilot/v1/probe-'+randomUUID();let created=false,primary;try{await send(new PutObjectCommand({Bucket,Key,Body:'probe',IfNoneMatch:'*'}));created=true;
   for(const condition of [{IfMatch:'"intentionally-invalid-etag"'},{IfNoneMatch:'*'}]){let rejected=false;try{await send(new PutObjectCommand({Bucket,Key,Body:'probe',...condition}));}catch(e){if(e.$metadata?.httpStatusCode===412)rejected=true;else throw e;}if(!rejected)throw fault('این فضای ذخیره‌سازی از نوشتن شرطی امن پشتیبانی نمی‌کند؛ اتوپایلت فعال نشد.');}
  }catch(e){primary=e;throw e;}finally{if(created)try{await send(new DeleteObjectCommand({Bucket,Key}));}catch(e){if(!primary)throw e;}}})().catch(e=>{checked=null;throw e;});await checked;}
 return {read,mutate,checkCAS};
}
module.exports={createStore,initial,fault};
