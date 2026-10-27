'use strict';
// The only store-page integration: an independent control on the admin page.
// No shop API calls, shared modal, database writes or existing event handlers.
(()=>{
 if(!['/admin','/admin.html'].includes(location.pathname))return;
 const host=document.querySelector('#portalContent');if(!host)return;
 const API='/dayamora-autopilot-api';
 function element(tag,value,cls){const e=document.createElement(tag);if(value)e.textContent=value;if(cls)e.className=cls;return e;}
 function mount(){
  // The authenticated admin dashboard supplies this anchor. Login/denied views do not.
  if(!host.querySelector('.portal-stats')||host.querySelector('#adminAutopilotControl'))return;
  const panel=element('section','','portal-card');panel.id='adminAutopilotControl';panel.setAttribute('aria-label','کنترل اتوپایلت');
  const tools=element('div','','section-tools'),title=element('h2','اتوپایلت دایامورا'),status=element('strong','وضعیت: در حال دریافت…');status.setAttribute('aria-live','polite');
  const toggle=element('button','کنترل اتوپایلت','pink');toggle.type='button';toggle.disabled=true;toggle.style.minHeight='44px';
  const refresh=element('button','به‌روزرسانی وضعیت','small-button');refresh.type='button';refresh.style.minHeight='44px';
  const link=element('a','پیش‌نویس‌ها و تنظیمات ↗','small-button');link.href='/autopilot.html';
  tools.append(title,status,toggle,refresh,link);const help=element('p','با این کلید، پژوهش زمان‌بندی‌شده و پیشنهاد سئو روشن یا متوقف می‌شود.','portal-form-note');
  const feedback=element('p','','portal-form-note');feedback.setAttribute('role','status');panel.append(tools,help,feedback);
  // Own dialog, separate from the shop product/order modal.
  const dialog=element('dialog');dialog.id='adminAutopilotKeyDialog';dialog.setAttribute('aria-label','اتصال مدیریت اتوپایلت');
  const form=element('form','','daya-form'),heading=element('h2','اتصال به اتوپایلت'),label=element('label','کلید مدیریت اختصاصی اتوپایلت'),input=element('input');
  input.type='password';input.required=true;input.minLength=32;input.maxLength=256;input.autocomplete='current-password';input.id='adminAutopilotKey';label.htmlFor=input.id;label.append(input);
  const hint=element('p','مقدار AUTOPILOT_ADMIN_KEY را وارد کنید؛ این رمز با کلید OpenAI متفاوت است.','portal-form-note'),error=element('p','','form-error');error.setAttribute('role','alert');
  const submit=element('button','اتصال و نمایش وضعیت','pink');submit.type='submit';const cancel=element('button','بستن','small-button');cancel.type='button';form.append(heading,label,hint,error,submit,cancel);dialog.append(form);panel.append(dialog);host.prepend(panel);
  let enabled=null,busy=false;
  async function api(path,data){const r=await fetch(API+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let b;try{b=await r.json();}catch{throw new Error('فایل‌های API اتوپایلت هنوز در دیپلوی در دسترس نیستند.');}if(!r.ok)throw Object.assign(new Error(b.error||'ارتباط با اتوپایلت برقرار نشد.'),{status:r.status});return b;}
  function display(){
   toggle.disabled=busy;refresh.disabled=busy;
   if(enabled===null){status.textContent='وضعیت: اتصال برقرار نیست';toggle.textContent='اتصال و کنترل اتوپایلت';toggle.removeAttribute('role');toggle.removeAttribute('aria-checked');return;}
   status.textContent=enabled?'● اتوپایلت فعال است':'○ اتوپایلت غیرفعال است';toggle.textContent=enabled?'غیرفعال‌کردن اتوپایلت':'فعال‌کردن اتوپایلت';toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(enabled));
  }
  async function read(){try{const s=await api('/state');if(!panel.isConnected)return;enabled=s.enabled;feedback.textContent='';display();return true;}catch(e){enabled=null;if(panel.isConnected){feedback.textContent=e.status===401?'برای کنترل از همین صفحه، یک‌بار با کلید مدیریت اتوپایلت متصل شوید.':e.message;display();}return false;}}
  cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{input.value='';error.textContent='';});
  form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.textContent='';const key=input.value;input.value='';try{await api('/login',{key});if(await read())dialog.close();else error.textContent='اتصال انجام شد ولی دریافت وضعیت ممکن نشد؛ دوباره تلاش کنید.';}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};
  toggle.onclick=async()=>{
   if(busy)return;if(enabled===null){if(await read())return;if(!panel.isConnected)return;dialog.showModal();input.focus();return;}
   const target=!enabled;busy=true;display();feedback.textContent=target?'در حال فعال‌کردن…':'در حال توقف…';
   try{await api('/enabled',{enabled:target});if(await read())feedback.textContent=target?'اتوپایلت فعال شد.':'اتوپایلت متوقف شد. نتیجهٔ کار در جریان پس از توقف ذخیره نمی‌شود؛ درخواست قبلاً ارسال‌شده ممکن است هزینه داشته باشد.';}catch(e){enabled=null;feedback.textContent=e.message;}finally{busy=false;if(panel.isConnected)display();}
  };
  refresh.onclick=async()=>{if(busy)return;busy=true;display();try{await read();}finally{busy=false;if(panel.isConnected)display();}};
  read();
 }
 new MutationObserver(mount).observe(host,{childList:true,subtree:true});mount();
})();
