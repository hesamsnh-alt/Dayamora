'use strict';

// Log selected fields only. Never serialize SDK errors, requests or credentials.
function safeMessage(error,env=process.env){
  let message=String(error?.message||'Unknown error');
  const secrets=[];
  for(const [key,value] of Object.entries(env)){
    if(!value||!/SECRET|PASSWORD|TOKEN|ACCESS_KEY|DATABASE_URL|PROXY/i.test(key))continue;
    secrets.push(String(value),String(value).trim().replace(/^(['"])(.*)\1$/s,'$2'));
    if(/URL|PROXY/.test(key))try{const u=new URL(value);for(const v of [u.username,u.password])if(v)secrets.push(v,decodeURIComponent(v))}catch{}
  }
  for(const value of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))message=message.split(value).join('[REDACTED]');
  return message.replace(/(?:https?|postgres(?:ql)?):\/\/[^\s'"<>]+/gi,'[URL]')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi,'[AUTH]')
    .replace(/[\r\n\t]+/g,' ').slice(0,300);
}
function identifier(value,fallback){return /^[A-Za-z0-9_.-]{1,80}$/.test(String(value||''))?String(value):fallback}
function storageFailure(error){
  const name=identifier(error?.code||error?.name,'Error'),message=String(error?.message||'');
  let code=name==='Error'?'STORAGE_REQUEST_FAILED':name;
  if(/region.*(?:valid|missing)|(?:valid|missing).*region/i.test(message))code='STORAGE_REGION_INVALID';
  if(/invalid url/i.test(message))code='STORAGE_ENDPOINT_INVALID';
  if(/credential.*(?:valid|missing)|(?:valid|missing).*credential/i.test(message))code='STORAGE_CREDENTIAL_INVALID';
  const hints={
    InvalidAccessKeyId:'شناسهٔ کلید فضای عکس معتبر نیست؛ DAYAMORA_S3_ACCESS_KEY_ID را بررسی کنید.',
    SignatureDoesNotMatch:'امضای اتصال فضای عکس تأیید نشد؛ کلید مخفی و Region را بررسی کنید.',
    AccessDenied:'دسترسی به فضای عکس رد شد؛ مجوز نوشتن و شاخهٔ کلید را بررسی کنید.',
    NoSuchBucket:'باکت در این اتصال پیدا نشد؛ نام باکت و شاخهٔ Endpoint را بررسی کنید.',
    STORAGE_REGION_INVALID:'مقدار DAYAMORA_S3_REGION معتبر نیست؛ فقط مقدار Region را وارد کنید.',
    STORAGE_ENDPOINT_INVALID:'مقدار DAYAMORA_S3_ENDPOINT معتبر نیست؛ آدرس کامل HTTPS را وارد کنید.',
    STORAGE_CREDENTIAL_INVALID:'ساختار کلیدهای فضای عکس معتبر نیست؛ مقدارهای Access Key و Secret Key را بررسی کنید.',
    ENOTFOUND:'آدرس سرور فضای عکس پیدا نشد؛ Endpoint را بررسی کنید.',
    ETIMEDOUT:'مهلت اتصال به فضای عکس تمام شد.',
    TimeoutError:'مهلت اتصال به فضای عکس تمام شد.'
  };
  const result=new Error((hints[code]||'آپلود عکس ناموفق بود؛ جزئیات خطا در Function log ثبت شد.')+' ['+code+']');
  result.status=502;
  result.diagnostic={stage:'storage.upload',code,message:safeMessage(error)};
  if(Number.isInteger(error?.$metadata?.httpStatusCode))result.diagnostic.httpStatus=error.$metadata.httpStatusCode;
  if(error?.cause)result.diagnostic.cause=safeMessage(error.cause);
  return result;
}
module.exports={safeMessage,storageFailure};
