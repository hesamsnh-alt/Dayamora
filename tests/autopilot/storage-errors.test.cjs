'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {storageError}=require('../../lib/autopilot/storage-error.cjs');
const {createStore}=require('../../lib/autopilot/store.cjs');
const {createHTTP}=require('../../lib/autopilot/http.cjs');
const {S3Client}=require('@aws-sdk/client-s3');
const env={AUTOPILOT_S3_BUCKET:'dayamora-autopilot-private',AUTOPILOT_S3_ACCESS_KEY_ID:'FAKE-ACCESS-DO-NOT-LOG',AUTOPILOT_S3_SECRET_ACCESS_KEY:'FAKE-SECRET-DO-NOT-LOG',AUTOPILOT_S3_REGION:'us-east-2',AUTOPILOT_S3_ENDPOINT:'https://storage.example.test',AUTOPILOT_ADMIN_KEY:'TEST-ADMIN-KEY-at-least-32-characters',AUTOPILOT_SITE_ORIGIN:'https://dayamora.com'};
function provider(name,status){return Object.assign(new Error('sensitive provider text '+env.AUTOPILOT_S3_SECRET_ACCESS_KEY),{name,$metadata:{httpStatusCode:status}});}
test('storage errors distinguish invalid credentials, permission, bucket and service limits without exposing secrets',()=>{
 const expected={InvalidAccessKeyId:'ID',SignatureDoesNotMatch:'SIGNATURE',AccessDenied:'PERMISSION',NoSuchBucket:'BUCKET',ExpiredToken:'EXPIRED',InvalidToken:'TOKEN',AuthorizationHeaderMalformed:'REGION',NotImplemented:'UNSUPPORTED',InvalidArgument:'ARGUMENT'};
 for(const [name,suffix] of Object.entries(expected)){const logs=[],e=storageError(provider(name,403),'PutObjectCommand',{error:(...v)=>logs.push(v)});assert.equal(e.status,503);assert.equal(e.code,'AP-S3-'+suffix+'/PutObjectCommand');const output=JSON.stringify({message:e.message,logs});assert.ok(!output.includes('sensitive provider'));assert.ok(!output.includes('DO-NOT-LOG'));}
 const logs=[],unknown=storageError(provider('FAKE-SECRET-DO-NOT-LOG',500),'FAKE-SECRET-DO-NOT-LOG',{error:(...v)=>logs.push(v)});assert.equal(unknown.code,'AP-S3-UNKNOWN/S3');assert.ok(!JSON.stringify(logs).includes('DO-NOT-LOG'));
 const raw=Object.assign(provider('UnexpectedProviderError',500),{status:503});assert.ok(!storageError(raw,'S3',{error(){}}).message.includes('DO-NOT-LOG'));
});
test('transport and HTTP-only errors produce bounded actionable codes',()=>{
 const silent={error(){}};
 assert.equal(storageError({cause:{code:'ENOTFOUND'}},'GetObjectCommand',silent).code,'AP-S3-DNS/GetObjectCommand');
 assert.equal(storageError({$metadata:{httpStatusCode:429}},'PutObjectCommand',silent).code,'AP-S3-RATE/PutObjectCommand');
 assert.equal(storageError({$metadata:{httpStatusCode:403}},'PutObjectCommand',silent).code,'AP-S3-PERMISSION/PutObjectCommand');
});
test('login returns the actual sanitized storage failure and skips cleanup when probe creation failed',async()=>{
 const original=S3Client.prototype.send,log=console.error;let deletes=0;const logs=[];
 S3Client.prototype.send=async command=>{if(command.constructor.name==='DeleteObjectCommand')deletes++;throw provider('NoSuchBucket',404);};console.error=(...v)=>logs.push(v);
 try{const http=createHTTP(createStore(env),{env});const req=new Request(env.AUTOPILOT_SITE_ORIGIN+'/dayamora-autopilot-api/login',{method:'POST',headers:{origin:env.AUTOPILOT_SITE_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({key:env.AUTOPILOT_ADMIN_KEY})});const r=await http(req),body=await r.json();assert.equal(r.status,503);assert.ok(body.error.includes('AP-S3-BUCKET/PutObjectCommand'));assert.ok(!JSON.stringify({body,logs}).includes('DO-NOT-LOG'));assert.equal(deletes,0);}finally{S3Client.prototype.send=original;console.error=log;}
});
test('probe cleanup cannot mask the original conditional-write failure',async()=>{
 const original=S3Client.prototype.send,log=console.error;let puts=0,deletes=0;console.error=()=>{};
 S3Client.prototype.send=async command=>{if(command.constructor.name==='PutObjectCommand'){if(++puts===1)return{};throw provider('NotImplemented',501);}deletes++;throw provider('AccessDenied',403);};
 try{await assert.rejects(createStore(env).checkCAS(),e=>e.code==='AP-S3-UNSUPPORTED/PutObjectCommand');assert.equal(deletes,1);}finally{S3Client.prototype.send=original;console.error=log;}
});
test('malformed endpoint returns a safe setup error instead of raw URL input',()=>{assert.throws(()=>createStore({...env,AUTOPILOT_S3_ENDPOINT:'FAKE-SECRET-DO-NOT-LOG'}),e=>e.status===503&&!e.message.includes('DO-NOT-LOG')&&e.message.includes('Endpoint'));});
test('provider ignoring preconditions remains blocked; CAS protection is never bypassed',async()=>{
 const original=S3Client.prototype.send;S3Client.prototype.send=async()=>({});
 try{await assert.rejects(createStore(env).checkCAS(),/نوشتن شرطی/);}finally{S3Client.prototype.send=original;}
});
