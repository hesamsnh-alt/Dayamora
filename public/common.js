'use strict';
window.Daya={
 escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
 money(v){return Number(v).toLocaleString('fa-IR')+' تومان'},
 date(v){return new Date(v).toLocaleString('fa-IR')},
 status(v){return({pending:'در انتظار بررسی',confirmed:'تأییدشده',completed:'تکمیل‌شده',cancelled:'لغوشده'})[v]||v},
 async api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const type=r.headers.get('content-type')||'';if(!type.includes('application/json')){const e=new Error(r.status>=500?'بخش سرور فروشگاه هنگام اجرا خطا داده است. لطفاً کمی بعد دوباره امتحان کنید.':r.status===404?'مسیر سرور فروشگاه در دسترس نیست.':'پاسخ سرور فروشگاه معتبر نیست.');e.status=r.status;throw e}const d=await r.json();if(!r.ok){const blocked=d.error==='usage_exceeded';const e=new Error(blocked?'سرویس میزبانی درخواست را با خطای usage_exceeded متوقف کرده است؛ بخش Usage & billing نتلیفای را بررسی کنید.':d.error||'ارتباط با سرور ناموفق بود.');e.status=r.status;e.serviceBlocked=blocked;throw e}return d},
 message(text,bad=false){const n=document.querySelector('#pageMessage');if(n){n.hidden=false;n.textContent=text;n.className='page-message'+(bad?' error':'')}},
 async logout(){await Daya.api('/api/logout',{method:'POST',body:'{}'});location.href='/'},
 async fileData(file){if(!file||file.size>3*1024*1024)throw new Error('عکس باید حداکثر ۳ مگابایت باشد.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('خواندن عکس ناموفق بود.'));r.readAsDataURL(file)})}
};
