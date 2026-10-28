'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../public/site-interactions-core.js'),I=require('../lib/site-interactions.cjs');
const at=Date.parse('2026-10-28T12:00:00Z');
function fixture(role=null){
 const data=new Map(),calls=[],locks=new Map(),tx=new (require('node:async_hooks').AsyncLocalStorage)();let releaseFallback;
 const db={async run(sql,args){calls.push({sql,args});if(sql.startsWith('INSERT')){if(!data.has(args[0]))data.set(args[0],args[1]);}else if(sql.startsWith('UPDATE')){data.set(args[1],args[0]);(tx.getStore()?.release||releaseFallback)?.();}},async one(sql,args){calls.push({sql,args});A.match(sql,/FOR UPDATE$/);const last=locks.get(args[0])?.promise||Promise.resolve();let release;const promise=new Promise(r=>{release=r});locks.set(args[0],{promise,release});if(tx.getStore())tx.getStore().release=release;else releaseFallback=release;await last;return{value:data.get(args[0])};},async all(sql,args){calls.push({sql,args});if(sql.startsWith('SELECT id,name'))return args.filter(x=>x===9).map(id=>({id,name:'کیف نمونه'}));return [...data].filter(([k])=>k>=args[0]&&k<=args[1]).sort().map(([key,value])=>({key,value}));}};
 const ctx={db,at,admin:async()=>{if(role!=='admin')throw Object.assign(Error('denied'),{status:role?403:401});},getUser:async()=>role?{role}:null,body:req=>req.json(),json:d=>Response.json(d)};
 async function call(events=[{kind:'section',key:'header:shop'}],options={}){const req=new Request('https://dayamora.com'+(options.path||'/api/site-traffic/events'),{method:options.get?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://dayamora.com','User-Agent':'Mozilla/5.0',...options.headers},...(!options.get?{body:JSON.stringify({path:options.page||'/',events,...options.extra})}:{})});return I.route(req,ctx);}
 return{db,data,calls,ctx,call,transaction:fn=>tx.run({},fn)};
}
test('Search labels normalize Persian spelling/digits and reject likely contact details or HTML',()=>{
 A.equal(C.term('  كيف  مشكي ۳۸ '),'کیف مشکی 38');A.equal(C.term('كفش'),'کفش');
 for(const v of ['a','x'.repeat(71),'hesamsnh@gmail.com','https://example.com','+971 50 950 8266','۰۹۱۲۱۲۳۴۵۶۷','<img src=x>','۱۲۳'])A.equal(C.term(v),'');
 A.equal(C.term('لباس سایز 38'),'لباس سایز 38');
});
test('Only fixed section labels, positive product ids and normalized searches can be stored',()=>{
 A.equal(I.validEvent({kind:'section',key:'header:__proto__'}),null);A.equal(I.validEvent({kind:'section',key:'header:shop:email'}),null);
 for(const id of [-1,0,1.5,'bad',1000000001])A.equal(I.validEvent({kind:'productClick',id}),null);
 A.deepEqual(I.validEvent({kind:'search',term:'کیف',email:'private',userId:5,zero:true}),{kind:'search',term:'کیف',zero:true});
});
test('Guest and customer interactions count; admin and known bots do not',async()=>{
 for(const role of [null,'customer']){const f=fixture(role);await f.call([{kind:'productClick',id:9},{kind:'search',term:'کیف',zero:true}]);const r=await I.report(f.db,7,at);A.equal(r.totals.clicks,1);A.equal(r.totals.searches,1);A.equal(r.totals.zeroSearches,1);A.equal(r.products.clicks[0].name,'کیف نمونه');}
 const admin=fixture('admin');await admin.call();A.equal(admin.data.size,0);
 const bot=fixture();await bot.call(undefined,{headers:{'User-Agent':'Googlebot'}});A.equal(bot.data.size,0);
});
test('Origin, public path, body size and event count checks reject invalid telemetry',async()=>{
 const f=fixture();for(const headers of [{Origin:''},{Origin:'https://evil.invalid'},{'Sec-Fetch-Site':'cross-site'}])await A.rejects(f.call(undefined,{headers}),{status:403});
 await A.rejects(f.call(undefined,{headers:{'Content-Length':'9000'}}),{status:413});
 await A.rejects(f.call(Array(17).fill({kind:'productView',id:9})),{status:400});
 for(const page of ['/admin','/club','/?email=x','https://other.example'])await A.rejects(f.call(undefined,{page}),{status:400});A.equal(f.data.size,0);
});
test('Reports are administrator-only and supported windows are explicit',async()=>{
 for(const role of [null,'customer'])await A.rejects(fixture(role).call(null,{get:true,path:'/api/admin/site-interactions'}),{status:role?403:401});
 const f=fixture('admin');await A.rejects(f.call(null,{get:true,path:'/api/admin/site-interactions?days=365'}),{status:400});A.equal((await f.call(null,{get:true,path:'/api/admin/site-interactions?days=30'})).status,200);
});
test('Daily bounded aggregates preserve existing settings and never contain per-visitor identifiers',async()=>{
 const f=fixture();f.data.set('bank_details','DO NOT CHANGE');await f.call([{kind:'search',term:'لباس',userId:8,email:'secret@invalid',ip:'1.2.3.4'},{kind:'productView',id:9,path:'secret'}]);A.equal(f.data.get('bank_details'),'DO NOT CHANGE');const saved=f.data.get(I.PREFIX+'2026-10-28');for(const v of ['userId','email','secret@invalid','1.2.3.4','cookie'])A(!saved.includes(v));A.equal(f.data.size,2);A(!f.calls.some(c=>/CREATE|ALTER|DROP|DELETE|advisory/i.test(c.sql)));
 const s=I.empty();I.merge(s,Array.from({length:120},(_,i)=>({kind:'search',term:'جستجو '+i})));A.equal(Object.keys(s.searches).length,100);A.equal(s.omitted,20);
});
test('Concurrent batches lock the analytics row and do not lose increments',async()=>{
 const f=fixture();await Promise.all(Array.from({length:25},()=>f.transaction(()=>I.record(f.db,[{kind:'productClick',id:9}],at))));const r=await I.report(f.db,1,at);A.equal(r.products.clicks[0].count,25);A.equal(f.data.size,1);A(f.calls.some(c=>/FOR UPDATE$/.test(c.sql)));
});
test('Rolling report windows merge days, rank results and exclude out-of-window rows',async()=>{
 const f=fixture('admin');for(const [date,n] of [['2026-10-01',8],['2026-10-21',50],['2026-10-22',2],['2026-10-28',3],['2026-10-29',99]]){const s=I.empty();s.sections['header:shop']=n;s.searches.a={term:'کیف',count:n,zero:1};f.data.set(I.PREFIX+date,JSON.stringify(s));}
 const r=await I.report(f.db,7,at);A.equal(r.from,'2026-10-22');A.equal(r.totals.clicks,5);A.equal(r.searches[0].count,5);A.equal(r.zeroSearches[0].zero,2);A.equal(r.timeZone,'Asia/Tehran');
});
function browser(path='/',search=''){
 const events={},windowEvents={},calls=[],timers=new Map();let serial=0;
 const document={visibilityState:'visible',prerendering:false,addEventListener:(n,fn)=>{events[n]=fn;},querySelector:s=>s==='#products'?{querySelectorAll:()=>[]}:s==='#results'?{textContent:'۰ محصول'}:null};
 const window={DayaInteractions:C,addEventListener:(n,fn)=>{windowEvents[n]=fn;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/site-interactions.js'),'utf8'),{window,document,location:{pathname:path,search,href:'https://dayamora.com'+path+search,origin:'https://dayamora.com'},URL,URLSearchParams,Date,Set,Promise,JSON,Object,Number,setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),fetch:(url,opts)=>{calls.push({url,opts});return Promise.resolve({ok:true});}});
 async function run(ms){for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}await Promise.resolve();await Promise.resolve();await Promise.resolve();}
 function button(id,attrs={}){const b={id,dataset:{},disabled:false,classList:{contains:()=>false},hasAttribute:k=>Object.hasOwn(attrs,k),matches:()=>false,closest:()=>null};b.closest=s=>s==='a,button'?b:null;return b;}
 return{events,windowEvents,calls,timers,run,button,document,window};
}
test('Client debounces typing, deduplicates Enter and sends aggregate events without URL history',async()=>{
 const b=browser();const target={matches:()=>true,value:'کیف'};b.events.input({target});await b.run(1800);b.events.keydown({key:'Enter',target});await b.run(1500);A.equal(b.calls.length,1);A.deepEqual(JSON.parse(b.calls[0].opts.body),{path:'/',events:[{kind:'search',term:'کیف',zero:true}]});A.equal(b.calls[0].opts.keepalive,true);
 target.value='secret@example.com';b.events.input({target});await b.run(1800);await b.run(1500);A.equal(b.calls.length,1);
});
test('Client preserves store click behavior and tracks current cart, category and product buttons',async()=>{
 const b=browser();let prevented=false;for(const id of ['cartOpen','budgetGo','account'])b.events.click({button:0,target:b.button(id),preventDefault:()=>{prevented=true}});
 const product=b.button('');product.dataset.detail='9';b.events.click({button:0,target:product});await b.run(1500);const e=JSON.parse(b.calls[0].opts.body).events;A(e.some(x=>x.key==='content:cart'));A(e.some(x=>x.key==='content:budget'));A(e.some(x=>x.kind==='productClick'&&x.id===9));A.equal(prevented,false);
});
test('Client waits for visibility, ignores private pages and flushes pending clicks on hide',async()=>{
 const privatePage=browser('/club');A.equal(Object.keys(privatePage.events).length,0);
 const b=browser('/product','?id=9&email=private');await b.run(1500);A.equal(JSON.parse(b.calls[0].opts.body).events[0].id,9);A(!b.calls[0].opts.body.includes('email'));
 b.events.click({button:0,target:b.button('cartOpen')});b.document.visibilityState='hidden';b.events.visibilitychange();A.equal(b.calls.length,2);
});
test('Only analytics writes bypass the store write lock, without changing other API routes',()=>{
 const api=fs.readFileSync(require.resolve('../lib/api.cjs'),'utf8');A.match(api,/write&&!\['\/api\/site-traffic\/view','\/api\/site-traffic\/events'\]\.includes\(url.pathname\)/);A.match(api,/require\('\.\/site-interactions.cjs'\)\.route/);
 for(const file of ['../public/site-interactions.js','../lib/site-interactions.cjs']){const s=fs.readFileSync(require.resolve(file),'utf8');A(!s.includes('localStorage'));A(!s.includes('sessionStorage'));}
});
