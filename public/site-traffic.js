'use strict';
(()=>{
  const publicPaths=new Set(['/','/index.html','/shop','/value','/budget','/budget.html','/product','/product.html','/discover.html','/stylist.html','/boutique.html','/journal.html']);
  const path=location.pathname;
  if(publicPaths.has(path)||/^\/discover\/[a-z]+$/.test(path)){
    let sent=false;
    const send=()=>{
      if(sent||document.visibilityState!=='visible'||document.prerendering)return;
      sent=true;document.removeEventListener('visibilitychange',send);
      // Fire-and-forget. Analytics errors never interrupt the store or checkout.
      fetch('/api/site-traffic/view',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({path}),keepalive:true}).catch(()=>{});
    };
    document.addEventListener('visibilitychange',send);
    document.addEventListener('prerenderingchange',send,{once:true});send();
  }
  if(!['/admin','/admin.html'].includes(path))return;
  function mount(){
    const host=document.querySelector('#portalContent'),anchor=host?.querySelector('.portal-stats');
    if(!anchor||host.querySelector('#siteTrafficPanel'))return;
    const panel=document.createElement('section');panel.id='siteTrafficPanel';panel.className='portal-card';panel.setAttribute('aria-label','آمار بازدید سایت');
    panel.innerHTML='<div class="section-tools"><h2>آمار بازدید سایت</h2><button type="button" class="small-button" id="refreshSiteTraffic">به‌روزرسانی آمار</button></div><div id="siteTrafficNumbers" class="portal-stats" aria-live="polite"></div><p id="siteTrafficStatus" class="portal-form-note" role="status"></p><p class="portal-form-note">تعداد باز شدن صفحات است، نه تعداد افراد یکتا؛ بارگذاری مجدد هم یک بازدید است. بازدید مدیر واردشده و صفحات مدیریت محاسبه نمی‌شود. آمار از زمان نصب شروع می‌شود؛ روزها بر اساس ساعت ایران هستند.</p>';
    anchor.insertAdjacentElement('afterend',panel);
    const button=panel.querySelector('#refreshSiteTraffic'),status=panel.querySelector('#siteTrafficStatus'),numbers=panel.querySelector('#siteTrafficNumbers');
    async function load(){
      button.disabled=true;status.textContent='در حال دریافت آمار…';
      try{
        const d=await Daya.api('/api/admin/site-traffic');
        if(!panel.isConnected)return;
        numbers.replaceChildren();
        for(const [key,label] of [['today','بازدید امروز'],['last7Days','بازدید ۷ روز اخیر'],['last30Days','بازدید ۳۰ روز اخیر'],['total','کل بازدید ثبت‌شده']]){
          const card=document.createElement('div'),n=document.createElement('b'),caption=document.createElement('small');card.className='stat';n.textContent=Number(d[key]||0).toLocaleString('fa-IR');caption.textContent=label;card.append(n,caption);numbers.append(card);
        }
        status.textContent=d.startedOn?'شروع ثبت آمار: '+new Date(d.startedOn+'T12:00:00Z').toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'})+' · آخرین دریافت: '+new Date(d.asOf).toLocaleTimeString('fa-IR',{timeZone:'Asia/Tehran'}):'هنوز بازدیدی ثبت نشده است.';
      }catch{status.textContent='آمار در دسترس نیست؛ دوباره به‌روزرسانی کنید. این خطا روی ثبت محصول و سفارش اثری ندارد.';}
      finally{button.disabled=false;}
    }
    button.onclick=load;load();
  }
  const host=document.querySelector('#portalContent');if(host){new MutationObserver(mount).observe(host,{childList:true,subtree:true});mount();}
})();
