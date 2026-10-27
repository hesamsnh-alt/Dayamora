'use strict';
// SHEGLAM publishes shade siblings separately from the selected Product JSON-LD.
// Read only the current page's goodsInfo; never execute scripts or read reviews.
function extractSheglam(html,url,{plain,attributes}){
 const u=new URL(url);
 if(!(u.hostname==='sheglam.com'||u.hostname.endsWith('.sheglam.com'))||! /\/product\//i.test(u.pathname))return null;
 const expected=u.pathname.match(/-(\d+)\/?$/)?.[1];
 let props;
 for(const [,attrs,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const a=attributes(attrs);if(a.id!=='__NEXT_DATA__'||body.length>8000000)continue;
  try{props=JSON.parse(body)?.props?.pageProps}catch{}if(props)break;
 }
 const p=props?.goodsInfo;
 if(!p||typeof p!=='object'||!plain(p.goods_name)||!p.origin_product_id||expected&&String(p.origin_product_id)!==expected)return null;
 const clean=v=>typeof v==='string'||typeof v==='number'?plain(v):'';
 const photo=v=>{
  const value=typeof v==='string'?v:v?.url||v?.src||v?.image_url;if(typeof value!=='string'||!value.trim())return '';
  try{const x=new URL(value.replace(/&amp;/g,'&'),url);
   // Upgrade the source's own legacy CDN links only, keeping general URL rules strict.
   if(x.protocol==='http:'&&(x.hostname==='ltwebstatic.com'||x.hostname.endsWith('.ltwebstatic.com')))x.protocol='https:';
   if(x.protocol!=='https:'||x.username||x.password||x.port||/\.(?:gif|svg|avif)(?:$)/i.test(x.pathname))return '';
   return x.href;
  }catch{return ''}
 };
 const photos=values=>[...new Set([].concat(values||[]).map(photo).filter(Boolean))].slice(0,200);
 const own=photos([p.image_url,...(Array.isArray(p.image_list)?p.image_list:[])]),rows=[];
 const sizeList=o=>(Array.isArray(o.size_list)?o.size_list:[]).map(s=>clean(s?.size||s?.size_vale)).filter(Boolean);
 const sizes=[...new Set(sizeList(p))].slice(0,30);
 function add(v,name){
  name=clean(name).slice(0,60);if(!name)return;
  let row=rows.find(r=>r.name===name);if(!row){row={name,images:[],sizes:[]};rows.push(row)}
  const current=v.skc&&v.skc===p.skc||String(v.origin_product_id||'')===String(p.origin_product_id);
  row.images=photos([...row.images,v.skc_main_picture,...(current?own:[]),v.picture]);
  row.sizes=[...new Set([...row.sizes,...(current?sizes:sizeList(v))])].slice(0,30);
 }
 const attr=p.main_sale_attr||{};
 if(/^(color|colour|shade|رنگ)$/i.test(clean(attr.attr_name)))for(const v of (Array.isArray(attr.attr_value_list)?attr.attr_value_list:[]).slice(0,200))if(v&&typeof v==='object')add(v,v.attr_value_name||v.color_name);
 for(const v of (Array.isArray(p.color_infos)?p.color_infos:[]).slice(0,200))if(v&&typeof v==='object')add(v,v.color_name);
 const currentName=(Array.isArray(p.color_infos)?p.color_infos:[]).find(v=>v?.skc===p.skc||String(v?.origin_product_id||'')===String(p.origin_product_id))?.color_name;
 const currentIndex=rows.findIndex(r=>r.name===clean(currentName));if(currentIndex>0)rows.unshift(...rows.splice(currentIndex,1));
 const warnings=[];if(rows.length>20)warnings.push('این محصول بیش از ۲۰ رنگ دارد؛ فرم فعلی حداکثر ۲۰ رنگ را می‌پذیرد. رنگ‌های باقی‌مانده را در محصول جداگانه وارد کنید.');
 const colorVariants=rows.slice(0,20),description=clean(p.skc_description)||clean(p.description?.description)||clean(p.description);
 return{provider:'SHEGLAM',name:clean(p.goods_name),description:description.slice(0,3000),brand:'SHEGLAM',sourcePrice:clean(p.sales_price),sourceCurrency:clean(p.currency_code||props.currency),
  images:photos([...own,...colorVariants.flatMap(c=>c.images)]),colorVariants,colors:colorVariants.map(c=>c.name),sizes,videos:[],warnings};
}
module.exports={extractSheglam};
