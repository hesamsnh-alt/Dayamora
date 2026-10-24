'use strict';
(()=>{
 const send=(token,data)=>parent.postMessage({kind:'dayamora-video-upload',token,...data},location.origin);
 async function api(path,body){const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let b;try{b=await r.json()}catch{throw Error('پاسخ سرور آپلود معتبر نیست.')}if(!r.ok)throw Error(b.error||'آپلود انجام نشد.');return b}
 let busy=false;
 addEventListener('message',async e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.kind!=='dayamora-video-file'||busy)return;
  const {file,token,type}=e.data;if(!(file instanceof File)||typeof token!=='string')return;busy=true;
  try{
   const start=await api('/api/admin/video/start',{size:file.size,type});const target=new URL(start.uploadUrl);
   // CSP restricts network access to the configured object-storage endpoint.
   if(target.protocol!=='https:')throw Error('آدرس آپلود امن نیست.');
   await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('PUT',start.uploadUrl);x.setRequestHeader('Content-Type',start.type);x.timeout=10*60*1000;x.upload.onprogress=p=>{if(p.lengthComputable)send(token,{progress:Math.min(99,Math.floor(p.loaded/p.total*100))})};x.onload=()=>x.status>=200&&x.status<300?resolve():reject(Error('فضای ذخیره‌سازی آپلود را نپذیرفت؛ مجوز PUT و CORS همین سایت را بررسی کنید.'));x.onerror=()=>reject(Error('ارتباط آپلود قطع شد یا CORS فضای ذخیره‌سازی تنظیم نیست. دکمهٔ «فعال‌سازی آپلود مستقیم» را بزنید و دوباره تلاش کنید.'));x.ontimeout=()=>reject(Error('مهلت آپلود تمام شد؛ اتصال اینترنت را بررسی کنید.'));x.send(file)});
   send(token,{progress:99});const completed=await api('/api/admin/video/complete',{id:start.id});send(token,{done:true,videoUrl:completed.videoUrl,progress:100});
  }catch(error){send(token,{error:error.message||'آپلود انجام نشد.'})}finally{busy=false}
 });
 parent.postMessage({kind:'dayamora-video-ready'},location.origin);
})();
