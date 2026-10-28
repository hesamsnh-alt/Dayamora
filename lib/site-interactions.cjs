'use strict';
const crypto=require('node:crypto'),core=require('../public/site-interactions-core.js'),traffic=require('./site-traffic.cjs'),{fail}=require('./validation.cjs');
const PREFIX='interaction-v1:day:',MAX_TERMS=100,MAX_PRODUCTS=500,MAX_SECTIONS=180;
function empty(){return{sections:{},productClicks:{},productViews:{},cartClicks:{},searches:{},omitted:0};}
function validEvent(e){
 if(!e||typeof e!=='object')return null;
 if(e.kind==='section'){const key=core.section(e.key);return key?{kind:e.kind,key}:null;}
 if(['productClick','productView','cartClick'].includes(e.kind)){const id=core.product(e.id);return id?{kind:e.kind,id}:null;}
 if(e.kind==='search'){const term=core.term(e.term);return term?{kind:e.kind,term,zero:e.zero===true}:null;}
 return null;
}
function increment(map,key,max){if(!Object.hasOwn(map,key)&&Object.keys(map).length>=max)return false;map[key]=Math.min(1000000000,(Number(map[key])||0)+1);return true;}
function merge(state,events){
 for(const raw of events){const e=validEvent(raw);if(!e)continue;
  if(e.kind==='search'){
   const key=crypto.createHash('sha256').update(e.term).digest('hex');
   if(!Object.hasOwn(state.searches,key)&&Object.keys(state.searches).length>=MAX_TERMS){state.omitted++;continue;}
   const r=state.searches[key]||{term:e.term,count:0,zero:0};r.count=Math.min(1000000000,r.count+1);if(e.zero)r.zero=Math.min(1000000000,r.zero+1);state.searches[key]=r;
  }else{
   const map=e.kind==='section'?'sections':e.kind==='productClick'?'productClicks':e.kind==='productView'?'productViews':'cartClicks';
   if(!increment(state[map],String(e.key||e.id),e.kind==='section'?MAX_SECTIONS:MAX_PRODUCTS))state.omitted++;
  }
 }
 return state;
}
function readState(value){try{const x=JSON.parse(value);if(!x||typeof x!=='object')return empty();const s=empty();for(const key of Object.keys(s))if(key==='omitted')s[key]=Number(x[key])||0;else if(x[key]&&typeof x[key]==='object'&&!Array.isArray(x[key]))s[key]=x[key];return s;}catch{return empty();}}
async function record(db,events,at){
 const key=PREFIX+traffic.day(at);
 // Row locks are local to this analytics day, never the checkout advisory lock.
 await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING',[key,JSON.stringify(empty())]);
 const row=await db.one('SELECT value FROM shop_settings WHERE key=? FOR UPDATE',[key]);
 const state=merge(readState(row?.value),events);
 await db.run('UPDATE shop_settings SET value=? WHERE key=?',[JSON.stringify(state),key]);
}
function previous(date,n){return new Date(Date.parse(date+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);}
async function report(db,days,at){
 const today=traffic.day(at),from=previous(today,days-1),state=empty();
 const rows=await db.all('SELECT key,value FROM shop_settings WHERE key>=? AND key<=? ORDER BY key',[PREFIX+from,PREFIX+today]);let startedOn=null;
 const sum=(map,key,n)=>{if(Number.isSafeInteger(n)&&n>=0)map[key]=(map[key]||0)+n;};
 for(const row of rows){const date=row.key.slice(PREFIX.length);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<from||date>today)continue;startedOn=startedOn||date;const s=readState(row.value);
  for(const key of ['sections','productClicks','productViews','cartClicks'])for(const [id,n] of Object.entries(s[key])){if(key==='sections'?!core.section(id):!core.product(id))continue;sum(state[key],id,n);}
  for(const [hash,r] of Object.entries(s.searches)){if(!r||!core.term(r.term)||!Number.isSafeInteger(r.count)||r.count<0)continue;const item=state.searches[hash]||{term:core.term(r.term),count:0,zero:0};item.count+=r.count;item.zero+=Number.isSafeInteger(r.zero)&&r.zero>=0?Math.min(r.zero,r.count):0;state.searches[hash]=item;}
  state.omitted+=s.omitted;
 }
 const rank=map=>Object.entries(map).map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)).slice(0,15);
 const products={clicks:rank(state.productClicks),views:rank(state.productViews),cart:rank(state.cartClicks)};
 const ids=[...new Set(Object.values(products).flat().map(r=>Number(r.key)))];
 const names=ids.length?await db.all('SELECT id,name FROM products WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids):[];
 const nameMap=new Map(names.map(p=>[String(p.id),p.name]));
 for(const list of Object.values(products))for(const r of list){r.id=Number(r.key);r.name=nameMap.get(r.key)||'محصول شماره '+r.key;delete r.key;}
 const searches=Object.values(state.searches).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term));
 return{days,from,to:today,asOf:at,timeZone:'Asia/Tehran',startedOn,sections:rank(state.sections),products,searches:searches.slice(0,15),zeroSearches:searches.filter(r=>r.zero).sort((a,b)=>b.zero-a.zero).slice(0,15),
  totals:{clicks:Object.values(state.sections).reduce((a,b)=>a+b,0)+Object.values(state.productClicks).reduce((a,b)=>a+b,0)+Object.values(state.cartClicks).reduce((a,b)=>a+b,0),productViews:Object.values(state.productViews).reduce((a,b)=>a+b,0),searches:searches.reduce((n,r)=>n+r.count,0),zeroSearches:searches.reduce((n,r)=>n+r.zero,0)},omitted:state.omitted};
}
async function route(req,{db,admin,getUser,body,json,at=Date.now()}){
 const u=new URL(req.url),p=u.pathname;
 if(p==='/api/admin/site-interactions'&&req.method==='GET'){
  await admin();const days=Number(u.searchParams.get('days')||7);if(![1,7,30].includes(days))throw fail(400,'بازه گزارش معتبر نیست.');return json(await report(db,days,at));
 }
 if(p!=='/api/site-traffic/events'||req.method!=='POST')return null;
 if(req.headers.get('origin')!==u.origin||req.headers.get('sec-fetch-site')==='cross-site')throw fail(403,'درخواست معتبر نیست.');
 if(Number(req.headers.get('content-length')||0)>8192)throw fail(413,'درخواست بیش از حد مجاز است.');
 const b=await body(req);if(JSON.stringify(b).length>8192||!traffic.publicPath(b.path)||!Array.isArray(b.events)||b.events.length>16)throw fail(400,'رویداد معتبر نیست.');
 if(/bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp|telegram/i.test(req.headers.get('user-agent')||'')||(await getUser())?.role==='admin')return json({ok:true});
 const events=b.events.map(validEvent).filter(Boolean);if(events.length)await record(db,events,at);return json({ok:true});
}
module.exports={PREFIX,validEvent,empty,merge,readState,record,report,route};
