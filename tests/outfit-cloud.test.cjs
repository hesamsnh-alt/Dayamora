'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');const url=process.env.TEST_DATABASE_URL;
if(url&&url.includes('ep-little-credit-b4d0ijq9'))throw new Error('Production database forbidden for tests');
test('Neon: owned looks persist exact sizes and geometry, with isolation and revision conflicts',{skip:!url},async()=>{try{
 process.env.DATABASE_URL=url;
 const {withDatabase}=require('../lib/db.cjs'),{createHandler}=require('../lib/outfits.cjs'),C=require('../public/outfit-core.js');
 const uid=crypto.randomUUID(),other=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'),token2=crypto.randomBytes(32).toString('hex'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');let pid;
 await withDatabase(true,async db=>{for(const [id,t] of [[uid,token],[other,token2]]){await db.run('INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',[id,id+'@outfit-qa.invalid','Outfit test only','no-login-qa','customer',Date.now()]);await db.run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(t),id,Date.now()+3600000])}pid=(await db.one('INSERT INTO products(name,brand,cat,price,stock,variants,image_url,options) VALUES(?,?,?,?,?,?,?,?) RETURNING id',['QA blouse','QA','پوشاک',100,10,'["S","M"]','/assets/blazer.webp',JSON.stringify({colors:[{id:'wine',name:'عنابی',stock:{M:5,S:5}}]})])).id});
 const handler=createHandler({withDatabase,rateLimit:async()=>{},upload:async(_base64,privateImage)=> (privateImage?'/private-uploads/':'/uploads/')+crypto.randomUUID()+'.png'});
 async function req(path,method='GET',body,t=token,origin='https://qa.invalid'){const r=await handler(new Request('https://qa.invalid/outfit-api/'+path,{method,headers:{...(t?{cookie:'dayamora_session='+t}:{}),'content-type':'application/json',origin},...(body?{body:JSON.stringify(body)}:{})}));return{status:r.status,data:await r.json()}}
 assert.equal((await req('looks','GET',null,'')).status,401);assert.equal((await req('looks','POST',{},token,'https://evil.invalid')).status,403);
 const img=await req('assets','POST',{base64:'data:image/png;base64,eA=='});assert.equal(img.status,201);const image=img.data.imageUrl;
 const l=C.layer({id:pid,name:'QA blouse',source:'shop',imageUrl:image,price:9999},'top');Object.assign(l,{variant:'M',colorId:'wine',colorName:'tampered',x:203.5,y:212.75,w:244.25,h:267.5,rotation:11,flip:true});const look={name:'Precise outfit QA',layers:[l],background:'sage',view:'mannequin',snapshot:image};
 const a=await req('looks','POST',look);assert.equal(a.status,201);const id=a.data.id;
 const loaded=await req('looks/'+id);assert.equal(loaded.status,200);const got=loaded.data.look.layers[0];for(const f of ['variant','colorId','x','y','w','h','rotation','flip'])assert.equal(got[f],l[f]);assert.equal(got.price,100);assert.equal(got.colorName,'عنابی');assert.equal(loaded.data.look.snapshot,image);
 const otherList=await req('looks','GET',null,token2);assert.equal(otherList.data.looks.length,0);assert.equal((await req('looks/'+id,'GET',null,token2)).status,404);assert.equal((await req('looks/'+id,'PUT',{...look,revision:1},token2)).status,403);
 assert.equal((await req('looks','POST',{...look,layers:[{...l,variant:'XXL'}]})).status,400);assert.equal((await req('looks','POST',{...look,layers:[{...l,colorId:'missing'}]})).status,400);
 const updated=await req('looks/'+id,'PUT',{...look,revision:1,layers:[{...l,variant:'S',x:222}]});assert.equal(updated.status,200);assert.equal(updated.data.revision,2);assert.equal((await req('looks/'+id,'PUT',{...look,revision:1})).status,409);
 const reloaded=await req('looks/'+id);assert.equal(reloaded.data.look.layers[0].variant,'S');assert.equal(reloaded.data.look.layers[0].x,222);assert.equal((await req('looks')).data.looks[0].id,id);
 const {png}=require('./cutout-fixture.cjs');
 assert.equal((await req('cutouts','GET',null,'')).status,200);
 assert.equal((await req('cutouts','POST',{productId:pid,colorId:'wine',base64:png(),garmentOnly:true,sourceImage:'/assets/blazer.webp'})).status,403);
 const adminToken=crypto.randomBytes(32).toString('hex');await withDatabase(true,async db=>{const admin=await db.one("SELECT id FROM users WHERE role='admin'");assert.ok(admin,'QA admin fixture missing');await db.run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(adminToken),admin.id,Date.now()+600000])});
 assert.equal((await req('cutouts','POST',{productId:pid,colorId:'wine',base64:png(true),garmentOnly:true,sourceImage:'/assets/blazer.webp'},adminToken)).status,400);
 assert.equal((await req('cutouts','POST',{productId:pid,colorId:'missing',base64:png(),garmentOnly:true,sourceImage:'/assets/blazer.webp'},adminToken)).status,400);
 const ready=await req('cutouts','POST',{productId:pid,colorId:'wine',base64:png(),garmentOnly:true,sourceImage:'/assets/blazer.webp'},adminToken);assert.equal(ready.status,201);
 const listed=(await req('cutouts','GET',null,'')).data.cutouts;assert.ok(listed.some(x=>x.productId===pid&&x.colorId==='wine'&&x.imageUrl===ready.data.imageUrl));
 const approved=await req('looks','POST',{...look,layers:[{...l,image:ready.data.imageUrl}]});assert.equal(approved.status,201);
 assert.equal((await req('looks','POST',{...look,layers:[{...l,image:'/assets/blazer.webp'}]})).status,409);
 assert.equal((await req('assets','POST',{base64:png(true),kind:'cutout'})).status,400);
 console.log('Garment admin permissions, PNG alpha validation, per-color selection, no advertising fallback and exact wardrobe saving verified on QA branch.');
}catch(e){console.error('QA failure:',e.message,e.stack);throw e}
});
