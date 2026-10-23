'use strict';
const {fail,text}=require('./validation.cjs'),{safeUrl}=require('./import-fetch.cjs'),preview=require('./product-import-preview.cjs');
const parse=x=>typeof x==='string'?JSON.parse(x):x;
async function route(req,{db,admin,body,json,checkedProduct}){
 const p=new URL(req.url).pathname,m=req.method;
 if(!['/api/admin/import-preview','/api/admin/import-image','/api/admin/product-imports'].includes(p)&&!/^\/api\/admin\/product-imports\/[a-zA-Z0-9-]{1,80}\/approve$/.test(p))return null;
 await admin();
 if(m==='POST'&&p==='/api/admin/import-preview'){const b=await body(req);try{return json(await preview.preview(b.url))}catch(e){throw fail(400,e.message)}}
 if(m==='POST'&&p==='/api/admin/import-image'){const b=await body(req);try{return json(await preview.image(b.url))}catch{throw fail(400,'دریافت عکس ممکن نبود. عکس را از دستگاه اضافه کنید.')}}
 if(m==='POST'&&p==='/api/admin/product-imports'){
  const b=await body(req);let source;try{source=safeUrl(b.sourceUrl)}catch(e){throw fail(400,e.message)}
  const imageUrls=Array.isArray(b.imageUrls)?[...new Set(b.imageUrls)].slice(0,9):[];
  for(const image of imageUrls)if(typeof image!=='string'||!/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(image)||!await db.one('SELECT path FROM uploads WHERE path=? AND private=0',[image]))throw fail(400,'عکس پیش‌نویس باید در فروشگاه بارگذاری شود.');
  const list=(v,max)=>Array.isArray(v)?[...new Set(v.slice(0,max).map(x=>text(x,60)).filter(Boolean))]:[];
  const data={title:text(b.title,160),description:text(b.description,3000),category:text(b.category,80),brand:text(b.brand,80),sizes:list(b.sizes,30),colors:list(b.colors,20)};
  const r=await db.one('INSERT INTO product_imports(source_url,source_name,product_data,image_urls,status) VALUES(?,?,?,?,?) RETURNING id',[source.href,source.hostname,JSON.stringify(data),JSON.stringify(imageUrls),'draft']);
  return json({id:r.id,status:'draft'},201);
 }
 if(m==='GET'&&p==='/api/admin/product-imports'){
  const rows=await db.all('SELECT id,source_url,source_name,product_data,image_urls,status,created_at FROM product_imports ORDER BY created_at DESC LIMIT 50');
  return json({imports:rows.map(r=>({...r,product_data:parse(r.product_data),image_urls:parse(r.image_urls)||[]}))});
 }
 if(m==='POST'&&p.endsWith('/approve')){
  const id=p.split('/')[4],draft=await db.one('SELECT id,status,product_data,product_id FROM product_imports WHERE id=?',[id]);if(!draft)throw fail(404,'پیش‌نویس پیدا نشد.');
  const previous=parse(draft.product_data)||{};
  if(draft.status==='published'&&(draft.product_id||previous.productId))return json({id:draft.product_id||previous.productId,alreadyApproved:true});
  if(!['draft','review'].includes(draft.status))throw fail(409,'این پیش‌نویس قابل تأیید نیست.');
  const b=await checkedProduct(await body(req)),values=[b.name,b.brand,b.cat,b.price,b.stock,JSON.stringify(b.variants),b.imageUrl,b.description,b.active,JSON.stringify(b.gallery),b.comparePrice,JSON.stringify(b.options)];
  const result=await db.one('INSERT INTO products(name,brand,cat,price,stock,variants,image_url,description,active,gallery,compare_price,options,is_sample) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0) RETURNING id',values);
  await db.run('UPDATE product_imports SET status=?,product_data=?,product_id=? WHERE id=?',['published',JSON.stringify({...previous,productId:result.id}),result.id,id]);return json({id:result.id},201);
 }
 throw fail(405,'عملیات پشتیبانی نمی‌شود.');
}
module.exports={route};
