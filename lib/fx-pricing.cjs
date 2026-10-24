'use strict';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const CONFIG='fx-settings',PREFIX='fx-product:';
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const integer=(v,min=1,max=1e12)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw fail(400,'مبلغ یا نرخ ارز معتبر نیست.');return n};
function fils(value){const s=String(value??'').trim();if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw fail(400,'قیمت درهم را مثبت و حداکثر با دو رقم اعشار وارد کنید.');const [a,b='']=s.split('.');return integer(Number(a)*100+Number(b.padEnd(2,'0')),1,1e10)}
function ratio(a,b,c){const n=BigInt(a)*BigInt(b),d=BigInt(c);return integer(Number((n+d/2n)/d))}
function price(record,rate){rate=integer(rate,1,1e8);if(record.mode==='aed')return ratio(integer(record.amountFils,1,1e10),rate*115,10000);if(record.mode==='baseline')return ratio(integer(record.basePriceIRT),rate,integer(record.baseRateIRT,1,1e8));throw fail(400,'روش قیمت‌گذاری معتبر نیست.');}
async function put(db,key,value){await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)])}
async function settings(db){const r=await db.one('SELECT value FROM shop_settings WHERE key=?',[CONFIG]);return r?parse(r.value):{enabled:false,rateIRT:null,rateAsOf:null,rateSource:null,updatedAt:null,lastError:null,history:[]}}
function fresh(config,time=Date.now()){const age=time-Date.parse(config.rateAsOf);return Number.isSafeInteger(config.rateIRT)&&config.rateIRT>0&&Number.isFinite(age)&&age>=-300000&&age<=36*3600000}
function normalize(b){if(!b||b.enabled!==true)return{enabled:false};if(b.mode==='aed')return{enabled:true,mode:'aed',amountFils:fils(b.amountAED)};if(b.mode==='baseline')return{enabled:true,mode:'baseline',basePriceIRT:integer(b.basePriceIRT),baseRateIRT:integer(b.baseRateIRT,1,1e8)};throw fail(400,'روش قیمت‌گذاری را انتخاب کنید.');}
async function prepare(db,b){if(b.fxPricing===undefined)return b;const record=normalize(b.fxPricing);if(!record.enabled)return{...b,fxPricing:record};const config=await settings(db);if(!fresh(config))throw fail(409,'ابتدا نرخ معتبر درهم را در تنظیمات قیمت‌گذاری ثبت یا دریافت کنید.');const resolved=price(record,config.rateIRT);if(b.comparePrice&&Number(b.comparePrice)<=resolved)throw fail(400,'قیمت قبل از تخفیف باید بیشتر از قیمت محاسبه‌شده باشد.');return{...b,price:resolved,fxPricing:{...record,compareBaseIRT:b.comparePrice?integer(b.comparePrice):null,compareBaseRateIRT:config.rateIRT,lastRateIRT:config.rateIRT,updatedAt:new Date().toISOString()}};}
async function save(db,id,record){if(record!==undefined)await put(db,PREFIX+integer(id),record)}
async function attach(db,products){const rows=await db.all("SELECT key,value FROM shop_settings WHERE key LIKE 'fx-product:%'");const map=new Map(rows.map(r=>[Number(r.key.slice(PREFIX.length)),parse(r.value)]));return products.map(p=>({...p,fxPricing:map.get(p.id)||{enabled:false}}))}
async function reprice(db,config){
 const rows=await db.all("SELECT p.id,p.price,p.compare_price,s.value FROM products p JOIN shop_settings s ON s.key=('fx-product:' || p.id::text)");let changed=0,managed=0;
 for(const row of rows){const record=parse(row.value);if(!record.enabled)continue;managed++;const next=price(record,config.rateIRT),comparison=record.compareBaseIRT?ratio(record.compareBaseIRT,config.rateIRT,record.compareBaseRateIRT):null;if(comparison!==null&&comparison<=next)throw fail(409,'قیمت قبل از تخفیف یکی از محصولات معتبر نیست؛ محصول را بررسی کنید.');if(next!==Number(row.price)||comparison!==(row.compare_price===null?null:Number(row.compare_price))){await db.run('UPDATE products SET price=?,compare_price=? WHERE id=?',[next,comparison,row.id]);changed++}await save(db,row.id,{...record,lastRateIRT:config.rateIRT,updatedAt:config.updatedAt})}
 return{managed,changed};
}
function providerRate(payload,time=Date.now()){
 const r=payload?.data,m=payload?.meta,unit=r?.quote_currency||m?.quote_currency;
 if(r?.code!=='AED'||r.unit!==1||!['IRT','IRR'].includes(unit)||typeof r.sell!=='number'||!Number.isFinite(r.sell)||r.sell<=0)throw fail(502,'نرخ درهم یا واحد پول در پاسخ سرویس معتبر نیست.');
 const rateIRT=integer(Math.round(r.sell/(unit==='IRR'?10:1)),1,1e8),rateAsOf=m?.as_of;
 if(!fresh({rateIRT,rateAsOf},time))throw fail(502,'نرخ دریافتی قدیمی است یا زمان معتبر ندارد؛ قیمت‌ها تغییر نکردند.');return{rateIRT,rateAsOf,rateSource:'netarz-sell'};
}
async function fetchRate({env=process.env,fetcher=fetch,time=Date.now()}={}){
 const key=env.NETARZ_FX_KEY?.trim();if(!key)throw fail(503,'کلید NETARZ_FX_KEY در تنظیمات Netlify ثبت نشده است.');
 const headers={Authorization:'Bearer '+key,Accept:'application/json'};
 // The provider explicitly supports Origin for serverless hosts with changing IPs.
 const origin=env.DAYAMORA_SITE_URL||env.URL;if(origin){let u;try{u=new URL(origin)}catch{}if(!u||u.protocol!=='https:'||u.username||u.password)throw fail(503,'DAYAMORA_SITE_URL باید آدرس HTTPS همین سایت باشد.');headers.Origin=u.origin}
 let response;try{response=await fetcher('https://netarz.ir/api/fx/v1/rates/AED',{headers,redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw fail(503,'اتصال به سرویس نرخ ارز انجام نشد؛ آخرین قیمت‌ها حفظ شدند.');}
 if(!response.ok)throw fail(503,response.status===403?'سرویس نرخ ارز دسترسی را رد کرد؛ تأیید دامنه و تنظیمات دسترسی نِت‌ارز را بررسی کنید.':response.status===401?'کلید سرویس نرخ ارز پذیرفته نشد.':'سرویس نرخ ارز پاسخ موفق نداد؛ آخرین قیمت‌ها حفظ شدند.');
 if(Number(response.headers.get('content-length')||0)>64000)throw fail(502,'پاسخ سرویس نرخ ارز بیش از حد مجاز است.');let text='';const reader=response.body?.getReader();if(reader){let size=0;const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>64000){await reader.cancel();throw fail(502,'پاسخ سرویس نرخ ارز بیش از حد مجاز است.')}text+=decoder.decode(r.value,{stream:true})}text+=decoder.decode()}let data;try{data=JSON.parse(text)}catch{throw fail(502,'پاسخ سرویس نرخ ارز قابل خواندن نیست.')}return providerRate(data,time);
}
async function applyRate(db,rate,{manual=false,time=Date.now()}={}){
 const old=await settings(db);if(!fresh(rate,time))throw fail(400,'نرخ معتبر و تازه وارد کنید.');
 if(!manual&&old.rateIRT&&Math.abs(rate.rateIRT/old.rateIRT-1)>.25)throw fail(409,'تغییر نرخ بیش از ۲۵٪ است؛ مدیر باید نرخ را بررسی و دستی تأیید کند.');
 const config={...old,...rate,updatedAt:new Date(time).toISOString(),lastError:null},result=await reprice(db,config);config.history=[{...rate,at:config.updatedAt,...result},...(old.history||[])].slice(0,30);await put(db,CONFIG,config);return{...config,...result};
}
async function scheduled({database,env=process.env,fetcher=fetch}={}){
 const {withDatabase}=database||require('./db.cjs'),config=await withDatabase(false,settings);if(!config.enabled)return{skipped:true,reason:'disabled'};
 try{const rate=await fetchRate({env,fetcher});return await withDatabase(true,async db=>{if(!(await settings(db)).enabled)return{skipped:true,reason:'disabled'};return applyRate(db,rate)})}catch(e){await withDatabase(true,async db=>{const current=await settings(db);await put(db,CONFIG,{...current,lastError:{at:new Date().toISOString(),message:e.status?e.message:'به‌روزرسانی انجام نشد؛ آخرین قیمت‌ها حفظ شدند.'}})});return{ok:false,error:'FX_DAILY_FAILED'}}
}
async function quote(db,{env=process.env,fetcher=fetch}={}){
 const current=await settings(db);
 if(current.rateSource==='netarz-sell'&&fresh(current)&&Date.now()-Date.parse(current.rateAsOf)<24*3600000)return current;
 const rate=await fetchRate({env,fetcher});
 if(current.rateSource==='netarz-sell'&&current.rateIRT&&Math.abs(rate.rateIRT/current.rateIRT-1)>.25)throw fail(409,'تغییر نرخ بیش از ۲۵٪ است؛ ابتدا نرخ API را در تنظیمات بررسی و تأیید کنید.');
 const next={...current,...rate,lastError:null};await put(db,CONFIG,next);return next;
}
async function activate(db,{includeExisting,confirm},{env=process.env,fetcher=fetch}={}){
 if(confirm!==true||typeof includeExisting!=='boolean')throw fail(400,'تأیید فعال‌سازی و وضعیت محصولات قبلی لازم است.');
 // Fetch before any write: an invalid key/domain must never seed a fake baseline.
 const rate=await fetchRate({env,fetcher});let adopted=0;
 if(includeExisting){const rows=await db.all('SELECT id,price,compare_price FROM products WHERE is_sample=0');
  for(const p of rows){const old=await db.one('SELECT value FROM shop_settings WHERE key=?',[PREFIX+p.id]);if(old&&parse(old.value)?.enabled)continue;
   await save(db,p.id,{enabled:true,mode:'baseline',basePriceIRT:integer(p.price),baseRateIRT:rate.rateIRT,compareBaseIRT:p.compare_price?integer(p.compare_price):null,compareBaseRateIRT:rate.rateIRT});adopted++}
 }
 const result=await applyRate(db,rate,{manual:true});await put(db,CONFIG,{...result,enabled:true});return{...result,enabled:true,adopted};
}
async function route(req,{db,admin,body,json,env=process.env,fetcher=fetch}){
 const path=new URL(req.url).pathname;if(!path.startsWith('/api/admin/fx'))return null;await admin();const config=await settings(db);
 if(req.method==='GET'&&path==='/api/admin/fx')return json({...config,keyConfigured:!!process.env.NETARZ_FX_KEY,schedule:'روزانه ساعت ۱۶ امارات',fresh:fresh(config)});
 if(req.method==='POST'&&path==='/api/admin/fx/quote'){const rate=await quote(db,{env,fetcher});return json({...rate,fresh:fresh(rate)})}
 if(req.method==='POST'&&path==='/api/admin/fx/activate')return json(await activate(db,await body(req),{env,fetcher}));
 if(req.method==='PUT'&&path==='/api/admin/fx'){const b=await body(req);if(typeof b.enabled!=='boolean')throw fail(400,'وضعیت به‌روزرسانی معتبر نیست.');await put(db,CONFIG,{...config,enabled:b.enabled});return json({ok:true})}
 if(req.method==='POST'&&path==='/api/admin/fx/manual'){const b=await body(req),rateIRT=integer(b.rate,1,1e9)/(b.unit==='IRR'?10:1);if(!['IRR','IRT'].includes(b.unit)||!Number.isSafeInteger(rateIRT))throw fail(400,'واحد نرخ را درست انتخاب کنید؛ نرخ باید معادل تومان صحیح باشد.');return json(await applyRate(db,{rateIRT:integer(rateIRT,1,1e8),rateAsOf:new Date().toISOString(),rateSource:'admin'},{manual:true}))}
 if(req.method==='POST'&&path==='/api/admin/fx/refresh')return json(await applyRate(db,await fetchRate()));
 if(req.method==='POST'&&path==='/api/admin/fx/adopt'){
  const b=await body(req);if(b.confirm!==true||!fresh(config))throw fail(400,'نرخ معتبر و تأیید مبنای محصولات قبلی لازم است.');const baseRate=integer(b.baseRateIRT,1,1e8),rows=await db.all('SELECT id,price,compare_price FROM products WHERE is_sample=0');let adopted=0;
  for(const p of rows){const old=await db.one('SELECT value FROM shop_settings WHERE key=?',[PREFIX+p.id]);if(old&&parse(old.value)?.enabled)continue;await save(db,p.id,{enabled:true,mode:'baseline',basePriceIRT:integer(p.price),baseRateIRT:baseRate,compareBaseIRT:p.compare_price?integer(p.compare_price):null,compareBaseRateIRT:baseRate});adopted++}const result=await reprice(db,{...config,updatedAt:new Date().toISOString()});return json({adopted,...result});
 }
 throw fail(405,'عملیات قیمت‌گذاری پشتیبانی نمی‌شود.');
}
module.exports={fils,price,normalize,settings,fresh,prepare,save,attach,reprice,providerRate,fetchRate,applyRate,scheduled,quote,activate,route};
