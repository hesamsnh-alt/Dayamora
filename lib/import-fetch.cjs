'use strict';
const https=require('node:https'),dns=require('node:dns/promises'),net=require('node:net');
function safeUrl(value){let u;try{u=new URL(value)}catch{throw Error('لینک معتبر نیست.')}if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2000||net.isIP(u.hostname)||u.hostname.includes(':')||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost'))throw Error('لینک HTTPS عمومی و بدون پورت وارد کنید.');u.hash='';return u;}
function publicIPv4(ip){if(net.isIP(ip)!==4)return false;const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
async function readPublic(value,{kind='html',limit=3000000,lookup=dns.lookup,request=https.request,timeout=8500}={}){
 const end=Date.now()+timeout;let url=safeUrl(value);const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeout);
 try{for(let redirect=0;redirect<=4;redirect++){
  const addresses=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise((_,reject)=>ac.signal.addEventListener('abort',()=>reject(Error('مهلت دریافت تمام شد.')),{once:true}))]);
  if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('آدرس شبکهٔ خصوصی مجاز نیست.');if(ac.signal.aborted||Date.now()>=end)throw Error('مهلت دریافت تمام شد.');
  const response=await new Promise((resolve,reject)=>{const req=request(url,{signal:ac.signal,agent:false,headers:{Accept:kind==='html'?'text/html,application/xhtml+xml':kind==='video'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp','Accept-Encoding':'identity','User-Agent':'DayamoraProductPreview/2.0'},lookup:(host,opts,cb)=>opts?.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4)},resolve);req.on('error',reject);req.end()});
  if([301,302,303,307,308].includes(response.statusCode)){const next=response.headers.location;response.destroy();if(!next||redirect===4)throw Error('تعداد انتقال لینک بیش از حد مجاز است.');url=safeUrl(new URL(next,url).href);continue;}
  const type=String(response.headers['content-type']||'').split(';')[0].toLowerCase(),encoding=response.headers['content-encoding'];
  if(response.statusCode!==200||(encoding&&encoding!=='identity')||(kind==='html'?!['text/html','application/xhtml+xml'].includes(type):!(kind==='video'?['video/mp4','video/webm']:['image/jpeg','image/png','image/webp']).includes(type))||Number(response.headers['content-length']||0)>limit){response.destroy();throw Error('فروشگاه مبدأ دریافت این محتوا را نپذیرفت یا قالب/حجم آن مجاز نیست.');}
  const chunks=[];let size=0;for await(const chunk of response){size+=chunk.length;if(size>limit){response.destroy();throw Error('حجم فایل بیش از حد مجاز است.');}chunks.push(chunk)}return{url:url.href,type,data:Buffer.concat(chunks)};
 }throw Error('لینک قابل دریافت نیست.');}finally{clearTimeout(timer)}
}
module.exports={safeUrl,publicIPv4,readPublic};
