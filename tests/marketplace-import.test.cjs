'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{Readable}=require('node:stream'),{EventEmitter}=require('node:events');
const Preview=require('../lib/product-import-preview.cjs'),Drafts=require('../lib/import-drafts.cjs'),{readLiteral}=require('../lib/import-data-literal.cjs'),{readPublic}=require('../lib/import-fetch.cjs');
const script=(x,type='application/json')=>'<script type="'+type+'">'+JSON.stringify(x)+'</script>';
test('Amazon gallery includes all explicit colour photos and sizes, but never recommendation or arbitrary image galleries',()=>{
 const html='<span id="productTitle">Cotton Shirt</span><div id="feature-bullets"><ul><li>100% Cotton</li></ul></div><a id="bylineInfo">Visit the Example Store</a><script>var data={"colorImages":{\'initial\':[{"hiRes":"https://m.media-amazon.com/images/I/main.jpg"}],"Black":[{"hiRes":"https://m.media-amazon.com/images/I/black1.jpg"},{"hiRes":"https://m.media-amazon.com/images/I/black2.jpg"}],"Pink":[{"large":"https://m.media-amazon.com/images/I/pink.jpg"}]},"variationValues":{"size_name":["S","M","L"],"color_name":["Black","Pink"]},"videos":[{"url":"https://video.example/shirt.mp4"}]}; throw Error("DO NOT EXECUTE")</script><img src="https://other.example/recommended.jpg">';
 const p=Preview.extract(html,'https://www.amazon.ae/dp/B000000001');A.equal(p.provider,'Amazon');A.equal(p.title,'Cotton Shirt');A.equal(p.brand,'Example');A.match(p.description,/100% Cotton/);A.equal(p.images.length,4);A.deepEqual(p.colors,['Black','Pink']);A.deepEqual(p.sizes,['S','M','L']);A.equal(p.colorVariants[0].images.length,2);A.deepEqual(p.videos,['https://video.example/shirt.mp4']);A.ok(!p.images.some(u=>u.includes('recommended')));
});
test('Noon current serialized SSR reader handles refs and escapes without executing expressions',()=>{
 const p=readLiteral('{product:$R[2]={sku:"ABC",flag:!0,other:void 0,images:$R[3]=["https://cdn.example/a.jpg"],same:$R[3],text:"\\x3Cb>Hi\\x3C/b>"}}');A.equal(p.product.flag,true);A.equal(p.product.text,'<b>Hi</b>');A.equal(p.product.images,p.product.same);
 for(const value of ['{x:process.exit()}','{x:(()=>{throw Error()})()}','{__proto__:{polluted:true}}','{x:require("fs")}'])A.equal(readLiteral(value),null);
});
test('Noon current SSR product keeps gallery, variants and videos isolated from navigation and recommendations',()=>{
 const html='<script>var productRecommendations={product:{sku:"OTHER",product_title:"Other",image_keys:["other"]}};var catalog={product:$R[1185]={sku:"ZABC",product_title:"Dress",brand:"Example",feature_bullets:$R[1193]=["Cotton"],image_keys:$R[1198]=["pzsku/ZABC/front","pzsku/ZABC/back"],variants:$R[1200]=[$R[1201]={variant:"M"},$R[1202]={variant:"L"}],media_gallery:$R[1255]={items:$R[1258]=[{type:"video",url:"https://video.example/dress.mp4"}]},specifications:[{name:"Colour Name",code:"colour_name",value:"Pink"}]}};</script>';
 const p=Preview.extract(html,'https://www.noon.com/uae-en/dress/ZABC/p/');A.equal(p.provider,'Noon');A.equal(p.title,'Dress');A.equal(p.images.length,2);A.deepEqual(p.sizes,['M','L']);A.deepEqual(p.colors,['Pink']);A.deepEqual(p.videos,['https://video.example/dress.mp4']);A.ok(!p.images.some(u=>u.includes('other')));
});
test('Noon Next data uses only matching current SKU, and rejects unrelated single product',()=>{
 const product={sku:'N123',product_title:'Bag',images:['https://cdn.example/bag.jpg'],variants:[{color:'Black',size:'M',images:['https://cdn.example/black.jpg']}]};
 const p=Preview.extract(script({props:{pageProps:{product,recommendations:[{...product,sku:'OTHER',images:['https://cdn.example/other.jpg']}]}}}),'https://www.noon.com/uae-en/bag/N123/p/');A.deepEqual(p.colors,['Black']);A.deepEqual(p.sizes,['M']);A.ok(!p.images.some(u=>u.includes('other')));A.equal(Preview.extract(script({product}),'https://www.noon.com/uae-en/bag/OTHER/p/').images.length,0);
});
test('Other stores retain Product/Shopify media and import direct video files only; embeds, scripts and private links are excluded',()=>{
 const html=script({'@type':'Product',name:'Bag',video:[{'@type':'VideoObject',contentUrl:'https://cdn.example/bag.mp4?token=public'},{embedUrl:'https://youtube.com/embed/id'},{contentUrl:'https://127.0.0.1/internal.mp4'},{contentUrl:'javascript:alert(1)'}]},'application/ld+json')+script({product:{title:'Bag',images:['https://cdn.example/bag.jpg'],variants:[],media:[{media_type:'video',sources:[{url:'https://cdn.example/second.webm'}]}]}});
 const p=Preview.extract(html,'https://store.example/bag');A.deepEqual(p.videos,['https://cdn.example/bag.mp4?token=public','https://cdn.example/second.webm']);
});
test('HTML fallback is authenticated, size bounded and uses the same extractors',async()=>{
 let allowed=false;const ctx={admin:async()=>{if(!allowed)throw Object.assign(Error('denied'),{status:403})},body:r=>r.json(),json:x=>x};const request=b=>new Request('https://shop.example/api/admin/import-preview',{method:'POST',body:JSON.stringify(b)});
 const b={url:'https://www.amazon.ae/dp/B000000001',html:'<span id="productTitle">Cotton Shirt</span>'};await A.rejects(Drafts.route(request(b),ctx),{status:403});allowed=true;A.equal((await Drafts.route(request(b),ctx)).title,'Cotton Shirt');await A.rejects(Drafts.route(request({...b,html:'x'.repeat(3000001)}),ctx),{status:400});
});
test('Registered video persists in draft and resumes in the existing product video editor; remote or missing upload cannot publish as a draft video',async()=>{
 const video='/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4';let stored;const ctx={admin:async()=>({id:'admin'}),body:r=>r.json(),json:x=>x,db:{one:async(q,a)=>{if(q.startsWith('SELECT path'))return a[0]===video?{path:video}:null;stored=JSON.parse(a[2]);return{id:4}}}};
 const req=v=>new Request('https://shop.example/api/admin/product-imports',{method:'POST',body:JSON.stringify({sourceUrl:'https://www.amazon.ae/dp/B000000001',videoUrl:v,sourceVideos:['https://video.example/a.mp4'],title:'پیراهن'})});await Drafts.route(req(video),ctx);A.equal(stored.videoUrl,video);A.equal(stored.sourceVideos.length,1);
 const context={window:{},document:{querySelector(){}},Daya:{escape:String}};vm.runInNewContext(fs.readFileSync(require.resolve('../public/product-import.js'),'utf8'),context);A.equal(context.window.ProductImport.toProduct({product_data:stored,image_urls:[]}).options.videoUrl,video);
 for(const v of ['https://video.example/a.mp4','/uploads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.mp4'])await A.rejects(Drafts.route(req(v),ctx),{status:400});
});
test('Video fetch enforces MIME, size and redirect DNS boundaries before storage',async()=>{
 const lookup=async()=>[{address:'1.1.1.1',family:4}];const transport=spec=>{let calls=0;return{get calls(){return calls},request:(u,o,callback)=>{calls++;const e=new EventEmitter();e.end=()=>{const r=Readable.from([Buffer.from(spec.data||'video')]);r.statusCode=spec.status||200;r.headers=spec.headers;callback(r)};return e}}};
 let t=transport({headers:{'content-type':'video/mp4'}});A.equal((await readPublic('https://video.example/a.mp4',{kind:'video',lookup,request:t.request})).type,'video/mp4');
 for(const headers of [{'content-type':'text/html'},{'content-type':'video/mp4','content-length':'999999999'}]){t=transport({headers});await A.rejects(readPublic('https://video.example/a.mp4',{kind:'video',lookup,request:t.request}),/مجاز/)}
 t=transport({status:302,headers:{location:'https://private.example/a.mp4'}});await A.rejects(readPublic('https://video.example/a.mp4',{kind:'video',lookup:async h=>[{address:h==='video.example'?'1.1.1.1':'127.0.0.1',family:4}],request:t.request}),/خصوصی/);A.equal(t.calls,1);
});
test('Video import endpoint authenticates before fetching and registers the stored video against the admin',async()=>{
 const file=require.resolve('../lib/import-drafts.cjs'),real=require('node:module').createRequire(file);let fetched=0,registered,allowed=false;
 const context={require:p=>p==='./import-fetch.cjs'?{...real(p),readPublic:async()=>{fetched++;return{data:Buffer.alloc(32),type:'video/mp4'}}}:p==='./storage.cjs'?{MAX_VIDEO_BYTES:100*1024*1024,uploadImportedVideo:async()=>'/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4'}:real(p),module:{exports:{}},URL,Buffer,Date};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
 const ctx={admin:async()=>{if(!allowed)throw Object.assign(Error('denied'),{status:403});return{id:'owner'}},body:r=>r.json(),json:(data,status)=>({data,status}),db:{run:async(q,a)=>registered=a}};
 const req=()=>new Request('https://shop.example/api/admin/import-video',{method:'POST',body:JSON.stringify({url:'https://video.example/a.mp4'})});await A.rejects(context.module.exports.route(req(),ctx),{status:403});A.equal(fetched,0);allowed=true;const result=await context.module.exports.route(req(),ctx);A.equal(result.status,201);A.equal(registered[1],'owner');A.equal(registered[0],result.data.videoUrl);
});
test('Noon image resizing aliases deduplicate while explicit colour association is preserved',()=>{
 const image='https://f.nooncdn.com/p/example.jpg';const p=Preview.extract(script({'@type':'Product',name:'Bag',color:'Black',image:image+'?width=1200'},'application/ld+json')+script({product:{sku:'N123',product_title:'Bag',images:[image]}}),'https://www.noon.com/uae-en/bag/N123/p/');A.deepEqual(p.images,[image]);A.deepEqual(p.colorVariants[0].images,[image]);
});
