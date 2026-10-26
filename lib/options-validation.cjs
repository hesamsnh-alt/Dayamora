'use strict';
const bad=message=>{throw Object.assign(new Error(message),{status:400})};
const text=(v,n)=>String(v??'').trim().slice(0,n);
const imageOk=u=>/^\/(assets\/[a-z0-9-]+\.webp|uploads\/[a-f0-9-]+\.(jpg|png|webp))$/.test(u);
function validateOptions(value,variants,cat){
 if(value===undefined)return{colors:[],sizeGuide:{body:[],garment:[],note:''}};
 if(!value||typeof value!=='object'||Array.isArray(value))bad('گزینه‌های محصول معتبر نیست.');
 const source=value.colors??[];if(!Array.isArray(source)||source.length>20)bad('حداکثر ۲۰ رنگ برای محصول وارد کنید.');
 const ids=new Set(),names=new Set();
 const colors=source.map(c=>{
   if(!c||typeof c!=='object'||!c.stock||typeof c.stock!=='object'||Array.isArray(c.stock))bad('رنگ و موجودی هر سایز را وارد کنید.');
   const id=text(c.id,60),name=text(c.name,60),hex=text(c.hex,7),imageUrl=text(c.imageUrl,200);
   if(!/^[a-zA-Z0-9-]{1,60}$/.test(id)||!name||!/^#[a-f0-9]{6}$/i.test(hex)||ids.has(id)||names.has(name))bad('نام رنگ باید یکتا و نمونه‌رنگ معتبر باشد.');
   if(imageUrl&&!imageOk(imageUrl))bad('عکس رنگ معتبر نیست.');ids.add(id);names.add(name);
   if(Object.keys(c.stock).some(v=>!variants.includes(v)))bad('موجودی برای سایز ناشناخته ثبت شده است.');
   const stock=Object.fromEntries(variants.map(v=>{const n=Number(c.stock[v]??0);if(!Number.isSafeInteger(n)||n<0||n>1e6)bad('موجودی رنگ و سایز باید عدد صحیح بین صفر و یک میلیون باشد.');return[v,n]}));
   return{id,name,hex:hex.toLowerCase(),imageUrl,stock};
 });
 const g=value.sizeGuide??{};if(!g||typeof g!=='object'||Array.isArray(g))bad('راهنمای سایز معتبر نیست.');
 const sizeGuide={note:text(g.note,1000),body:[],garment:[]};
 for(const kind of ['body','garment']){
   const rows=g[kind]??[];if(!Array.isArray(rows)||rows.length>30)bad('جدول سایز حداکثر ۳۰ ردیف دارد.');const seen=new Set();
   sizeGuide[kind]=rows.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r))bad('ردیف جدول سایز معتبر نیست.');const size=text(r.size,60);if(!variants.includes(size)||seen.has(size))bad('سایز جدول باید با سایزهای محصول یکسان و یکتا باشد.');seen.add(size);const out={size};for(const field of ['upperBust','bust','waist','hips','height','length','shoulder','sleeve']){const v=text(r[field],30);if(v&&!/^\d{1,3}(?:\.\d)?(?:\s*[-–]\s*\d{1,3}(?:\.\d)?)?$/.test(v))bad('اندازه‌ها را به سانتی‌متر، به شکل ۷۲ یا ۸۲-۸۶ با عدد انگلیسی وارد کنید.');out[field]=v}return out});
 }
 const fit=g.fit??[];if(!Array.isArray(fit)||fit.length>30)bad('حداکثر ۳۰ بازهٔ پیشنهاد سایز مجاز است.');const fitSizes=new Set();
 sizeGuide.fit=fit.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r)||!variants.includes(r.size)||fitSizes.has(r.size))bad('سایز بازه باید معتبر و یکتا باشد.');fitSizes.add(r.size);const keys=['heightMin','heightMax','weightMin','weightMax'];if(keys.every(k=>String(r[k]??'').trim()===''))return{size:r.size,...Object.fromEntries(keys.map(k=>[k,'']))};if(!require('../public/size-fit.js').valid(r))bad('قد و وزن هر سایز را کامل، به ترتیب حداقل و حداکثر وارد کنید.');return{size:r.size,...Object.fromEntries(keys.map(k=>[k,require('../public/size-fit.js').numeric(r[k])]))}});
 if(cat!=='پوشاک'&&sizeGuide.fit.length)bad('پیشنهاد سایز با قد و وزن فقط برای پوشاک است.');
 if(cat!=='پوشاک'&&(sizeGuide.body.length||sizeGuide.garment.length))bad('راهنمای سایز لباس فقط برای دستهٔ پوشاک است.');
 const total=colors.reduce((s,c)=>s+Object.values(c.stock).reduce((a,b)=>a+b,0),0);if(total>1e6)bad('موجودی کل بیش از حد مجاز است.');
 const videoUrl=text(value.videoUrl,1500),videoCaption=text(value.videoCaption,1000);
 if(videoUrl&&!/^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/.test(videoUrl)){
   let u;try{u=new URL(videoUrl)}catch{bad('لینک مستقیم MP4 یا WebM معتبر وارد کنید.');}
   if(u.protocol!=='https:'||u.username||u.password||!(/\.(mp4|webm)$/i.test(u.pathname)))bad('لینک ویدیو باید HTTPS و مستقیم به MP4 یا WebM باشد.');
 }
 const d=value.discovery??{};if(!d||typeof d!=='object'||Array.isArray(d))bad('مشخصات تکمیلی معتبر نیست.');
 const list=(v,allowed)=>{if(v===undefined)return[];if(!Array.isArray(v)||v.length>20)bad('برچسب‌ها معتبر نیستند.');const out=[...new Set(v.map(x=>text(x,60)).filter(Boolean))];if(allowed&&out.some(x=>!allowed.includes(x)))bad('گزینهٔ سبک یا مناسبت معتبر نیست.');return out};
 const discovery={material:text(d.material,500),dimensions:text(d.dimensions,500),care:text(d.care,1000),authenticity:text(d.authenticity,500),shipping:text(d.shipping,1000),returns:text(d.returns,1000),tags:list(d.tags),occasions:list(d.occasions,['روزمره','مهمانی','محل کار','هدیه']),styles:list(d.styles,['مینیمال','کلاسیک','جسور','اسپرت']),tier:['brand','economy'].includes(d.tier)?d.tier:'',routine:['cleanser','moisturizer','sunscreen'].includes(d.routine)?d.routine:''};
 const shippingFee=Number(value.shippingFee??0);if(!Number.isSafeInteger(shippingFee)||shippingFee<0||shippingFee>1e12)bad('هزینه ارسال محصول باید عدد صحیح و غیرمنفی باشد.');
 return{colors,sizeGuide,videoUrl,videoCaption,discovery,shippingFee};
}
function validateBank(b){
 const iban=String(b.iban||'').replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s/g,'').toUpperCase(),holder=text(b.holder,120),bank=text(b.bank,80),instructions=text(b.instructions,1000),enabled=b.enabled===true;
 if(iban){if(!/^IR\d{24}$/.test(iban))bad('شماره شبا باید IR و ۲۴ رقم باشد.');let remainder=0;for(const c of iban.slice(4)+iban.slice(0,4).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55)))remainder=(remainder*10+Number(c))%97;if(remainder!==1)bad('شماره شبا معتبر نیست.');}
 if(enabled&&(!iban||!holder||!bank))bad('برای فعال‌سازی، شماره شبا، نام صاحب حساب و بانک را تکمیل کنید.');
 return{enabled,iban,holder,bank,instructions};
}
module.exports={validateOptions,validateBank};
