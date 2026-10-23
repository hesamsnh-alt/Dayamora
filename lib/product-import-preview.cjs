'use strict';
// Metadata-only preview; no scraping circumvention, media copying or database writes.
const HOSTS = ['amazon.ae','amazon.com','amazon.co.uk','temu.com','sheglam.com','sephora.ae','sephora.com'];
function safeUrl(value){
  let u; try {u=new URL(value)} catch {throw Error('لینک معتبر نیست.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||!HOSTS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('این فروشگاه فعلاً پشتیبانی نمی‌شود یا لینک معتبر نیست.');
  return u;
}
function decode(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim()}
function meta(html,property){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){let a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1].toLowerCase()]=m[2]??m[3];if((a.property||a.name||'').toLowerCase()===property)return decode(a.content||'')}
  return '';
}
async function preview(link){
 const url=safeUrl(link);const ac=new AbortController(), timer=setTimeout(()=>ac.abort(),7000);
 try {
  const response=await fetch(url,{signal:ac.signal,redirect:'manual',headers:{'Accept':'text/html','User-Agent':'DayamoraProductPreview/1.0'}});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return {url:url.href,available:false,reason:'فروشگاه مبدأ دسترسی خودکار به اطلاعات را نداد. می‌توانید مشخصات را دستی تکمیل کنید.'};
  const length=Number(response.headers.get('content-length')||0);if(length>400000)return {url:url.href,available:false,reason:'حجم صفحه بیشتر از حد پیش‌نمایش است.'};
  const reader=response.body.getReader();let bytes=0,chunks=[];try{while(true){let {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>400000)break;chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const html=new TextDecoder().decode(Buffer.concat(chunks.map(x=>Buffer.from(x))));
  const title=meta(html,'og:title')||decode((html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]||'');
  const description=meta(html,'og:description')||meta(html,'description');
  return {url:url.href,available:Boolean(title),title:title.slice(0,160),description:description.slice(0,2000),reason:title?'':'عنوان محصول در اطلاعات عمومی صفحه پیدا نشد. اطلاعات را دستی تکمیل کنید.'};
 }catch{return {url:url.href,available:false,reason:'دریافت خودکار اطلاعات ممکن نبود. مشخصات را دستی وارد کنید.'}}finally{clearTimeout(timer)}
}
module.exports={preview,safeUrl};
