'use strict';
const {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {fail}=require('./validation.cjs');const {randomUUID}=require('node:crypto');
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
  await client().send(new PutObjectCommand({Bucket:bucket(),Key:url.slice(1),Body:bytes,ContentType:'image/'+type,
    CacheControl:privateImage?'private, no-store':'public, max-age=31536000, immutable'}));
  return url;
}
async function download(url){
  const r=await client().send(new GetObjectCommand({Bucket:bucket(),Key:url.slice(1)}));
  return {bytes:await r.Body.transformToByteArray(),type:r.ContentType||'application/octet-stream'};
}
async function remove(url){await client().send(new DeleteObjectCommand({Bucket:bucket(),Key:url.slice(1)}))}
module.exports={upload,download,remove,decodeImage};
