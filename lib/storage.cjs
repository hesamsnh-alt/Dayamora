'use strict';
const {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadObjectCommand,CopyObjectCommand,GetBucketCorsCommand,PutBucketCorsCommand}=require('@aws-sdk/client-s3');
const {fail}=require('./validation.cjs');const {randomUUID}=require('node:crypto');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
const {storageFailure}=require('./storage-errors.cjs');
function client(){
  for(const k of ['DAYAMORA_S3_ENDPOINT','DAYAMORA_S3_ACCESS_KEY_ID','DAYAMORA_S3_SECRET_ACCESS_KEY'])
    if(!process.env[k])throw fail(503,'فضای ذخیره‌سازی عکس‌های فروشگاه هنوز آماده نشده است.');
  const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;
  const requestHandler=proxy?new(require('@smithy/node-http-handler').NodeHttpHandler)({httpsAgent:new(require('https-proxy-agent').HttpsProxyAgent)(proxy),connectionTimeout:12000,requestTimeout:20000}):undefined;
  return new S3Client({endpoint:process.env.DAYAMORA_S3_ENDPOINT,region:process.env.DAYAMORA_S3_REGION||'us-east-2',requestHandler,
    credentials:{accessKeyId:process.env.DAYAMORA_S3_ACCESS_KEY_ID,secretAccessKey:process.env.DAYAMORA_S3_SECRET_ACCESS_KEY},
    forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
}
const bucket=()=>process.env.DAYAMORA_S3_BUCKET||'uploads';
function decodeImage(base64){
  if(typeof base64!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(base64))throw fail(400,'فقط عکس JPEG، PNG یا WebP معتبر است.');
  const type=base64.match(/^data:image\/(\w+);/)[1],bytes=Buffer.from(base64.split(',')[1],'base64');
  if(bytes.length>3*1024*1024)throw fail(413,'حجم عکس باید حداکثر ۳ مگابایت باشد.');
  const valid=type==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw fail(400,'فرمت و محتوای عکس مطابقت ندارند.');
  return {bytes,type,ext:type==='jpeg'?'jpg':type};
}
async function upload(base64,privateImage=false){
  const {bytes,type,ext}=decodeImage(base64),url=(privateImage?'/private-uploads/':'/uploads/')+randomUUID()+'.'+ext;
  try{
    await client().send(new PutObjectCommand({Bucket:bucket(),Key:url.slice(1),Body:bytes,ContentType:'image/'+type,
      CacheControl:privateImage?'private, no-store':'public, max-age=31536000, immutable'}));
  }catch(e){if(e.status)throw e;throw storageFailure(e)}
  return url;
}
async function download(url){
  const r=await client().send(new GetObjectCommand({Bucket:bucket(),Key:url.slice(1)}));
  return {bytes:await r.Body.transformToByteArray(),type:r.ContentType||'application/octet-stream'};
}
async function uploadVideo(base64){
 if(typeof base64!=='string'||!/^data:video\/(mp4|webm);base64,[A-Za-z0-9+/=]+$/.test(base64))throw fail(400,'فقط ویدیوی MP4 یا WebM قابل بارگذاری است.');
 const type=base64.match(/^data:video\/(\w+);/)[1],bytes=Buffer.from(base64.split(',')[1],'base64');
 if(bytes.length>3*1024*1024)throw fail(413,'برای آپلود مستقیم ویدیو حداکثر ۳ مگابایت مجاز است؛ برای فایل بزرگ‌تر لینک مستقیم ویدیو بدهید.');
 const valid=type==='mp4'?bytes.length>12&&bytes.toString('ascii',4,8)==='ftyp':bytes.length>4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
 if(!valid)throw fail(400,'محتوای فایل با فرمت ویدیو مطابقت ندارد.');
 const url='/uploads/'+randomUUID()+'.'+type;
 try{await client().send(new PutObjectCommand({Bucket:bucket(),Key:url.slice(1),Body:bytes,ContentType:'video/'+type,CacheControl:'public, max-age=31536000, immutable'}))}catch(e){if(e.status)throw e;throw storageFailure(e)}
 return url;
}
async function uploadImportedVideo(bytes,type){
 const metadata=videoMetadata(bytes.length,type);if(!videoSignature(bytes,type))throw fail(400,'محتوای ویدیو معتبر نیست.');
 const url='/uploads/'+randomUUID()+'.'+metadata.ext;
 try{await client().send(new PutObjectCommand({Bucket:bucket(),Key:url.slice(1),Body:bytes,ContentType:type,CacheControl:'public, max-age=31536000, immutable'}))}catch(e){if(e.status)throw e;throw storageFailure(e)}
 return url;
}
async function remove(url){await client().send(new DeleteObjectCommand({Bucket:bucket(),Key:url.slice(1)}))}
const MAX_VIDEO_BYTES=100*1024*1024;
function videoMetadata(size,type){if(!['video/mp4','video/webm'].includes(type)||!Number.isSafeInteger(size)||size<16||size>MAX_VIDEO_BYTES)throw fail(400,'ویدیو باید MP4 یا WebM و حداکثر ۱۰۰ مگابایت باشد.');return{size,type,ext:type==='video/mp4'?'mp4':'webm'}}
function videoSignature(bytes,type){return type==='video/mp4'?bytes.length>12&&bytes.toString('ascii',4,8)==='ftyp':bytes.length>4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))}
async function signVideoUpload(record){return getSignedUrl(client(),new PutObjectCommand({Bucket:bucket(),Key:record.key,ContentType:record.type,ContentLength:record.size}),{expiresIn:600})}
async function finishVideo(record){
 const c=client(),b=bucket();let head;
 try{head=await c.send(new HeadObjectCommand({Bucket:b,Key:record.key}));}catch{throw fail(409,'فایل ویدیو هنوز کامل در فضای ذخیره‌سازی قرار نگرفته است.');}
 if(head.ContentLength!==record.size||head.ContentLength>MAX_VIDEO_BYTES||head.ContentType!==record.type)throw fail(400,'حجم یا نوع فایل بارگذاری‌شده با ویدیوی انتخاب‌شده مطابقت ندارد.');
 const first=await c.send(new GetObjectCommand({Bucket:b,Key:record.key,Range:'bytes=0-63',IfMatch:head.ETag})),bytes=Buffer.from(await first.Body.transformToByteArray());
 if(!videoSignature(bytes,record.type))throw fail(400,'محتوای فایل، ویدیوی MP4 یا WebM معتبر نیست.');
 // Commit to a different key: a reusable temporary PUT link cannot overwrite live media.
 await c.send(new CopyObjectCommand({Bucket:b,Key:record.videoUrl.slice(1),CopySource:b+'/'+record.key,CopySourceIfMatch:head.ETag,ContentType:record.type,MetadataDirective:'REPLACE',CacheControl:'public, max-age=31536000, immutable'}));
 return record.videoUrl;
}
async function videoDownloadUrl(url){return getSignedUrl(client(),new GetObjectCommand({Bucket:bucket(),Key:url.slice(1),ResponseContentType:url.endsWith('.mp4')?'video/mp4':'video/webm'}),{expiresIn:3600})}
async function configureVideoCors(origin){
 const u=new URL(origin);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.origin!==origin)throw fail(400,'دامنهٔ سایت معتبر نیست.');
 const c=client();let rules=[];try{rules=(await c.send(new GetBucketCorsCommand({Bucket:bucket()}))).CORSRules||[]}catch(e){if(!['NoSuchCORSConfiguration','NoSuchCORS'].includes(e.name))throw fail(503,'مجوز خواندن CORS فضای ذخیره‌سازی در دسترس نیست؛ تنظیم PUT برای دامنهٔ همین سایت را در پنل فضای ذخیره‌سازی اضافه کنید.');}
 if(rules.some(r=>(r.AllowedOrigins||[]).includes(origin)&&(r.AllowedMethods||[]).includes('PUT')&&(r.AllowedHeaders||[]).some(h=>['*','content-type'].includes(h.toLowerCase()))))return;
 try{await c.send(new PutBucketCorsCommand({Bucket:bucket(),CORSConfiguration:{CORSRules:[...rules,{AllowedOrigins:[origin],AllowedMethods:['PUT'],AllowedHeaders:['content-type'],ExposeHeaders:['ETag'],MaxAgeSeconds:600}]}}))}catch{throw fail(503,'مجوز ثبت CORS در دسترس نیست؛ تنظیم PUT برای دامنهٔ همین سایت را در پنل فضای ذخیره‌سازی اضافه کنید.');}
}
module.exports={upload,uploadVideo,uploadImportedVideo,download,remove,decodeImage,MAX_VIDEO_BYTES,videoMetadata,videoSignature,signVideoUpload,finishVideo,videoDownloadUrl,configureVideoCors};
