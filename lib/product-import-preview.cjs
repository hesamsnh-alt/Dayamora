'use strict';
const {safeUrl,readPublic}=require('./import-fetch.cjs');
function decode(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):''}).trim()}
const plain=s=>decode(String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function attributes(tag){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1].toLowerCase()]=m[2]??m[3];return a}
function extract(html,url){
 const metas=(html.match(/<meta\b[^>]*>/gi)||[]).map(attributes),meta=key=>metas.filter(a=>(a.property||a.name||'').toLowerCase()===key).map(a=>decode(a.content));
 const products=[];function scan(x,depth=0){if(!x||typeof x!=='object'||depth>12||products.length>50)return;if(Array.isArray(x)){x.slice(0,100).forEach(v=>scan(v,depth+1));return}if([].concat(x['@type']||[]).some(t=>t==='Product'||t==='ProductGroup'))products.push(x);for(const k of ['@graph','mainEntity','hasVariant','itemListElement','item'])scan(x[k],depth+1)}
 for(const tag of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if((attributes(tag[1]).type||'').toLowerCase()==='application/ld+json')try{scan(JSON.parse(tag[2]))}catch{}}
 const p=products[0]||{},values=(key,max=30)=>[...new Set(products.flatMap(x=>[].concat(x[key]||[])).map(v=>plain(typeof v==='object'?v?.name:v)).filter(Boolean))].slice(0,max);
 const title=plain(p.name||meta('og:title')[0]||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]).slice(0,160),description=plain(p.description||meta('og:description')[0]||meta('description')[0]).slice(0,2300);
 const imageValues=[...products.flatMap(x=>[].concat(x.image||[])),...meta('og:image'),...meta('twitter:image')];const images=[];for(const image of imageValues){try{const src=typeof image==='object'?image?.url||image?.contentUrl:image;if(typeof src!=='string'||!src.trim())continue;const value=safeUrl(new URL(decode(src),url).href).href;if(!images.includes(value))images.push(value)}catch{}if(images.length===12)break;}
 const brand=plain(typeof p.brand==='object'?p.brand?.name:p.brand).slice(0,80),offer=[].concat(p.offers||[])[0]||{},price=plain(offer.price||offer.lowPrice).slice(0,40),currency=plain(offer.priceCurrency).slice(0,12),colors=values('color',20).map(v=>v.slice(0,60)),sizes=values('size').map(v=>v.slice(0,60));
 const facts=[brand&&'برند: '+brand,colors.length&&'رنگ‌های درج‌شده در منبع: '+colors.join('، '),sizes.length&&'سایزهای درج‌شده در منبع: '+sizes.join('، ')].filter(Boolean);
 return{url,available:!!title,title,description,brand,images,colors,sizes,sourcePrice:price,sourceCurrency:currency,suggestedDescription:[description,...facts].filter(Boolean).join('\n').slice(0,3000),reason:title?'':'اطلاعات محصول در صفحهٔ عمومی پیدا نشد؛ فرم را دستی تکمیل کنید.'};
}
async function preview(link){const url=safeUrl(link);try{const r=await readPublic(url.href);return extract(r.data.toString('utf8'),r.url)}catch{return{url:url.href,available:false,images:[],colors:[],sizes:[],reason:'دریافت خودکار از این فروشگاه ممکن نبود؛ عکس و مشخصات را دستی اضافه کنید.'}}}
async function image(link){const r=await readPublic(link,{kind:'image',limit:3*1024*1024});const b=r.data;const ok=r.type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:r.type==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';if(!ok)throw Error('محتوای عکس معتبر نیست.');return{base64:`data:${r.type};base64,${b.toString('base64')}`}}
module.exports={preview,safeUrl,extract,image};
