const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),R=require('../lib/cutout-registry.cjs'),rows=require('../lib/prepared-cutouts.json');
test('bundled cutouts are validated transparent PNGs and bind to exact product/colour/photo',async()=>{for(const r of rows.filter(x=>x.wearable!==false)){const bytes=fs.readFileSync(path.join(__dirname,'../public',r.imageUrl));require('../lib/cutout-png.cjs').validatePng('data:image/png;base64,'+bytes.toString('base64'));const p={id:r.productId,image_url:r.sourceImage,options:JSON.stringify({colors:r.colorId?[{id:r.colorId,imageUrl:r.sourceImage}]:[]})};A.ok(R.matching(p,r.colorId,r.imageUrl));A.equal(R.matching({...p,image_url:'/uploads/new.jpg',options:JSON.stringify({colors:r.colorId?[{id:r.colorId,imageUrl:'/uploads/new.jpg'}]:[]})},r.colorId,r.imageUrl),undefined)}});
test('customer page cannot invoke model downloads or manual cutout steps',()=>{const html=fs.readFileSync(path.join(__dirname,'../public/stylist.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../public/outfit.js'),'utf8');A.ok(!/garment-segment|garment-mask/.test(html));A.ok(!/GarmentSegment|extractProduct|personalCutout|whiteCut/.test(js));A.ok(!html.includes('برش / پاک'))});
test('Batch queue uses current real products and exact colour-source bindings; replaced photos are prepared again',()=>{
 const B=require('../public/garment-batch.js'),ps=[{id:101,name:'پیراهن',cat:'پوشاک',active:true,imageUrl:'/uploads/a.png',options:{colors:[{id:'red',name:'قرمز',imageUrl:'/uploads/red.png'},{id:'blue',name:'آبی',imageUrl:'/uploads/blue.png'}]}},{id:102,cat:'کفش',active:true,imageUrl:'/uploads/shoe.png'},{id:103,cat:'زیبایی',active:true,imageUrl:'/uploads/lip.png'},{id:104,cat:'کیف',active:false,imageUrl:'/uploads/bag.png'}];
 let jobs=B.jobs(ps,[{productId:101,colorId:'red',sourceImage:'/uploads/red.png',imageUrl:'/uploads/ready.png'}]);A.equal(jobs.length,2);A.equal(jobs[0].colorId,'blue');A.equal(jobs[1].productId,102);
 jobs=B.jobs(ps,[{productId:101,colorId:'red',sourceImage:'/uploads/old-red.png'}]);A.equal(jobs.length,3);A.equal(new Set(jobs.map(B.key)).size,3);
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
