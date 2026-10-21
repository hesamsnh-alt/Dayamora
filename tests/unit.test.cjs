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
