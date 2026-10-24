'use strict';
// Read JSON only. Never execute page scripts or collect recommendation galleries.
function embeddedProduct(html,{plain,attributes,title,url}){
 const candidates=[];let visited=0;
 function walk(x,depth=0,key=''){
  if(!x||typeof x!=='object'||depth>12||++visited>12000)return;
  if(/recommend|related|upsell|cross.?sell|suggest/i.test(key))return;
  if(Array.isArray(x)){x.slice(0,150).forEach(v=>walk(v,depth+1,key));return}
  const name=plain(x.title||x.name),variants=x.variants;
  if(name&&Array.isArray(variants)&&(Array.isArray(x.images)||Array.isArray(x.media)))candidates.push(x);
  for(const [k,v] of Object.entries(x))walk(v,depth+1,k);
 }
 for(const tag of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const a=attributes(tag[1]);if(!/^(application\/json|application\/ld\+json)$/i.test(a.type||''))continue;
  try{walk(JSON.parse(tag[2]))}catch{}
 }
 const norm=s=>plain(s).toLowerCase();
 const matches=candidates.filter(p=>{try{if(p.url&&new URL(p.url,url).pathname===new URL(url).pathname)return true}catch{}return norm(p.title||p.name)===norm(title)});
 // A unique main product container is usable without SEO-title equality.
 const p=matches[0]||(candidates.length===1?candidates[0]:null);if(!p)return null;
 const options=(p.options||[]).map(o=>plain(typeof o==='string'?o:o?.name)),colorIndex=options.findIndex(o=>/^(color|colour|رنگ)$/i.test(o)),sizeIndex=options.findIndex(o=>/^(size|سایز|اندازه)$/i.test(o));
 const media=[...(p.images||[]),...(p.media||[])].filter(m=>!m?.media_type||m.media_type==='image');
 const src=m=>typeof m==='string'?m:m?.src||m?.url||m?.contentUrl||m?.preview_image?.src;
 const images=media.map(src).filter(Boolean),colorVariants=[],sizes=[];
 for(const v of p.variants.slice(0,600)){
  const selected=Array.isArray(v.selectedOptions)?v.selectedOptions:[];
  const option=(kind,index)=>selected.find(o=>kind.test(plain(o?.name)))?.value||(index>=0?v['option'+(index+1)]||v.options?.[index]:'');
  const color=plain(v.color||option(/^(color|colour|رنگ)$/i,colorIndex)),size=plain(v.size||option(/^(size|سایز|اندازه)$/i,sizeIndex));
  if(size&&!sizes.includes(size))sizes.push(size);
  if(!color)continue;
  let row=colorVariants.find(c=>c.name===color);if(!row){row={name:color,images:[],sizes:[]};colorVariants.push(row)}
  // Only explicit image IDs/variant IDs create a colour association.
  const linked=media.filter(m=>m&&typeof m==='object'&&(v.image_id!=null&&String(m.id)===String(v.image_id)||v.id!=null&&Array.isArray(m.variant_ids)&&m.variant_ids.some(id=>String(id)===String(v.id))));
  row.images.push(...[].concat(v.featured_image||[],v.image||[],v.images||[]).map(src).filter(Boolean),...linked.map(src).filter(Boolean));
  if(size&&!row.sizes.includes(size))row.sizes.push(size);
 }
 return{name:plain(p.title||p.name),description:plain(p.description||p.body_html),brand:plain(p.vendor||p.brand?.name||p.brand),images,colorVariants,colors:colorVariants.map(c=>c.name),sizes};
}
module.exports={embeddedProduct};
