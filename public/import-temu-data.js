(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TemuProductData=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 // Parse a JSON value after the known assignment, without evaluating page code.
 function readRaw(html){
  if(typeof html!=='string'||html.length>8000000)return null;
  for(const tag of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
   const match=/\bwindow\.rawData\s*=\s*(\{)/.exec(tag[1]);if(!match)continue;
   const start=match.index+match[0].length-1;let depth=0,quote=false,escaped=false;
   for(let i=start;i<tag[1].length;i++){const c=tag[1][i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quote=false;continue}if(c==='"'){quote=true;continue}if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;if(depth===0){try{return JSON.parse(tag[1].slice(start,i+1))}catch{return null}}}
  }return null;
 }
 function extract(html,sourceUrl){
  let u;try{u=new URL(sourceUrl)}catch{return null}if(u.protocol!=='https:'||!/(^|\.)temu\.com$/i.test(u.hostname))return null;
  const store=readRaw(html)?.store,g=store?.goods;if(!g||typeof g!=='object'||!g.goodsName||!g.goodsId)return null;
  const expected=u.searchParams.get('goods_id')||u.pathname.match(/-g-(\d+)\.html/)?.[1];if(expected&&String(expected)!==String(g.goodsId))return null;
  const txt=(s,n=60)=>typeof s==='string'?s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
  const imageUrl=x=>{const v=typeof x==='string'?x:x?.url;try{const p=new URL(v);return p.protocol==='https:'&&!p.username&&!p.password&&!p.port&&p.href.length<=2000?p.href:''}catch{return''}};
  const list=xs=>[...new Set((Array.isArray(xs)?xs:[]).map(imageUrl).filter(Boolean))];
  const main=list(g.gallery),rows=Array.isArray(store.sku)?store.sku:[],colorVariants=[],sizes=[];
  for(const row of rows.slice(0,3000)){
   if(row.goodsId!=null&&String(row.goodsId)!==String(g.goodsId))continue;
   const specs=Array.isArray(row.specs)?row.specs:[],color=txt(specs.find(x=>/^(Color|Colour|رنگ)$/i.test(x.specKey))?.specValue),size=txt(specs.find(x=>/^(Size|سایز|اندازه)$/i.test(x.specKey))?.specValue);
   if(size&&!sizes.includes(size))sizes.push(size);if(!color)continue;
   let c=colorVariants.find(x=>x.name===color);if(!c){c={name:color,images:[],sizes:[]};colorVariants.push(c)}
   c.images=list([...c.images,row.specShowImageUrl||row.thumbUrl,...main.filter(url=>(g.gallery||[]).some(x=>x.url===url&&x.id===row.galleryId))]);
   if(size&&!c.sizes.includes(size))c.sizes.push(size);
  }
  const detail=list((store.productDetail?.floorList||[]).filter(f=>f.type===1).flatMap(f=>f.items||[]));
  const all=[...new Set([...main,...colorVariants.flatMap(c=>c.images),...detail])];
  const properties=(g.goodsProperty||[]).slice(0,40).map(p=>{const key=txt(p.key,80),values=(Array.isArray(p.values)?p.values:[]).map(x=>txt(x,500)).filter(Boolean);return key&&values.length?key+': '+values.join(', '):''}).filter(Boolean).join('\n');
  const title=txt(g.goodsName,160),description=properties.slice(0,3000),warnings=[];
  if(all.length>200)warnings.push('منبع بیش از ۲۰۰ عکس دارد؛ سقف هر محصول ۲۰۰ عکس است.');
  if(colorVariants.length>20)warnings.push('منبع بیش از ۲۰ رنگ دارد؛ سقف رنگ‌بندی محصول ۲۰ رنگ است.');
  return{url:u.href,available:true,title,description,suggestedDescription:description,brand:'',category:/\b(shorts?|pants|shirt|dress|skirt|jacket|blouse|leggings|activewear)\b/i.test(title)?'پوشاک':'',images:all.slice(0,200),colors:colorVariants.slice(0,20).map(c=>c.name),sizes:sizes.slice(0,30),colorVariants:colorVariants.slice(0,20),warnings,sourceImageCount:all.length,sourceGalleryCount:main.length,sourceDetailCount:detail.length};
 }
 return{extract};
});
