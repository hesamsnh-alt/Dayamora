const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),R=require('../lib/cutout-registry.cjs'),rows=require('../lib/prepared-cutouts.json');
test('bundled cutouts are validated transparent PNGs and bind to exact product/colour/photo',async()=>{for(const r of rows.filter(x=>x.wearable!==false)){const bytes=fs.readFileSync(path.join(__dirname,'../public',r.imageUrl));require('../lib/cutout-png.cjs').validatePng('data:image/png;base64,'+bytes.toString('base64'));const p={id:r.productId,image_url:r.sourceImage,options:JSON.stringify({colors:r.colorId?[{id:r.colorId,imageUrl:r.sourceImage}]:[]})};A.ok(R.matching(p,r.colorId,r.imageUrl));A.equal(R.matching({...p,image_url:'/uploads/new.jpg',options:JSON.stringify({colors:r.colorId?[{id:r.colorId,imageUrl:'/uploads/new.jpg'}]:[]})},r.colorId,r.imageUrl),undefined)}});
test('customer page cannot invoke model downloads or manual cutout steps',()=>{const html=fs.readFileSync(path.join(__dirname,'../public/stylist.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../public/outfit.js'),'utf8');A.ok(js.includes("if(user?.role==='admin'&&window.GarmentAuto)"));A.ok(!/GarmentSegment|extractProduct|personalCutout|whiteCut/.test(js));A.ok(!html.includes('برش / پاک'))});
test('Batch queue uses current real products and exact colour-source bindings; replaced photos are prepared again',()=>{
 const B=require('../public/garment-batch.js'),ps=[{id:101,name:'پیراهن',cat:'پوشاک',active:true,imageUrl:'/uploads/a.png',options:{colors:[{id:'red',name:'قرمز',imageUrl:'/uploads/red.png'},{id:'blue',name:'آبی',imageUrl:'/uploads/blue.png'}]}},{id:102,cat:'کفش',active:true,imageUrl:'/uploads/shoe.png'},{id:103,cat:'زیبایی',active:true,imageUrl:'/uploads/lip.png'},{id:104,cat:'کیف',active:false,imageUrl:'/uploads/bag.png'}];
 let jobs=B.jobs(ps,[{productId:101,colorId:'red',sourceImage:'/uploads/red.png',imageUrl:'/uploads/ready.png'}]);A.equal(jobs.length,3);A.equal(jobs[0].colorId,'blue');A.equal(jobs[1].productId,102);
 jobs=B.jobs(ps,[{productId:101,colorId:'red',sourceImage:'/uploads/old-red.png'}]);A.equal(jobs.length,4);A.equal(new Set(jobs.map(B.key)).size,4);
});
test('Batch processing is sequential, retains every colour, reports failures and stops without accepting an incomplete result',async()=>{
 const B=require('../public/garment-batch.js'),jobs=[1,2,3].map(productId=>({productId,colorId:'',sourceImage:'/uploads/'+productId+'.png'}));let active=0,max=0,seen=[],stop=false;
 const result=await B.prepare(jobs,{extract:async j=>{active++;max=Math.max(max,active);await Promise.resolve();active--;if(j.productId===2)throw Error('bad edge');return{data:'data:image/png;base64,test'}},onResult:r=>seen.push(r.status)});
 A.equal(max,1);A.equal(result.length,3);A.deepEqual(seen,['review','failed','review']);
 const cancelled=await B.prepare(jobs,{extract:async()=>{stop=true;return{data:'data:image/png;base64,test'}},cancelled:()=>stop});A.equal(cancelled.length,0);
});
test('Private cutout and snapshot uploads no longer reference undefined product variables, remain authenticated and validate cutout PNGs',async()=>{
 const {createHandler}=require('../lib/outfits.cjs');let uploads=0;const png='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../public/assets/garment-cutouts/1-e0305ece71364483.png')).toString('base64');
 const h=createHandler({withDatabase:async(write,fn)=>fn({one:async q=>q.includes('JOIN sessions')?{id:'buyer',role:'customer'}:null,run:async()=>{}}),rateLimit:async()=>{},upload:async(base64,privateImage)=>{A.equal(privateImage,true);uploads++;return'/private-uploads/test.png'}});
 const request=(body,auth=true,p='assets')=>h(new Request('https://dayamora.com/outfit-api/'+p,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{cookie:'dayamora_session='+'a'.repeat(64)}:{})},body:JSON.stringify(body)}));
 A.equal((await request({base64:png,kind:'cutout'})).status,201);A.equal(uploads,1);
 A.equal((await request({base64:'data:image/webp;base64,'+fs.readFileSync(path.join(__dirname,'../public/assets/bag.webp')).toString('base64')})).status,201);A.equal(uploads,2);
 A.equal((await request({base64:'data:image/png;base64,AAAA',kind:'cutout'})).status,400);A.equal(uploads,2);
 A.equal((await request({base64:png},false)).status,401);A.equal((await request({base64:png,kind:'bad'})).status,400);
 A.equal((await request({productId:1,colorId:'',base64:png,garmentOnly:true},true,'cutouts')).status,403);
});
test('Automatic preparation persists all categories, colours and unpublished products without a manual review callback',async()=>{
 const G=require('../public/garment-auto.js'),products=[{id:201,name:'پوشاک جدید',cat:'پوشاک',active:false,imageUrl:'/uploads/new.png'},{id:202,name:'کیف',cat:'کیف',imageUrl:'/uploads/bag.png',options:{colors:[{id:'a',name:'مشکی',imageUrl:'/uploads/black.png'},{id:'b',name:'سفید',imageUrl:'/uploads/white.png'}]}},{id:203,name:'هدفون',cat:'گجت‌ها',imageUrl:'/uploads/earbuds.png'}],rows=[],saved=[];
 let active=0,max=0;const deps={extract:async job=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return{data:'data:image/png;base64,prepared'}},save:async job=>{saved.push(job);return{imageUrl:'/uploads/prepared-'+job.productId+'-'+job.colorId+'.png'}}};
 const result=await G.run(products,rows,deps);A.equal(max,1);A.equal(result.saved,4);A.equal(result.remaining,0);A.equal(saved.length,4);A.equal(saved[0].productId,201);A.deepEqual(saved.filter(x=>x.productId===202).map(x=>x.colorId),['a','b']);A.equal((await G.run(products,rows,deps)).total,0);
});
test('Automatic pipeline does not fake preparation when colour photos or model weights are unavailable',async()=>{
 const G=require('../public/garment-auto.js'),ps=[{id:1,name:'لباس',cat:'پوشاک',imageUrl:'/uploads/main.png',options:{colors:[{id:'a'},{id:'b'}]}},{id:2,name:'گجت',cat:'گجت‌ها',imageUrl:'/uploads/2.png'},{id:3,name:'کیف',cat:'کیف',imageUrl:'/uploads/3.png'}];let calls=0,saves=0;const cache=new Map();
 const r=await G.run(ps,[],{failures:cache,extract:async()=>{calls++;throw Object.assign(Error('مدل در دسترس نیست'),{code:'MODEL_UNAVAILABLE'})},save:async()=>saves++});
 A.equal(calls,1);A.equal(saves,0);A.equal(r.failed,3);A.equal(r.remaining,1);A.equal(r.saved,0);
 const retry=await G.run(ps.slice(0,1),[],{failures:cache,extract:async()=>calls++,save:async()=>saves++});A.equal(retry.skipped,2);A.equal(calls,1);
});
test('Full cutout inventory remains admin-only while the public list stays limited to active products',async()=>{
 const {createHandler}=require('../lib/outfits.cjs');let allInventory=false;
 const db={one:async()=>({id:'buyer',role:'customer'}),all:async sql=>{if(sql.startsWith('SELECT id,image_url'))allInventory=!sql.includes('active=1');return[]}};
 const h=createHandler({withDatabase:async(w,fn)=>fn(db),rateLimit:async()=>{},upload:async()=>{throw Error('no uploads')}});
 A.equal((await h(new Request('https://dayamora.com/outfit-api/cutouts'))).status,200);A.equal(allInventory,false);
 A.equal((await h(new Request('https://dayamora.com/outfit-api/cutouts?all=1'))).status,401);
 A.equal((await h(new Request('https://dayamora.com/outfit-api/cutouts?all=1',{headers:{cookie:'dayamora_session='+'a'.repeat(64)}}))).status,403);
});
test('Gadgets can be saved as real products and are available in store navigation, filters and product import',()=>{
 const {validateProduct}=require('../lib/validation.cjs');const p=validateProduct({name:'هدفون',cat:'گجت‌ها',brand:'',price:100000,stock:2,variants:['پیش‌فرض'],imageUrl:'/assets/bag.webp'});A.equal(p.cat,'گجت‌ها');
 A.equal(validateProduct({...p,cat:'گجت'}).cat,'گجت‌ها');
 for(const f of ['public/portal.js','public/product-import.js','public/budget.js','public/app.js','public/index.html','public/budget.html','public/product.html'])A.ok(fs.readFileSync(path.join(__dirname,'..',f),'utf8').includes('گجت‌ها'),f);
 const mask=require('../public/garment-mask.js');A.equal(mask.guess(p),'object');A.equal(require('../public/outfit-core.js').guess(p),'accessory');
});

test('Automatic fallback tries own gallery sequentially, preserves the catalog source binding and never guesses another colour',async()=>{
 const B=require('../public/garment-batch.js'),G=require('../public/garment-auto.js');
 const product={id:987,cat:'پوشاک',imageUrl:'/uploads/front.png',gallery:['/uploads/detail.png','/uploads/back.png']};
 const job=B.jobs([product],[])[0],seen=[];const value=await G.extractJob(job,async src=>{seen.push(src);if(src.endsWith('front.png'))throw Error('No garment');return{data:'data:image/png;base64,ok'}});
 A.equal(value.data,'data:image/png;base64,ok');A.deepEqual(seen,['/uploads/front.png','/uploads/detail.png']);A.equal(job.sourceImage,product.imageUrl);
 const colored={...product,options:{colors:[{id:'red',imageUrl:'/uploads/red.png'},{id:'blue',imageUrl:'/uploads/blue.png'}]}};
 A.deepEqual(B.jobs([colored],[])[0].sourceImages,['/uploads/red.png']);
 let calls=0;await A.rejects(G.extractJob(job,async()=>{calls++;throw Object.assign(Error('No model'),{code:'MODEL_UNAVAILABLE'})}));A.equal(calls,1);
});
test('Studio refreshes newly prepared cutouts without requiring a reload, and auto preparation is restricted to the admin branch',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/outfit.js'),'utf8');A.ok(js.includes('loadCutouts(true)'));A.ok(js.includes('!document.hidden'));A.ok(js.includes("if(user?.role==='admin'&&window.GarmentAuto)"));A.ok(js.includes("GarmentAuto.start(r.products)"));
});
