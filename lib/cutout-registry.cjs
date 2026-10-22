'use strict';
const prepared=require('./prepared-cutouts.json');
const parse=x=>typeof x==='string'?JSON.parse(x||'{}'):x||{};
function source(p,cid){const cs=parse(p.options).colors||[];if(cs.length&&!cs.some(c=>c.id===cid)||!cs.length&&cid)return null;return cs.find(c=>c.id===cid)?.imageUrl||p.image_url||p.imageUrl}
function matching(p,cid,url){return prepared.find(r=>r.wearable!==false&&r.productId===Number(p.id)&&r.colorId===cid&&r.sourceImage===source(p,cid)&&(!url||url===r.imageUrl))}
async function list(db){const ps=await db.all('SELECT id,image_url,options FROM products WHERE active=1'),custom=await db.all('SELECT product_id AS "productId",color_id AS "colorId",image_url AS "imageUrl",source_image AS "sourceImage" FROM garment_cutouts');const rows=[];for(const p of ps){const cs=parse(p.options).colors||[{id:''}];for(const c of cs.length?cs:[{id:''}]){const cid=c.id,src=source(p,cid),row=custom.find(r=>Number(r.productId)===Number(p.id)&&r.colorId===cid&&r.sourceImage===src)||matching(p,cid);if(row)rows.push({productId:Number(p.id),colorId:cid,imageUrl:row.imageUrl,sourceImage:src,...(row.placement?{placement:row.placement}:{})})}}return{cutouts:rows,excluded:prepared.filter(r=>r.wearable===false&&ps.some(p=>Number(p.id)===r.productId&&source(p,r.colorId)===r.sourceImage)).map(r=>r.productId)}}
module.exports={source,matching,list};
