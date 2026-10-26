'use strict';
const {fail}=require('./validation.cjs');
const PREFIX='traffic-v1:day:';
const PUBLIC_PATHS=new Set(['/','/index.html','/shop','/value','/budget','/budget.html','/product','/product.html','/discover.html','/stylist.html','/boutique.html','/journal.html']);
function publicPath(path){return typeof path==='string'&&(PUBLIC_PATHS.has(path)||/^\/discover\/[a-z]+$/.test(path));}
// Server-owned calendar dates: the shop sells to Iran, so daily reports use Tehran.
function day(at=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);}
function before(date,days){return new Date(Date.parse(date+'T12:00:00Z')-days*86400000).toISOString().slice(0,10);}
async function record(db,at=Date.now()){
  // One atomic increment, including concurrent requests. One small row per day;
  // no identifiers, IPs, URLs, query strings, cookies or customer data are stored.
  await db.run(`INSERT INTO shop_settings(key,value) VALUES(?, '1')
    ON CONFLICT(key) DO UPDATE SET value=((shop_settings.value::bigint)+1)::text`,[PREFIX+day(at)]);
}
async function report(db,at=Date.now()){
  const today=day(at),week=before(today,6),month=before(today,29);
  const rows=await db.all('SELECT key,value FROM shop_settings WHERE key LIKE ? ORDER BY key',[PREFIX+'%']);
  let todayViews=0,weekViews=0,monthViews=0,totalViews=0,startedOn=null;
  for(const r of rows){const date=r.key.slice(PREFIX.length),n=Number(r.value);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today||!Number.isSafeInteger(n)||n<0)continue;
    totalViews+=n;if(!startedOn)startedOn=date;if(date===today)todayViews+=n;if(date>=week)weekViews+=n;if(date>=month)monthViews+=n;
  }
  return{today:todayViews,last7Days:weekViews,last30Days:monthViews,total:totalViews,startedOn,asOf:at,timeZone:'Asia/Tehran',metric:'pageviews'};
}
async function route(req,{db,admin,getUser,body,json,at=Date.now()}){
  const p=new URL(req.url).pathname;
  if(p==='/api/admin/site-traffic'&&req.method==='GET'){await admin();return json(await report(db,at));}
  if(p!=='/api/site-traffic/view'||req.method!=='POST')return null;
  const url=new URL(req.url);
  if(req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site')throw fail(403,'درخواست معتبر نیست.');
  if(Number(req.headers.get('content-length')||0)>1024)throw fail(413,'درخواست بیش از حد مجاز است.');
  const b=await body(req);if(!publicPath(b.path))throw fail(400,'صفحه معتبر نیست.');
  if(/bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp|telegram/i.test(req.headers.get('user-agent')||''))return json({ok:true});
  if((await getUser())?.role==='admin')return json({ok:true});
  await record(db,at);return json({ok:true});
}
module.exports={publicPath,day,record,report,route};
