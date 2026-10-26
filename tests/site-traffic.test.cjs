'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const traffic=require('../lib/site-traffic.cjs');
const at=Date.parse('2026-10-26T12:00:00Z'),prefix='traffic-v1:day:';
function fixture(role=null){
  const rows=new Map();let authCalls=0;
  const ctx={at,db:{async all(){return [...rows].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,value}));},async run(sql,args){A.match(sql,/ON CONFLICT\(key\) DO UPDATE SET value=\(\(shop_settings.value::bigint\)\+1\)::text/);rows.set(args[0],String(Number(rows.get(args[0])||0)+1));}},async getUser(){return role?{role}:null;},async admin(){authCalls++;if(role!=='admin')throw Object.assign(Error('denied'),{status:role?403:401});},body:req=>req.json(),json:d=>Response.json(d)};
  async function call(path='/api/site-traffic/view',data={path:'/'},headers={}){return traffic.route(new Request('https://dayamora.com'+path,{method:data===null?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://dayamora.com','User-Agent':'Mozilla/5.0',...headers},...(data===null?{}:{body:JSON.stringify(data)})}),ctx);}
  return{ctx,rows,call,authCalls:()=>authCalls};
}
test('Daily boundaries follow Tehran midnight rather than UTC or client dates',()=>{
  A.equal(traffic.day(Date.parse('2026-10-25T20:29:59Z')),'2026-10-25');
  A.equal(traffic.day(Date.parse('2026-10-25T20:30:00Z')),'2026-10-26');
});
test('Only storefront paths count; no admin, private pages, URLs or queries accepted',async()=>{
  const f=fixture();for(const path of ['/admin','/admin.html','/club','/journal-admin.html','/setup','/private-uploads/x','https://evil.invalid/','/product?id=9','/?email=secret'])await A.rejects(f.call(undefined,{path}),{status:400});
  for(const path of ['/','/product','/boutique.html','/discover/journal','/shop'])A.equal((await f.call(undefined,{path})).status,200);
  A.equal(f.rows.get(prefix+'2026-10-26'),'5');A.equal(f.rows.size,1);
});
test('Guest and customer views increment, signed-in admins and known bots do not',async()=>{
  for(const role of [null,'customer']){const f=fixture(role);await f.call();await f.call();A.equal(f.rows.get(prefix+'2026-10-26'),'2');}
  const admin=fixture('admin');await admin.call();A.equal(admin.rows.size,0);
  const bot=fixture();await bot.call(undefined,undefined,{'User-Agent':'Googlebot'});A.equal(bot.rows.size,0);
});
test('Cross-origin, missing-origin, cross-site and oversized requests cannot count',async()=>{
  const f=fixture();for(const headers of [{Origin:'https://evil.invalid'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])await A.rejects(f.call(undefined,undefined,headers),{status:403});
  await A.rejects(f.call(undefined,undefined,{'Content-Length':'2048'}),{status:413});A.equal(f.rows.size,0);
});
test('Reports require administrator auth and public count responses expose no totals',async()=>{
  for(const role of [null,'customer']){const f=fixture(role);await A.rejects(f.call('/api/admin/site-traffic',null),{status:role?403:401});A.equal(f.authCalls(),1);}
  const guest=fixture();A.deepEqual(await (await guest.call()).json(),{ok:true});
  const admin=fixture('admin');A.equal((await admin.call('/api/admin/site-traffic',null)).status,200);
});
test('Today / rolling 7 and 30 calendar days / lifetime totals have inclusive correct boundaries',async()=>{
  const f=fixture('admin');for(const [date,n] of [['2026-09-01',10],['2026-09-26',20],['2026-09-27',30],['2026-10-19',40],['2026-10-20',50],['2026-10-25',60],['2026-10-26',70],['2026-10-27',999]])f.rows.set(prefix+date,String(n));
  const r=await(await f.call('/api/admin/site-traffic',null)).json();A.equal(r.today,70);A.equal(r.last7Days,180);A.equal(r.last30Days,250);A.equal(r.total,280);A.equal(r.startedOn,'2026-09-01');A.equal(r.timeZone,'Asia/Tehran');
});
test('Empty stats mean zero since installation, not an invented historical visitor total',async()=>{
  const f=fixture('admin'),r=await(await f.call('/api/admin/site-traffic',null)).json();A.equal(r.total,0);A.equal(r.startedOn,null);A.equal(r.metric,'pageviews');
});
function browser(path='/',visibility='visible'){
  const events={},calls=[];const document={visibilityState:visibility,addEventListener(n,fn){events[n]=fn;},removeEventListener(n){delete events[n];},querySelector(){return null;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/site-traffic.js'),'utf8'),{document,location:{pathname:path},fetch:(url,opts)=>{calls.push({url,opts});return Promise.reject(Error('offline'));},console,Set});
  return{events,calls,document};
}
test('Tracker sends once per visible document and sends only the path, never query/email/id',async()=>{
  const b=browser('/product');A.equal(b.calls.length,1);A.deepEqual(JSON.parse(b.calls[0].opts.body),{path:'/product'});A.equal(b.calls[0].opts.keepalive,true);
  b.events.prerenderingchange();A.equal(b.calls.length,1);await new Promise(r=>setImmediate(r));
});
test('Hidden/prerendered documents wait for visibility; admin and reset pages never count',()=>{
  const b=browser('/','hidden');A.equal(b.calls.length,0);b.document.prerendering=true;b.document.visibilityState='visible';b.events.visibilitychange();A.equal(b.calls.length,0);b.document.prerendering=false;b.events.prerenderingchange();A.equal(b.calls.length,1);
  for(const path of ['/admin','/admin.html','/reset-password.html','/journal-admin.html','/club'])A.equal(browser(path).calls.length,0);
});
