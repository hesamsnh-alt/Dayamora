'use strict';
// Public presentation only: no credentials, writes, user data or schema changes.
const {LABEL}=require('./black-friday.cjs');
const promo=p=>p.blackFriday?`<span class="black-friday-price">${LABEL}</span>`:'';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ORIGIN='https://dayamora.com',CATS=['پوشاک','کیف','کفش','زیبایی','مراقبت پوست','مراقبت مو','اکسسوری','عطر','هدیه','گجت‌ها'];
const HOME='دایامورا | آنلاین شاپ لباس، کفش و محصولات زیبایی';
const DESC='در فروشگاه اینترنتی دایامورا، لباس، کیف، کفش، اکسسوری، لوازم آرایشی و محصولات مراقبت پوست را با قیمت و مشخصات مقایسه کنید. تأمین از امارات و ارسال به ایران.';
const GUIDES={
 'پوشاک':['خرید اینترنتی لباس و پوشاک','برای مقایسه لباس‌ها، جدول اندازه‌های همان محصول را ببین و در صورت وجود، اندازه‌ها را با لباسی که اندازه‌ات است مقایسه کن. رنگ و سایز را در صفحهٔ محصول بررسی کن.'],
 'کیف':['خرید آنلاین کیف','پیش از انتخاب کیف، ابعاد و ظرفیت ثبت‌شده را با وسایلی که هر روز همراه داری مقایسه کن. تصاویر محصول را برای دیدن شکل بند و جزئیات کیف بررسی کن.'],
 'کفش':['خرید آنلاین کفش','اگر محصول جدول سایز دارد، طول پای خود را با جدول همان مدل مقایسه کن. عکس‌های زوایای مختلف و سایزهای قابل انتخاب را در صفحهٔ محصول ببین.'],
 'زیبایی':['خرید آنلاین لوازم آرایشی','برای انتخاب لوازم آرایش رنگی، نام یا کد رنگ و عکس همان گزینه را در صفحهٔ محصول بررسی کن. رنگ روی نمایشگر ممکن است با نتیجهٔ واقعی فرق داشته باشد.'],
 'مراقبت پوست':['خرید محصولات مراقبت پوست','در صفحهٔ هر محصول، نوع پوست پیشنهادی و روش مصرف را در صورت درج بررسی کن. محصولات را بر اساس نیازت، مثل پاک‌کردن آرایش یا مرطوب‌کردن پوست، مقایسه کن.'],
 'مراقبت مو':['خرید محصولات مراقبت مو','برای انتخاب محصول مو، کاربرد آن را در توضیحات بخوان: شست‌وشو، حالت‌دهی یا مراقبت بعد از حمام. روش استفاده را با نوع و نیاز مویت مقایسه کن.'],
 'اکسسوری':['خرید آنلاین اکسسوری','برای انتخاب اکسسوری، ابعاد، جنس و رنگ درج‌شده را بررسی کن تا بدانی چه‌طور با لباس یا کیف دلخواهت ست می‌شود.'],
 'عطر':['خرید آنلاین عطر','اگر حجم، نوع رایحه یا نت‌های عطر در مشخصات درج شده‌اند، قبل از انتخاب آن‌ها را با سلیقهٔ خودت مقایسه کن.'],
 'هدیه':['خرید آنلاین هدیه','برای انتخاب هدیه، از کاربرد و سلیقهٔ گیرنده شروع کن. جزئیات هر گزینه و هزینه‌های نمایش‌داده‌شده را پیش از درخواست سفارش ببین.'],
 'گجت‌ها':['خرید آنلاین گجت و ابزار کاربردی','کاربرد، ابعاد و در صورت درج، نوع شارژ یا سازگاری دستگاه را در صفحهٔ محصول بررسی کن.']
};
const trackingKey=k=>/^utm_(source|medium|campaign|content|term|id)$/.test(k)||['fbclid','gclid','igshid'].includes(k);
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const absolute=p=>typeof p==='string'&&/^\/(assets|uploads)\/[a-zA-Z0-9/_.-]+$/.test(p)&&!p.includes('..')?ORIGIN+p:'';
const productURL=id=>ORIGIN+'/product?id='+Number(id);
const categoryURL=cat=>ORIGIN+'/shop'+(cat?'?cat='+encodeURIComponent(cat):'');
const visible=p=>p&&p.active!==false&&p.active!==0&&!p.isSample&&!p.is_sample;
const jsonld=data=>'<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')+'</script>';
function head(html,{title,description,url,image,type='website',schema,noindex=false}){
 html=html.replace(/<link\b(?=[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)")[^>]*>/gi,'').replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\b(?=[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+"))[^>]*>/gi,'').replace(/<link\b(?=[^>]*rel="canonical")[^>]*>/gi,'');
 const fields=[['og:type',type],['og:locale','fa_IR'],['og:site_name','دایامورا'],['og:title',title],['og:description',description],['og:url',url],...(image?[['og:image',image]]:[])];
 return html.replace('</head>',()=>`<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png"><link rel="shortcut icon" href="/favicon.ico"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><title>${E(title)}</title><meta name="description" content="${E(description)}"><link rel="canonical" href="${E(url)}"><meta name="robots" content="${noindex?'noindex,follow':'index,follow,max-image-preview:large'}">${fields.map(([k,v])=>`<meta property="${k}" content="${E(v)}">`).join('')}<meta name="twitter:card" content="${image?'summary_large_image':'summary'}"><meta name="twitter:title" content="${E(title)}"><meta name="twitter:description" content="${E(description)}">${image?`<meta name="twitter:image" content="${E(image)}">`:''}${schema?jsonld(schema):''}</head>`);
}
function productImages(p){
 const colors=p.options?.colors||[],sources=[p.imageUrl,...(p.gallery||[]),...colors.map(c=>c.imageUrl)];
 return [...new Set(sources.map(absolute).filter(Boolean))].map((url,i)=>{const c=colors.find(c=>absolute(c.imageUrl)===url);return{url,alt:p.name+(c?.name?' — رنگ '+c.name:i?' — تصویر '+(i+1):'')}});
}
function productMeta(p){
 const url=productURL(p.id),description=clean(p.desc||p.description)||`مشخصات، تصاویر، رنگ‌بندی و سایزهای ${p.name} را در فروشگاه دایامورا ببینید.`;
 const photos=productImages(p).map(x=>x.url);
 const data={'@type':'Product','@id':url+'#product',name:p.name,url,image:photos,description,sku:String(p.id),category:p.cat};
 if(clean(p.brand))data.brand={'@type':'Brand',name:clean(p.brand)};
 if(visible(p)&&Number.isFinite(Number(p.price))&&Number(p.price)>0)data.offers={'@type':'Offer',url,priceCurrency:'IRR',price:String(Math.round(Number(p.price)*10)),availability:'https://schema.org/'+(Number(p.stock)>0?'InStock':'OutOfStock'),seller:{'@id':ORIGIN+'/#organization'}};
 if(Number(p.reviewCount)>0&&Number(p.rating)>=1&&Number(p.rating)<=5)data.aggregateRating={'@type':'AggregateRating',ratingValue:Number(p.rating),reviewCount:Number(p.reviewCount),bestRating:5,worstRating:1};
 return{title:p.name+' | دایامورا',description:description.slice(0,170),url,image:photos[0],noindex:!visible(p),schema:{'@context':'https://schema.org','@graph':[data,{'@type':'Organization','@id':ORIGIN+'/#organization',name:'دایامورا',url:ORIGIN+'/'},{'@type':'BreadcrumbList',itemListElement:[['خانه',ORIGIN+'/'],[p.cat,categoryURL(p.cat)],[p.name,url]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]}};
}
function productBody(p){return`<div class="crumbs"><a href="/">خانه</a> › <a href="${E(categoryURL(p.cat))}">${E(p.cat)}</a> › ${E(p.name)}</div><section class="product-layout"><div class="product-info">${p.brand?'<span class="eyebrow">'+E(p.brand)+'</span>':''}<h1>${E(p.name)}</h1><p class="product-summary">${E(p.desc||p.description||'')}</p><div class="product-price"><strong>${Number(p.price).toLocaleString('fa-IR')} تومان</strong>${promo(p)}</div><p>${Number(p.stock)>0?'قابل درخواست سفارش':'ناموجود'}</p>${Number(p.reviewCount)>0?`<p>امتیاز ${E(p.rating)} از ۵ بر اساس ${E(p.reviewCount)} نظر</p>`:''}<p>سایز / مدل: ${E((p.variants||[]).join('، '))}</p>${p.options?.colors?.length?'<p>رنگ‌ها: '+E(p.options.colors.map(c=>c.name).join('، '))+'</p>':''}<p>هزینه ارسال هر عدد: ${Number(p.options?.shippingFee||0).toLocaleString('fa-IR')} تومان</p></div><div class="product-media-column"><div class="product-photo-main"><img src="${E(absolute(p.imageUrl))}" alt="${E(p.name)}" fetchpriority="high"></div>${productImages(p).length>1?'<div class="gallery-thumbs">'+productImages(p).slice(1).map(im=>'<a href="'+E(im.url)+'"><img src="'+E(im.url)+'" alt="'+E(im.alt)+'" loading="lazy"></a>').join('')+'</div>':''}</div></section>`}
function homeSchema(){return{'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':ORIGIN+'/#organization',name:'دایامورا',alternateName:'Dayamora',url:ORIGIN+'/',logo:{'@type':'ImageObject',url:ORIGIN+'/dayamora-logo.png',width:512,height:512},sameAs:['https://www.instagram.com/dayamora.uae/']},{'@type':'WebSite','@id':ORIGIN+'/#website',name:'دایامورا',alternateName:'Dayamora',url:ORIGIN+'/',inLanguage:'fa-IR',publisher:{'@id':ORIGIN+'/#organization'}}]}}
function sitemap(products,posts,page,{maxBytes=45*1024*1024,maxUrls=45000}={}){
 const entries=[{url:ORIGIN+'/'},{url:categoryURL()},{url:ORIGIN+'/discover/journal'},...CATS.filter(c=>products.some(p=>visible(p)&&p.cat===c)).map(c=>({url:categoryURL(c)})),...products.filter(visible).map(p=>({url:productURL(p.id),images:productImages(p).map(im=>im.url)})),...posts.filter(p=>p.status==='published').map(p=>({url:ORIGIN+'/journal.html?id='+encodeURIComponent(p.id),images:[absolute(p.cover)].filter(Boolean),lastmod:p.updatedAt||p.publishedAt}))];
 const urls=[...new Map(entries.map(x=>[x.url,x])).values()];
 const prefix='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';
 const chunks=[];let rows=[],bytes=Buffer.byteLength(prefix)+9;
 for(const x of urls){
  const row='<url><loc>'+E(x.url)+'</loc>'+(x.lastmod&&Number.isFinite(new Date(x.lastmod).getTime())?'<lastmod>'+new Date(x.lastmod).toISOString()+'</lastmod>':'')+(x.images||[]).slice(0,1000).map(url=>'<image:image><image:loc>'+E(url)+'</image:loc></image:image>').join('')+'</url>',size=Buffer.byteLength(row);
  if(rows.length&&(rows.length>=maxUrls||bytes+size>maxBytes)){chunks.push(rows.join(''));rows=[];bytes=Buffer.byteLength(prefix)+9}
  rows.push(row);bytes+=size;
 }
 if(rows.length)chunks.push(rows.join(''));
 if(page===null&&chunks.length>1)return'<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+chunks.map((_,i)=>'<sitemap><loc>'+E(ORIGIN+'/sitemap.xml?page='+i)+'</loc></sitemap>').join('')+'</sitemapindex>';
 if(page!==null&&(!Number.isSafeInteger(page)||page<0||page>=chunks.length))return null;
 return prefix+chunks[page||0]+'</urlset>';
}
function createHandler({get,template}){
 const response=(text,status=200,type='text/html; charset=utf-8')=>new Response(text,{status,headers:{'Content-Type':type,'Cache-Control':status===200?'public,max-age=0,must-revalidate':'no-store','Netlify-CDN-Cache-Control':status===200?'public,s-maxage=60':'no-store','X-Content-Type-Options':'nosniff',...(status===503?{'Retry-After':'120'}:{})}});
 return async req=>{
 if(!['GET','HEAD'].includes(req.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
 const u=new URL(req.url),path=u.pathname;let html='',meta,status=200;
 try{
  if(path==='/sitemap.xml'){
   const [{products},{posts}]=await Promise.all([get('/api/products'),get('/api/journal')]);
   const xml=sitemap(products,posts,u.searchParams.has('page')?Number(u.searchParams.get('page')):null);
   return response(req.method==='HEAD'?'':xml||'Not found',xml?200:404,'application/xml; charset=utf-8');
  }
  if(['/product','/product.html'].includes(path)){
   const id=u.searchParams.get('id');if(!/^\d{1,10}$/.test(id||''))throw Object.assign(Error('محصول مشخص نشده است.'),{status:404});
   const {product:p}=await get('/api/products/'+Number(id));html=template('product');meta=productMeta(p);
   html=html.replace(/(<main\b[^>]*id="pageContent"[^>]*>)[\s\S]*?<\/main>/,(_,open)=>open+productBody(p)+'</main>');
  }else if(['/shop','/budget','/budget.html','/value'].includes(path)){
   const {products}=await get('/api/products'),cat=u.searchParams.get('cat')||'',q=clean(u.searchParams.get('q')).toLowerCase();
   const validCat=CATS.includes(cat);
   const items=products.filter(p=>visible(p)&&(!validCat||p.cat===cat)&&(!q||clean(p.name+' '+p.brand).toLowerCase().includes(q)));
   const cards=items.slice(0,60).map(p=>`<article class="product-card"><a href="/product?id=${Number(p.id)}">${absolute(p.imageUrl)?'<img src="'+E(absolute(p.imageUrl))+'" alt="'+E(p.name)+'" loading="lazy">':''}<h2>${E(p.name)}</h2><p>${Number(p.price).toLocaleString('fa-IR')} تومان${promo(p)}</p></a></article>`).join('');
   // Keep the remaining products discoverable without loading another grid of images.
   const extra=items.slice(60).map(p=>`<li><a href="/product?id=${Number(p.id)}">${E(p.name)}</a></li>`).join('');
   const cleanCatalog=path==='/shop'&&!(!validCat&&cat)&&u.searchParams.getAll('cat').length<=1&&[...u.searchParams.keys()].every(k=>k==='cat'||trackingKey(k));
   const guide=validCat?GUIDES[cat]:null;
   const heading=guide?.[0]||'فروشگاه اینترنتی دایامورا';
   html=template('budget').replace(/(<main\b[^>]*id="pageContent"[^>]*>)[\s\S]*?<\/main>/,(_,open)=>open+'<h1>'+E(heading)+'</h1><div class="products">'+cards+'</div>'+(!items.length?'<p>فعلاً محصولی برای این انتخاب نمایش داده نمی‌شود.</p>':'')+'</main>');
   if(cleanCatalog&&items.length){
    const available=new Set(products.filter(visible).map(p=>p.cat));
    const links=CATS.filter(c=>c!==cat&&available.has(c)).map(c=>`<a class="text-link" href="${E(categoryURL(c))}">${E(GUIDES[c][0])}</a>`).join(' · ');
    // Outside the interactive grid so the guide remains visible after JS starts.
    html=html.replace('</main>',()=>'</main><section class="store-page" aria-label="راهنمای خرید دایامورا"><h2>'+E(guide?'راهنمای انتخاب از این دسته':'سفارش محصولات از امارات به ایران')+'</h2><p>'+E(guide?.[1]||DESC)+'</p>'+(links?'<nav aria-label="دسته‌های فروشگاه">'+links+'</nav>':'')+(extra?'<details><summary>محصولات بیشتر این فهرست</summary><ul>'+extra+'</ul></details>':'')+'</section>');
   }
   meta={title:(guide?.[0]||'فروشگاه اینترنتی')+' | دایامورا',description:guide?guide[0]+' در دایامورا؛ مشاهده قیمت، تصاویر و مشخصات محصولات. تأمین از امارات و ارسال به ایران.':DESC,url:categoryURL(validCat?cat:''),noindex:!cleanCatalog||!items.length};
  }else if(path==='/journal.html'){
   const id=u.searchParams.get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))throw Object.assign(Error('مقاله مشخص نشده است.'),{status:404});
   const {post}=await get('/api/journal/'+id);if(post.status!=='published')throw Object.assign(Error('مقاله پیدا نشد.'),{status:404});
   const J=require('../public/journal-core.js');html=template('journal').replace(/<div id="journalArticle">[\s\S]*?<\/div>/,()=>'<div id="journalArticle">'+J.render(post)+'</div>');
   const url=ORIGIN+'/journal.html?id='+encodeURIComponent(id),description=clean(post.seoDescription||post.summary||post.blocks?.find(b=>b.type==='text')?.text).slice(0,170);
   meta={title:(post.seoTitle||post.title)+' | دایامورا',description,url,image:absolute(post.cover),type:'article',schema:{'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description,image:absolute(post.cover),mainEntityOfPage:url,inLanguage:'fa-IR',...(post.publishedAt?{datePublished:new Date(post.publishedAt).toISOString()}:{}),...(post.updatedAt?{dateModified:new Date(post.updatedAt).toISOString()}:{}),author:{'@type':'Organization',name:'دایامورا',url:ORIGIN+'/'},publisher:{'@type':'Organization',name:'دایامورا',url:ORIGIN+'/'}}};
  }else if(path==='/discover/journal'){
   const {posts}=await get('/api/journal'),J=require('../public/journal-core.js');html=template('discover').replace(/<div id="discoverContent"[^>]*>[\s\S]*?<\/div>/,()=>'<div id="discoverContent" aria-live="polite"><h2>مجله دایامورا؛ استایل و زیبایی</h2><div class="journal-grid">'+posts.filter(p=>p.status==='published').map(J.card).join('')+'</div></div>');
   meta={title:'مجله دایامورا | راهنمای استایل و زیبایی',description:'مقاله‌های مجله دایامورا درباره استایل، زیبایی، انتخاب لباس و ترکیب کیف، کفش و اکسسوری.',url:ORIGIN+'/discover/journal'};
  }else return response('Not found',404);
  const rendered=head(html,meta);return response(req.method==='HEAD'?'':rendered,status);
 }catch(e){
  status=e.status===404?404:503;
  const error=template(path==='/journal.html'?'journal':'product').replace(/(<main\b[^>]*>)[\s\S]*?<\/main>/,'$1<h1>'+(status===404?'صفحه پیدا نشد':'دریافت اطلاعات موقتاً ممکن نیست')+'</h1><a href="/">بازگشت به فروشگاه</a></main>');
  const output=head(error,{title:status===404?'صفحه پیدا نشد | دایامورا':'دایامورا',description:'فروشگاه دایامورا',url:ORIGIN+path,noindex:true});
  return response(req.method==='HEAD'?'':output,status,path==='/sitemap.xml'?'text/plain; charset=utf-8':'text/html; charset=utf-8');
 }
 };
}
module.exports={ORIGIN,CATS,HOME,DESC,E,head,productMeta,productBody,homeSchema,productImages,sitemap,createHandler};
