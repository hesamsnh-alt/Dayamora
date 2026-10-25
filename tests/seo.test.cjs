const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),S=require('../lib/seo.cjs');
const p={id:81,name:'پیراهن $& <script>alert(1)</script>',brand:'',cat:'پوشاک',price:729000,stock:3,active:true,variants:['M','L'],imageUrl:'/uploads/test.webp',gallery:[],desc:'لباس پنبه‌ای با ارسال از امارات به ایران',options:{colors:[]},rating:null,reviewCount:0};
const post={id:'11111111-1111-1111-1111-111111111111',status:'published',title:'مجله $& <img src=x>',summary:'راهنمای انتخاب لباس',cover:'/uploads/journal.webp',blocks:[{type:'text',text:'متن کامل مقاله'}],publishedAt:1700000000000,updatedAt:1700000100000};
const template=name=>fs.readFileSync(require('node:path').join(__dirname,'../public',name+'.html'),'utf8');
const get=async url=>url==='/api/products'?{products:[p,{...p,id:82,isSample:true},{...p,id:83,active:false}]}:url==='/api/products/81'?{product:p}:url==='/api/journal'?{posts:[post,{...post,id:'private',status:'draft'}]}:url==='/api/journal/'+post.id?{post}:(()=>{throw Object.assign(Error('Not found'),{status:404})})();
const handle=S.createHandler({get,template});
test('Product metadata uses true IRR prices without changing stored toman, no invented brand/rating and no script breakout',()=>{
 const m=S.productMeta(p),product=m.schema['@graph'][0];A.equal(product.offers.price,'7290000');A.equal(product.offers.priceCurrency,'IRR');A.equal(p.price,729000);A.equal(product.brand,undefined);A.equal(product.aggregateRating,undefined);
 const rated=S.productMeta({...p,brand:'Zara',rating:4.5,reviewCount:2,stock:0}).schema['@graph'][0];A.equal(rated.brand.name,'Zara');A.equal(rated.aggregateRating.reviewCount,2);A.equal(rated.offers.availability,'https://schema.org/OutOfStock');
 const html=S.head(template('product'),m);A.equal((html.match(/rel="canonical"/g)||[]).length,1);A.ok(html.includes('پیراهن $&amp; &lt;script&gt;'));A.ok(!html.includes('<script>alert(1)</script>'));
 const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];A.equal(JSON.parse(json)['@graph'][0].name,p.name);
});
test('Public HTML includes product text/images/links before JS and preserves the interactive page scripts and ids',async()=>{
 const r=await handle(new Request('https://untrusted.test/product?id=81&variant=L',{headers:{cookie:'private-session'}}));A.equal(r.status,200);const html=await r.text();A.ok(html.includes('لباس پنبه‌ای'));A.ok(html.includes('پیراهن $&amp; &lt;script&gt;'));A.ok(html.includes('id="pageContent"'));A.ok(html.includes('src="product.js"'));A.ok(html.includes('https://dayamora.com/product?id=81'));A.ok(!html.includes('untrusted.test'));A.equal(r.headers.get('set-cookie'),null);
});
test('Dynamic sitemap excludes inactive/sample/draft/private pages and uses current catalog without fake lastmod dates',async()=>{
 const r=await handle(new Request(S.ORIGIN+'/sitemap.xml'));A.equal(r.status,200);A.match(r.headers.get('content-type'),/xml/);const xml=await r.text();A.ok(xml.includes('/product?id=81'));A.ok(!xml.includes('/product?id=82'));A.ok(!xml.includes('/product?id=83'));A.ok(!xml.includes('private'));A.ok(!xml.includes('/admin'));A.ok(xml.includes('/journal.html?id='+post.id));A.ok(xml.includes('2023-11-14'));A.ok(!xml.includes('changefreq'));A.equal((await handle(new Request(S.ORIGIN+'/sitemap.xml?page=-1'))).status,404);
 const large=Array.from({length:45001},(_,i)=>({...p,id:i+1}));A.match(S.sitemap(large,[],null),/<sitemapindex/);A.match(S.sitemap(large,[],1),/<urlset/);
});
test('Missing pages return real 404; database outage returns non-cacheable 503, never an empty success sitemap',async()=>{
 A.equal((await handle(new Request(S.ORIGIN+'/product?id=999'))).status,404);A.equal((await handle(new Request(S.ORIGIN+'/product'))).status,404);
 const failing=S.createHandler({template,get:async()=>{throw Error('database secret')}});for(const path of ['/product?id=81','/sitemap.xml','/journal.html?id='+post.id]){const r=await failing(new Request(S.ORIGIN+path));A.equal(r.status,503);A.equal(r.headers.get('cache-control'),'no-store');A.ok(!(await r.text()).includes('database secret'))}
 A.equal((await handle(new Request(S.ORIGIN+'/sitemap.xml',{method:'POST'}))).status,405);A.equal(await(await handle(new Request(S.ORIGIN+'/product?id=81',{method:'HEAD'}))).text(),'');
});
test('Magazine articles and index remain connected, render published content and SEO dates without changing journal storage',async()=>{
 for(const path of ['/journal.html?id='+post.id,'/discover/journal']){const r=await handle(new Request(S.ORIGIN+path));A.equal(r.status,200);const html=await r.text();A.ok(html.includes('مجله $&amp; &lt;img src=x&gt;'));A.ok(!html.includes('<img src=x>'));if(path.startsWith('/journal')){A.ok(html.includes('متن کامل مقاله'));A.ok(html.includes('BlogPosting'));A.ok(html.includes('src="/journal.js"'))}else A.ok(!html.includes('id=private'))}
});
test('Catalog has crawlable product links and canonical category; filter permutations are noindex',async()=>{
 let r=await handle(new Request(S.ORIGIN+'/shop?cat='+encodeURIComponent('پوشاک'))),html=await r.text();A.equal(r.status,200);A.ok(html.includes('/product?id=81'));A.ok(!html.includes('/product?id=82'));A.ok(html.includes('index,follow,max-image-preview:large'));
 html=await(await handle(new Request(S.ORIGIN+'/shop?cat='+encodeURIComponent('پوشاک')+'&color=red'))).text();A.ok(html.includes('noindex,follow'));
});
test('Netlify bundles templates, dynamic routes use configured function paths, private HTML stays noindex and robots allows reading those directives',()=>{
 const t=fs.readFileSync(require('node:path').join(__dirname,'../netlify.toml'),'utf8'),f=fs.readFileSync(require('node:path').join(__dirname,'../netlify/functions/seo.mjs'),'utf8');A.ok(t.includes('[functions."seo"]'));A.ok(t.includes('"public/product.html"'));A.ok(!t.includes('from = "/product"'));A.ok(f.includes("'/sitemap.xml'"));A.ok(!f.includes('req.headers'));A.ok(f.includes('new Request(seo.ORIGIN+endpoint)'));
 for(const name of ['admin','club','setup','journal-admin','features-admin','garment-admin','reset-password'])A.ok(template(name).includes('content="noindex,nofollow"'));
 const robots=fs.readFileSync(require('node:path').join(__dirname,'../public/robots.txt'),'utf8');A.ok(robots.includes('Sitemap: https://dayamora.com/sitemap.xml'));A.ok(!robots.includes('Disallow: /admin'));A.ok(!robots.includes('Disallow: /uploads/'));
});

test('Image sitemap and initial HTML expose main, gallery and real colour images once, excluding private/external/data URLs',async()=>{
 const item={...p,name:'کیف چرمی',imageUrl:'/uploads/main.webp',gallery:['/uploads/main.webp','/uploads/back.webp','/private-uploads/secret.webp','https://untrusted.test/image.jpg','data:image/png;base64,test'],options:{colors:[{id:'red',name:'قرمز',imageUrl:'/uploads/red.webp'}]}};
 const photos=S.productImages(item);A.equal(photos.length,3);A.equal(photos[2].alt,'کیف چرمی — رنگ قرمز');
 const xml=S.sitemap([item,{...item,id:82,active:false}],[],null);A.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));A.equal((xml.match(/<image:image>/g)||[]).length,3);A.ok(xml.includes('<image:loc>https://dayamora.com/uploads/back.webp</image:loc>'));A.ok(!xml.includes('secret'));A.ok(!xml.includes('untrusted'));A.ok(!xml.includes('base64'));A.ok(!xml.includes('image:caption'));
 const html=S.productBody(item);for(const im of photos)A.ok(html.includes('src="'+im.url+'"'));A.ok(html.includes('alt="کیف چرمی — رنگ قرمز"'));A.equal((html.match(/src="https:\/\/dayamora.com\/uploads\/main.webp"/g)||[]).length,1);
});
test('Image-heavy sitemaps split by UTF-8 byte size as well as URL count',()=>{
 const items=Array.from({length:8},(_,i)=>({...p,id:i+1,gallery:Array.from({length:4},(_,j)=>'/uploads/image-'+i+'-'+j+'.webp')}));
 const index=S.sitemap(items,[],null,{maxBytes:2000});A.ok(index.includes('<sitemapindex'));A.ok(index.includes('sitemap.xml?page=1'));
 const parts=(index.match(/<sitemap>/g)||[]).map((_,i)=>S.sitemap(items,[],i,{maxBytes:2000}));for(const xml of parts)A.ok(Buffer.byteLength(xml)<=2000);
 A.equal(parts.join('').match(/<image:image>/g).length,40);for(let i=1;i<=8;i++)A.equal((parts.join('').match(new RegExp('<loc>https://dayamora.com/product\\?id='+i+'</loc>','g'))||[]).length,1);
});

test('Branded home identity matches visible shop name and links Dayamora to its canonical domain without keyword stuffing',()=>{
 const h=template('index');A.ok(h.includes('<h1>فروشگاه دایامورا</h1>'));A.ok(h.includes('<title>دایامورا |'));
 const schemas=[...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];A.equal(schemas.length,1);
 const graph=JSON.parse(schemas[0][1])['@graph'];const website=graph.find(x=>x['@type']==='WebSite');A.equal(website.name,'دایامورا');A.equal(website.alternateName,'Dayamora');A.equal(website.url,'https://dayamora.com/');
});

test('Brand favicon is declared once in home and dynamic HTML, with real square PNG/ICO assets and organization logo',()=>{
 const home=template('index'),again=S.head(home,S.productMeta(p));for(const h of [home,again]){A.equal((h.match(/href="\/favicon-96.png"/g)||[]).length,1);A.ok(h.includes('sizes="96x96"'));A.ok(h.includes('href="/favicon.ico"'));A.ok(h.includes('href="/apple-touch-icon.png"'))}
 for(const [name,size] of [['favicon-96.png',96],['apple-touch-icon.png',180],['dayamora-logo.png',512]]){const b=fs.readFileSync(require('node:path').join(__dirname,'../public',name));A.equal(b.readUInt32BE(16),size);A.equal(b.readUInt32BE(20),size)}
 const ico=fs.readFileSync(require('node:path').join(__dirname,'../public/favicon.ico'));A.equal(ico.readUInt16LE(2),1);A.ok(ico.readUInt16LE(4)>1);
 const schema=S.homeSchema()['@graph'].find(x=>x['@type']==='Organization');A.equal(schema.logo.url,'https://dayamora.com/dayamora-logo.png');
});
