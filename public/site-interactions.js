'use strict';
(()=>{
 const C=window.DayaInteractions;if(!C||window.__dayaInteractionsLoaded)return;window.__dayaInteractionsLoaded=true;
 const path=location.pathname,adminPage=['/admin','/admin.html'].includes(path);
 const paths=new Set(['/','/index.html','/shop','/value','/budget','/budget.html','/product','/product.html','/discover.html','/stylist.html','/boutique.html','/journal.html']);
 if(paths.has(path)||/^\/discover\/[a-z]+$/.test(path))track();
 if(adminPage){const css=document.createElement('link');css.rel='stylesheet';css.href='/site-interactions.css';document.head.append(css);const host=document.querySelector('#portalContent');if(host){new MutationObserver(mount).observe(host,{childList:true,subtree:true});mount();}}
 function track(){
  let queue=[],timer=null,searchTimer=null,started=false,inFlight=false,lastSearch='',sent=0,lastClick='',lastClickAt=0;const MAX_EVENTS=120;
  function flush(){
   clearTimeout(timer);timer=null;if(inFlight||!queue.length)return;
   const events=queue.splice(0,16);inFlight=true;
   // No persistent identifier and no retry: uncertain responses must not double counts.
   fetch('/api/site-traffic/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,events}),keepalive:true}).catch(()=>{}).finally(()=>{inFlight=false;if(queue.length&&document.visibilityState==='visible')timer=setTimeout(flush,1500);});
  }
  function add(e){if(document.visibilityState!=='visible'||document.prerendering||sent>=MAX_EVENTS)return;sent++;queue.push(e);if(queue.length>=16)flush();else if(!timer)timer=setTimeout(flush,1500);}
  function resultCount(){
   const home=document.querySelector('#products'),budget=document.querySelector('#budgetResults');
   if(home&&/محصول/.test(document.querySelector('#results')?.textContent||''))return home.querySelectorAll('.product').length;
   if(budget&&document.querySelector('#budgetResultCount')?.textContent)return budget.querySelectorAll('.mini-product').length;
   const ask=document.querySelector('#askResults');if(ask?.children.length)return ask.querySelectorAll('.discover-product').length;
   return null;
  }
  function search(value){const term=C.term(value);if(!term||term===lastSearch)return;lastSearch=term;add({kind:'search',term,zero:resultCount()===0});}
  function start(){if(started||document.visibilityState!=='visible'||document.prerendering)return;started=true;
   if(['/product','/product.html'].includes(path)){const id=C.product(new URLSearchParams(location.search).get('id'));if(id)add({kind:'productView',id});}
   const initial=new URLSearchParams(location.search).get('q');if(initial)searchTimer=setTimeout(()=>search(initial),1800);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();else start();});document.addEventListener('prerenderingchange',start);window.addEventListener('pagehide',flush);start();
  document.addEventListener('input',e=>{if(e.isComposing||!e.target.matches('#searchBox,#budgetSearch'))return;clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(e.target.value),1800);},{passive:true});
  document.addEventListener('compositionend',e=>{if(!e.target.matches('#searchBox,#budgetSearch'))return;clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(e.target.value),1800);});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('#searchBox,#budgetSearch')){clearTimeout(searchTimer);search(e.target.value);}});
  document.addEventListener('submit',e=>{
   // Header search navigates to ?q=; count on the destination, not twice.
   if(e.target.id==='askForm'){const value=e.target.elements.q?.value;setTimeout(()=>search(value),0);}
  },true);
  document.addEventListener('change',e=>{const id=({'catalogColor':'filter_color','budgetColor':'filter_color','catalogSize':'filter_size','budgetSize':'filter_size','sort':'sort','budgetSort':'sort'})[e.target.id];if(id)add({kind:'section',key:'content:'+id});},{passive:true});
  document.addEventListener('click',e=>{
   if(e.button>0)return;const el=e.target.closest('a,button');if(!el||el.disabled)return;
   const slot=el.closest('header')?'header':el.closest('footer')?'footer':el.closest('.campaign-slider')?'banner':el.closest('.categories,.budget-categories')?'categories':el.closest('.promo,.promos,.small-hero,.discovery-card')?'promo':'content';
   let event=null,id=C.product(el.dataset.detail||el.dataset.add||el.dataset.budgetAdd||el.dataset.quickAdd);
   const isCart=el.hasAttribute('data-add')||el.hasAttribute('data-budget-add')||el.hasAttribute('data-quick-add')||el.id==='productAdd';
   if(el.id==='productAdd')id=C.product(new URLSearchParams(location.search).get('id'));
   if(id)event={kind:isCart?'cartClick':'productClick',id};
   else if(el.matches('a[href]')){
    let u;try{u=new URL(el.href,location.href);}catch{return;}if(u.origin!==location.origin)return;
    id=['/product','/product.html'].includes(u.pathname)?C.product(u.searchParams.get('id')):null;
    if(id)event={kind:'productClick',id};else{const section=C.destination(u);if(section)event={kind:'section',key:slot+':'+section};}
   }else{
    const cat=C.categories[el.dataset.cat||el.dataset.category],section=cat||(['cartToggle','cartOpen'].includes(el.id)?'cart':el.id==='favorites'?'favorites':['applyBudget','budgetGo'].includes(el.id)?'budget':el.id==='account'?'club':el.id==='showAll'?'shop':el.id==='allBrands'||el.hasAttribute('data-brand')?'brands':el.classList.contains('photo-search-trigger')?'search_photo':Object.hasOwn(C.sections,el.dataset.info||'')?el.dataset.info:'');
    if(section)event={kind:'section',key:slot+':'+section};
   }
   if(!event)return;const key=JSON.stringify(event),now=Date.now();if(key===lastClick&&now-lastClickAt<600)return;lastClick=key;lastClickAt=now;add(event);
   if(el.matches('a[href]'))flush();
  },true);
 }
 function mount(){
  const parent=document.querySelector('#siteTrafficPanel');if(!parent||parent.querySelector('#siteInteractionsPanel'))return;
  const panel=document.createElement('section');panel.id='siteInteractionsPanel';panel.className='site-interactions';panel.setAttribute('aria-label','گزارش تعامل کاربران');
  const tools=document.createElement('div');tools.className='section-tools';const title=document.createElement('h3');title.textContent='کلیک‌ها و جست‌وجوهای کاربران';const period=document.createElement('select');period.setAttribute('aria-label','بازه گزارش تعامل');for(const [value,text] of [[1,'امروز'],[7,'۷ روز اخیر'],[30,'۳۰ روز اخیر']]){const o=document.createElement('option');o.value=value;o.textContent=text;period.append(o);}period.value='7';
  const button=document.createElement('button');button.type='button';button.className='small-button';button.textContent='به‌روزرسانی تعامل';tools.append(title,period,button);
  const status=document.createElement('p');status.className='portal-form-note';status.setAttribute('role','status');const numbers=document.createElement('div');numbers.className='portal-stats';const grid=document.createElement('div');grid.className='interaction-grid';
  const note=document.createElement('p');note.className='portal-form-note';note.textContent='آمار تجمعی مهمان‌ها و مشتریان است؛ هویت یا مسیر حرکت افراد ثبت نمی‌شود. تایپ جست‌وجو پس از مکث یا Enter ثبت می‌شود. کلیک سبد به معنی خرید موفق نیست. مدیر واردشده و ربات‌های شناخته‌شده محاسبه نمی‌شوند. آمار تعامل فقط از زمان نصب این قابلیت ثبت می‌شود و تقریبی است؛ جست‌وجوهای شبیه اطلاعات تماس و لینک کنار گذاشته می‌شوند.';
  panel.append(tools,status,numbers,grid,note);parent.append(panel);let version=0;
  function table(title,rows,label,count,product=false){
   const box=document.createElement('section'),h=document.createElement('h4');box.className='interaction-list';h.textContent=title;box.append(h);
   if(!rows.length){const p=document.createElement('p');p.textContent='هنوز داده‌ای در این بازه ثبت نشده است.';box.append(p);grid.append(box);return;}
   const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const text of ['بخش / عبارت / محصول','تعداد']){const th=document.createElement('th');th.scope='col';th.textContent=text;tr.append(th);}head.append(tr);t.append(head);const body=document.createElement('tbody');
   rows.forEach(r=>{const tr=document.createElement('tr'),name=document.createElement('td'),n=document.createElement('td');n.textContent=Number(count(r)).toLocaleString('fa-IR');if(product){const a=document.createElement('a');a.href='/product?id='+r.id;a.textContent=label(r);name.append(a);}else name.textContent=label(r);tr.append(name,n);body.append(tr);});t.append(body);box.append(t);grid.append(box);
  }
  async function load(){const v=++version;button.disabled=true;status.textContent='در حال دریافت گزارش تعامل…';
   try{const r=await Daya.api('/api/admin/site-interactions?days='+period.value);if(v!==version||!panel.isConnected)return;numbers.replaceChildren();grid.replaceChildren();
    for(const [key,label] of [['clicks','کلیک ثبت‌شده'],['productViews','بازشدن صفحه محصول'],['searches','جست‌وجو'],['zeroSearches','جست‌وجوی بدون نتیجه']]){const card=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');card.className='stat';b.textContent=Number(r.totals[key]||0).toLocaleString('fa-IR');small.textContent=label;card.append(b,small);numbers.append(card);}
    table('بخش‌های پرکلیک',r.sections,x=>{const [slot,id]=x.key.split(':');return C.slots[slot]+' · '+C.sections[id];},x=>x.count);
    table('محصولات پرکلیک',r.products.clicks,x=>x.name,x=>x.count,true);table('صفحه‌های محصول پربازدید',r.products.views,x=>x.name,x=>x.count,true);
    table('جست‌وجوهای پرتکرار',r.searches,x=>x.term,x=>x.count);table('جست‌وجوهای بدون نتیجه',r.zeroSearches,x=>x.term,x=>x.zero);table('کلیک افزودن به سبد',r.products.cart,x=>x.name,x=>x.count,true);
    status.textContent='از '+r.from+' تا '+r.to+' · ساعت ایران'+(r.omitted?' · بخشی از رویدادها به‌دلیل سقف ظرفیت روزانه ثبت نشده است.':'');
   }catch{if(v===version&&panel.isConnected)status.textContent='دریافت گزارش تعامل ممکن نشد؛ دوباره تلاش کنید.';}finally{if(v===version)button.disabled=false;}
  }
  period.onchange=load;button.onclick=load;parent.querySelector('#refreshSiteTraffic')?.addEventListener('click',load);load();
 }
})();
