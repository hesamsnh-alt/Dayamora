const {test}=require('node:test'),assert=require('node:assert/strict');
const {decodeImage}=require('../lib/storage.cjs');
const {validateProduct}=require('../lib/validation.cjs');
const {handle}=require('../lib/api.cjs');
test('Image validation rejects spoofed and oversized uploads',()=>{
  assert.throws(()=>decodeImage('data:image/png;base64,bm90LWFuLWltYWdl'),{status:400});
  assert.throws(()=>decodeImage('data:image/svg+xml;base64,PHN2Zz4='),{status:400});
  assert.throws(()=>decodeImage('data:image/png;base64,'+Buffer.alloc(3*1024*1024+1).toString('base64')),{status:413});
});
test('Product validation preserves actual discounts and rejects unsafe image paths',()=>{
  const p={name:'Bag',brand:'Dayamora',cat:'کیف',price:1e6,stock:1,variants:['pink'],imageUrl:'/assets/bag.webp'};
  assert.equal(validateProduct(p).comparePrice,null);
  assert.throws(()=>validateProduct({...p,comparePrice:900000}),{status:400});
  assert.throws(()=>validateProduct({...p,imageUrl:'https://evil.example/image.svg'}),{status:400});
});
test('Cross-origin writes fail before any database access',async()=>{
  const r=await handle(new Request('https://dayamora.example/api/me',{method:'PUT',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'}));
  assert.equal(r.status,403);assert.equal(r.headers.get('Cache-Control'),'no-store');
});

test('API client distinguishes a crashed function from an absent route',async()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  for(const [status,expected] of [[502,/هنگام اجرا/],[404,/مسیر سرور/]]){
    const sandbox={window:{},fetch:async()=>new Response('<html>Error</html>',{status,headers:{'Content-Type':'text/html'}})};
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/common.js'),'utf8'),sandbox);
    await assert.rejects(sandbox.window.Daya.api('/api/bootstrap'),e=>e.status===status&&expected.test(e.message));
  }
});

test('Upload errors identify the stage and hide credentials in messages and causes',async()=>{
  const {storageFailure,safeMessage}=require('../lib/storage-errors.cjs');
  const env={DAYAMORA_S3_ACCESS_KEY_ID:'test-access-identifier',DAYAMORA_S3_SECRET_ACCESS_KEY:'test-secret-value',DATABASE_URL:'postgresql://user:test-db-password@db.example/store'};
  const sanitized=safeMessage(new Error('test-access-identifier test-secret-value test-db-password https://store.example/key?signature=secret'),env);
  for(const secret of ['test-access-identifier','test-secret-value','test-db-password','https://store.example'])assert.ok(!sanitized.includes(secret));
  for(const [name,expected] of [['InvalidAccessKeyId','InvalidAccessKeyId'],['SignatureDoesNotMatch','SignatureDoesNotMatch'],['AccessDenied','AccessDenied'],['NoSuchBucket','NoSuchBucket']]){
    const original=Object.assign(new Error('Request rejected'),{name,$metadata:{httpStatusCode:403}});
    const failure=storageFailure(original);assert.equal(failure.status,502);assert.equal(failure.diagnostic.stage,'storage.upload');assert.equal(failure.diagnostic.code,expected);assert.match(failure.message,new RegExp(expected));
  }
  assert.equal(storageFailure(new Error('Region is not a valid hostname component.')).diagnostic.code,'STORAGE_REGION_INVALID');
  assert.equal(storageFailure(new Error('Invalid URL')).diagnostic.code,'STORAGE_ENDPOINT_INVALID');
  const {S3Client}=require('@aws-sdk/client-s3'),storage=require('../lib/storage.cjs');
  const originalSend=S3Client.prototype.send;
  const keys=['DAYAMORA_S3_ENDPOINT','DAYAMORA_S3_REGION','DAYAMORA_S3_ACCESS_KEY_ID','DAYAMORA_S3_SECRET_ACCESS_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    Object.assign(process.env,{DAYAMORA_S3_ENDPOINT:'https://storage.example',DAYAMORA_S3_REGION:'us-east-2',DAYAMORA_S3_ACCESS_KEY_ID:env.DAYAMORA_S3_ACCESS_KEY_ID,DAYAMORA_S3_SECRET_ACCESS_KEY:env.DAYAMORA_S3_SECRET_ACCESS_KEY});
    S3Client.prototype.send=async()=>{throw new Error('SDK error with test-secret-value',{cause:new Error('Cause with test-access-identifier')})};
    await assert.rejects(storage.upload('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJb0AAAAASUVORK5CYII='),e=>{
      assert.equal(e.diagnostic.stage,'storage.upload');assert.ok(!JSON.stringify(e.diagnostic).includes('test-secret-value'));assert.ok(!JSON.stringify(e.diagnostic).includes('test-access-identifier'));assert.equal(e.status,502);return true;
    });
  }finally{S3Client.prototype.send=originalSend;for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
});
