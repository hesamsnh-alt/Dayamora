'use strict';
const {readLiteral}=require('./import-data-literal.cjs');
// Parse data, never execute scripts. Only the current product's media is imported.
function literalJSON(text){
 // Accept quoted JSON-like data (Amazon also uses single-quoted keys), never expressions.
 let out='';for(let i=0;i<text.length;i++){
  const quote=text[i];if(quote!=='"'&&quote!=="'"){out+=quote;continue}
  let value='',closed=false;
  for(i++;i<text.length;i++){const c=text[i];if(c===quote){closed=true;break}if(c!=='\\'){value+=c;continue}
   const e=text[++i],esc={'b':'\b','f':'\f','n':'\n','r':'\r','t':'\t','\\':'\\','"':'"',"'":"'",'/':'/'};
   if(Object.hasOwn(esc,e))value+=esc[e];else if(e==='u'||e==='x'){const n=e==='u'?4:2,hex=text.slice(i+1,i+1+n);if(!new RegExp('^[0-9a-f]{'+n+'}$','i').test(hex))throw Error('Invalid escape');value+=String.fromCharCode(parseInt(hex,16));i+=n}else throw Error('Invalid escape');
  }if(!closed)throw Error('Unclosed string');out+=JSON.stringify(value);
 }return JSON.parse(out);
}
function jsonAt(text,start){
 while(/\s/.test(text[start]||'')&&start<text.length)start++;
 if(!['{','['].includes(text[start]))return null;
 let depth=0,quote='',escaped=false;
 for(let i=start;i<text.length;i++){const c=text[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}if(c==='"'||c==="'")quote=c;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;if(!depth){try{return literalJSON(text.slice(start,i+1))}catch{return null}}}return null;
}
function extractMarketplace(html,url,{plain,attributes}){
 const u=new URL(url),amazon=/(^|\.)amazon\.(com|ae|sa|co\.uk|de|fr|it|es|ca|com\.au|co\.jp|in)$/i.test(u.hostname),noon=/(^|\.)noon\.com$/i.test(u.hostname);if(!amazon&&!noon)return null;
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)],clean=(v,n=160)=>plain(typeof v==='string'||typeof v==='number'?v:'').slice(0,n),rows=[],images=[],videos=[],sizes=[];
 const img=x=>typeof x==='string'?x:x?.hiRes||x?.large||x?.url||x?.src||x?.image_url||x?.imageUrl;
 const add=(name,photos=[],size=[])=>{name=clean(name,60);if(!name)return;let row=rows.find(r=>r.name===name);if(!row){row={name,images:[],sizes:[]};rows.push(row)}row.images.push(...photos.map(img).filter(Boolean));row.sizes.push(...size.map(s=>clean(s,60)).filter(Boolean))};
 const result={images,videos,colorVariants:rows,sizes,colors:[],provider:amazon?'Amazon':'Noon'};
 if(amazon){
  const textAt=id=>{const re=new RegExp('<([a-z0-9]+)\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>([\\s\\S]*?)<\\/\\1>','i');return clean(html.match(re)?.[2],3000)};
  result.name=textAt('productTitle');result.description=textAt('feature-bullets')||textAt('productDescription');result.brand=textAt('bylineInfo').replace(/^(Visit the |Brand:\s*)/i,'').replace(/ Store$/i,'');
  for(const [,attrs,body] of scripts){
   const a=attributes(attrs);let obj;try{obj=JSON.parse(body)}catch{}
   if(obj?.colorImages){for(const [name,list] of Object.entries(obj.colorImages)){const photos=Array.isArray(list)?list:[];if(name==='initial')images.push(...photos.map(img));else add(name,photos)}}
   for(const key of ['colorImages','variationValues','dimensionValuesDisplayData','videos','videoGallery']){
    const re=new RegExp('["\\\']'+key+'["\\\']\\s*:\\s*','g');for(const match of body.matchAll(re)){const value=jsonAt(body,match.index+match[0].length);if(!value)continue;
     if(key==='colorImages'){for(const [name,list] of Object.entries(value)){const photos=Array.isArray(list)?list:[];if(name==='initial')images.push(...photos.map(img));else add(name,photos)}}
     if(key==='variationValues'){if(Array.isArray(value.color_name))value.color_name.forEach(c=>add(c));if(Array.isArray(value.size_name))sizes.push(...value.size_name.map(s=>clean(s,60)))}
     if(key==='videos'||key==='videoGallery')for(const v of Array.isArray(value)?value:[]){const src=v.url||v.videoUrl||v.video_url;if(src)videos.push(src)}
    }
   }
  }
  // High-resolution gallery JSON in the main image element, not recommendation images.
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const a=attributes(tag);if(!['landingImage','imgBlkFront','ebooksImgBlkFront'].includes(a.id))continue;if(a['data-old-hires'])images.push(a['data-old-hires']);try{images.push(...Object.keys(JSON.parse(a['data-a-dynamic-image'].replace(/&quot;/g,'"').replace(/&amp;/g,'&'))))}catch{}if(a.src)images.push(a.src)}
 }else{
  const candidates=[];let visited=0;const expected=u.pathname.match(/\/([^/]+)\/p\/?$/i)?.[1]?.toLowerCase();
  function walk(x,depth=0,key=''){if(!x||typeof x!=='object'||depth>14||++visited>20000||/recommend|related|suggest|upsell|cross.?sell/i.test(key))return;if(Array.isArray(x)){x.slice(0,200).forEach(v=>walk(v,depth+1,key));return}if((x.product_title||x.title||x.name)&&(x.sku||x.sku_config)&&(x.image_keys||x.images||x.media))candidates.push(x);for(const [k,v] of Object.entries(x))walk(v,depth+1,k)}
  for(const [,attrs,body] of scripts){const a=attributes(attrs);if(a.id==='__NEXT_DATA__'||/application\/(ld\+)?json/i.test(a.type||''))try{walk(JSON.parse(body))}catch{}
   for(const match of body.matchAll(/\bproduct\s*:\s*\$R\[\d+\]\s*=\s*/g)){const product=readLiteral(body,match.index+match[0].length);if(product)walk(product)}
   for(const match of body.matchAll(/self\.__next_f\.push\(\s*/g)){const packet=jsonAt(body,match.index+match[0].length);if(!Array.isArray(packet)||typeof packet[1]!=='string')continue;for(const line of packet[1].split('\n')){const start=line.search(/[\[{]/);if(start>=0)walk(jsonAt(line,start))}}
  }
  const p=candidates.find(p=>[p.sku,p.sku_config].some(s=>String(s).toLowerCase()===expected))||(!expected&&candidates.length===1?candidates[0]:null);if(!p)return null;
  result.name=clean(p.product_title||p.title||p.name);result.description=clean([p.long_description||p.description||p.product_description,...(p.feature_bullets||[]),...(p.specifications||[]).map(v=>[v.name,v.value].filter(Boolean).join(': '))].filter(Boolean).join('\n'),3000);result.brand=clean(p.brand?.name||p.brand||p.brand_name,80);
  const noonImage=x=>{const src=img(x);if(!src)return'';if(/^https?:\/\//i.test(src)||src.startsWith('//'))return src;return /^[a-z0-9_\-/]+$/i.test(src)?'https://f.nooncdn.com/p/'+src+'.jpg':''};
  const photos=o=>[].concat(o.image_urls||o.image_keys||[],o.images||[],o.media?.images||[],(o.media_gallery?.items||[]).filter(m=>m.type==='image')).map(noonImage).filter(Boolean);images.push(...photos(p));
  const options=[].concat(p.variants||[],p.children||[],p.simples||[]);for(const v of options){if(!v||typeof v!=='object')continue;const color=clean(v.color||v.colour||v.color_name||v.attributes?.color,60),size=clean(v.size||v.size_name||v.attributes?.size||v.variant,60);if(size)sizes.push(size);if(color)add(color,photos(v),size?[size]:[])}
  const color=clean(p.color||p.color_name||p.attributes?.color||(p.specifications||[]).find(s=>/^(color|colour)(_name)?$/i.test(s.code))?.value,60);if(color)add(color,photos(p));
  for(const v of [].concat(p.videos||[],p.video||[],p.media?.videos||[],(p.media_gallery?.items||[]).filter(m=>m.type==='video'))){const src=typeof v==='string'?v:v?.contentUrl||v?.url||v?.video_url;if(src)videos.push(src)}
  const offer=[].concat(p.offers||[])[0]||{};result.sourcePrice=String(p.price??offer.sale_price??offer.price??'');result.sourceCurrency=clean(p.currency||offer.currency,12)||(/^\/uae-/i.test(u.pathname)?'AED':/^\/saudi-/i.test(u.pathname)?'SAR':'');
 }
 result.images=[...new Set([...images,...rows.flatMap(c=>c.images)].filter(Boolean))];result.colors=rows.map(c=>c.name);return result;
}
module.exports={extractMarketplace,jsonAt};
