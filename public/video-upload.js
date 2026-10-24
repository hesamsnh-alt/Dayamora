'use strict';
window.VideoUpload={
 maxBytes:100*1024*1024,
 async validate(file){const type=['video/mp4','video/webm'].includes(file.type)?file.type:/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':'';if(!type||file.size<16||file.size>this.maxBytes)throw Error('ویدیو باید MP4 یا WebM و حداکثر ۱۰۰ مگابایت باشد.');const b=new Uint8Array(await file.slice(0,64).arrayBuffer()),valid=type==='video/mp4'?String.fromCharCode(...b.slice(4,8))==='ftyp':b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3;if(!valid)throw Error('محتوای فایل با فرمت MP4 یا WebM مطابقت ندارد.');return type},
 async upload(file,onProgress=()=>{}){const type=await this.validate(file);return new Promise((resolve,reject)=>{
  const frame=document.createElement('iframe'),token=crypto.randomUUID();frame.hidden=true;frame.title='آپلود ویدیوی محصول';let finished=false;
  const cleanup=()=>{clearTimeout(timeout);removeEventListener('message',receive);frame.remove()};
  const finish=(error,result)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(result)};
  const timeout=setTimeout(()=>finish(Error('مهلت آپلود ویدیو تمام شد.')),11*60*1000);
  function receive(e){if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data?.kind==='dayamora-video-ready'){frame.contentWindow.postMessage({kind:'dayamora-video-file',file,token,type},location.origin);return}if(e.data?.kind!=='dayamora-video-upload'||e.data.token!==token)return;if(typeof e.data.progress==='number')onProgress(e.data.progress);if(e.data.error)finish(Error(e.data.error));else if(e.data.done){if(!/^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/.test(e.data.videoUrl||''))finish(Error('آدرس ویدیوی ذخیره‌شده معتبر نیست.'));else finish(null,{videoUrl:e.data.videoUrl})}}
  addEventListener('message',receive);frame.onerror=()=>finish(Error('صفحهٔ آپلود مستقیم باز نشد.'));frame.src='/api/admin/video/frame';document.body.append(frame);onProgress(0);
 })}
};
