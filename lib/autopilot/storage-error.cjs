'use strict';
// Never return/log provider messages, request headers, URLs, credentials or stacks.
const ERRORS={
 InvalidAccessKeyId:['AP-S3-ID','Access Key ID فضای اتوپایلت معتبر نیست. مقدار token_id اعتبارنامهٔ جدید Neon را بررسی کنید.'],
 SignatureDoesNotMatch:['AP-S3-SIGNATURE','امضای اتصال فضای اتوپایلت تأیید نشد. Secret Access Key، شناسهٔ متناظر و Region را بررسی کنید؛ کلید و سکرت باید از یک اعتبارنامهٔ Neon باشند.'],
 AccessDenied:['AP-S3-PERMISSION','مجوز دسترسی به فضای اتوپایلت رد شد. اعتبارنامهٔ Neon باید مجوز storage:write داشته و متعلق به شاخهٔ همین آدرس باشد.'],
 NoSuchBucket:['AP-S3-BUCKET','باکت اتوپایلت در این آدرس پیدا نشد. نام باکت و Endpoint باید مربوط به یک شاخهٔ Neon باشند.'],
 InvalidBucketName:['AP-S3-BUCKET-NAME','نام باکت اتوپایلت معتبر نیست. فقط نام باکت را وارد کنید؛ نه آدرس یا مسیر آن.'],
 ExpiredToken:['AP-S3-EXPIRED','اعتبارنامهٔ ذخیره‌سازی اتوپایلت منقضی شده است.'],
 InvalidToken:['AP-S3-TOKEN','توکن ذخیره‌سازی اتوپایلت معتبر نیست. برای S3 باید token_id و s3_secret_access_key اعتبارنامه استفاده شوند.'],
 AuthorizationHeaderMalformed:['AP-S3-REGION','منطقه یا مشخصات امضای اتصال اتوپایلت معتبر نیست. Region این فضای Neon باید us-east-2 باشد.'],
 PermanentRedirect:['AP-S3-ENDPOINT','Endpoint یا Region به فضای انتخاب‌شده مربوط نیست.'],
 NotImplemented:['AP-S3-UNSUPPORTED','عملیات لازم در این فضای ذخیره‌سازی پشتیبانی نمی‌شود. حفاظت اجرای هم‌زمان غیرفعال نشده است.'],
 InvalidArgument:['AP-S3-ARGUMENT','سرویس ذخیره‌سازی یکی از پارامترهای درخواست را نپذیرفت. کد مرحلهٔ خطا را برای بررسی بفرستید.'],
 ENOTFOUND:['AP-S3-DNS','آدرس Endpoint فضای اتوپایلت پیدا نمی‌شود.'],
 EAI_AGAIN:['AP-S3-DNS','پاسخ DNS فضای اتوپایلت دریافت نشد. دوباره تلاش کنید.'],
 ECONNREFUSED:['AP-S3-CONNECTION','اتصال به Endpoint فضای اتوپایلت برقرار نشد.'],
 ETIMEDOUT:['AP-S3-TIMEOUT','زمان اتصال به فضای اتوپایلت تمام شد.'],
 TimeoutError:['AP-S3-TIMEOUT','زمان اتصال به فضای اتوپایلت تمام شد.'],
 AbortError:['AP-S3-TIMEOUT','درخواست ذخیره‌سازی اتوپایلت قطع شد.']
};
function storageError(error,operation='S3',logger=console){
 const http=Number(error?.$metadata?.httpStatusCode)||0;
 const match=ERRORS[error?.name]||ERRORS[error?.code]||ERRORS[error?.cause?.code];
 const selected=match||(http===401||http===403?ERRORS.AccessDenied:http===429?['AP-S3-RATE','محدودیت تعداد درخواست فضای اتوپایلت؛ کمی بعد دوباره تلاش کنید.']:http===501?ERRORS.NotImplemented:['AP-S3-UNKNOWN','سرویس ذخیره‌سازی اتوپایلت خطای دیگری داد. کد مرحلهٔ خطا را برای بررسی بفرستید.']);
 const stage=['GetObjectCommand','PutObjectCommand','DeleteObjectCommand'].includes(operation)?operation:'S3';
 const code=selected[0]+'/'+stage;
 logger.error('[autopilot-storage]',JSON.stringify({code,httpStatus:http||null}));
 return Object.assign(new Error(selected[1]+' ['+code+']'),{status:503,code});
}
module.exports={storageError};
