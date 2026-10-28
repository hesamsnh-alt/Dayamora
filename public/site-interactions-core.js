'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayaInteractions=api;})(typeof window==='object'?window:globalThis,function(){
 const sections={home:'خانه',shop:'فروشگاه',budget:'خرید با بودجه',value:'خوش‌قیمت‌ها',clothes:'پوشاک',beauty:'زیبایی',skin:'مراقبت پوست',hair:'مراقبت مو',shoes:'کفش',bags:'کیف',accessories:'اکسسوری',perfume:'عطر',gift:'هدیه',gadgets:'گجت‌ها',journal:'مجله',stylist:'استایل‌ساز',boutique:'بوتیک مجازی',club:'باشگاه مشتریان',cart:'سبد خرید',favorites:'علاقه‌مندی‌ها',brands:'برندها',search_photo:'جست‌وجوی تصویری',filter_color:'فیلتر رنگ',filter_size:'فیلتر سایز',sort:'مرتب‌سازی',search:'جست‌وجو',contact:'تماس با ما',about:'درباره ما',faq:'پرسش‌های متداول',shipping:'راهنمای ارسال',returns:'مرجوعی',privacy:'حریم خصوصی',today:'انتخاب امروز',compare:'مقایسه محصولات',collections:'کالکشن‌ها',community:'استایل کاربران',new:'تازه‌رسیده‌ها',trending:'محصولات محبوب',colors:'استودیوی رنگ'};
 const slots={header:'منوی بالا',banner:'اسلایدر',categories:'دسته‌بندی‌ها',promo:'کارت پیشنهاد',footer:'پایین صفحه',content:'محتوای صفحه'};
 const categories={'پوشاک':'clothes','زیبایی':'beauty','مراقبت پوست':'skin','مراقبت مو':'hair','کفش':'shoes','کیف':'bags','کیف و کفش':'shoes','اکسسوری':'accessories','عطر':'perfume','هدیه':'gift','گجت‌ها':'gadgets'};
 function term(v){
  if(typeof v!=='string')return '';
  const s=v.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d]/g,' ').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\s+/g,' ').trim().toLowerCase();
  // Do not send likely contact details, links, email addresses or arbitrary HTML.
  if(s.length<2||s.length>70||!/[a-z\u0600-\u06ff]/i.test(s)||/[@<>:/\\=]|www\.|https?/i.test(s)||/\d{7,}/.test(s.replace(/[\s()+.\-]/g,'')))return '';
  return s;
 }
 function section(v){if(typeof v!=='string')return '';const [slot,id,...extra]=v.split(':');return !extra.length&&Object.hasOwn(slots,slot)&&Object.hasOwn(sections,id)?v:'';}
 function product(v){const n=Number(v);return Number.isSafeInteger(n)&&n>0&&n<=1000000000?n:null;}
 function destination(u){
  const cat=categories[u.searchParams.get('cat')];if(cat)return cat;
  if(u.hash==='#brands')return 'brands';if(u.hash==='#shop')return 'shop';
  const p=u.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
  if(p==='/club')return /favorites/.test(u.hash)?'favorites':/styles/.test(u.hash)?'stylist':'club';
  if(p==='/discover'){const key=u.hash.slice(1).split('?')[0];return ({wizard:'stylist',photo:'search_photo',ask:'search',gift:'gift',beauty:'beauty',member:'club',support:'contact'})[key]||(Object.hasOwn(sections,key)?key:'shop');}
  return({'/':'home','/index':'home','/shop':'shop','/budget':'budget','/value':'value','/journal':'journal','/discover/journal':'journal','/stylist':'stylist','/boutique':'boutique'})[p]||'';
 }
 return{sections,slots,categories,term,section,product,destination};
});
