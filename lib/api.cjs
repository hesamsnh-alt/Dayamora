'use strict';
const crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),{withDatabase,rateLimit}=require('./db.cjs'),storage=require('./storage.cjs');
const {fail,text,checkPassword,validateProduct}=require('./validation.cjs');
const Catalog=require('../public/catalog-options.js'),{view,checkCart}=require('./inventory.cjs'),{paymentRoute,bankSettings,changeInventory}=require('./payments.cjs');
const OWNER='hesamsnh@gmail.com',uuid=()=>crypto.randomUUID(),now=()=>Date.now();
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const userView=u=>u?{id:u.id,email:u.email,name:u.name,role:u.role,phone:u.phone,address:u.address}:null;
const headers={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin',
  'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
function json(data,status=200,cookie){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...(cookie?{'Set-Cookie':cookie}:{})}})}
async function passwordHash(v){const salt=crypto.randomBytes(16).toString('hex');return salt+':'+(await scrypt(v,salt,64)).toString('hex')}
async function passwordCheck(v,stored){const [salt,key]=stored.split(':');return crypto.timingSafeEqual(Buffer.from(key,'hex'),await scrypt(v,salt,64))}
function sessionToken(req){const raw=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dayamora_session='));const t=raw?.slice(17);return /^[a-f0-9]{64}$/.test(t||'')?t:null}
function cookie(token,url){return `dayamora_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?604800:0}${url.protocol==='https:'?'; Secure':''}`}
async function body(req){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'JSON required');
  if(Number(req.headers.get('content-length')||0)>4500000)throw fail(413,'درخواست بیش از حد مجاز است.');
  const reader=req.body?.getReader();let size=0;const chunks=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4500000){await reader.cancel();throw fail(413,'درخواست بیش از حد مجاز است.')}chunks.push(Buffer.from(value))}
  try{const b=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!b||typeof b!=='object'||Array.isArray(b))throw new Error();return b}catch{throw fail(400,'اطلاعات ارسالی معتبر نیست.')}
}
async function route(req,ctx,db){
  const {all,one,run}=db,url=new URL(req.url),p=url.pathname,m=req.method;
  let current;
  async function getUser(){if(current!==undefined)return current;const token=sessionToken(req);return current=token?await one('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[hash(token),now()])||null:null}
  async function auth(){const u=await getUser();if(!u)throw fail(401,'برای ذخیره‌سازی در حساب، وارد شوید.');return u}
  async function admin(){const u=await auth();if(u.role!=='admin')throw fail(403,'این بخش فقط برای مدیر است.');return u}
  async function createSession(id){const t=crypto.randomBytes(32).toString('hex');await run('DELETE FROM sessions WHERE expires_at<?',[now()]);await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(t),id,now()+604800000]);return cookie(t,url)}
  async function state(id){const r=await one('SELECT cart,favorites,preferences FROM selections WHERE user_id=?',[id]);return r?{cart:JSON.parse(r.cart),favorites:JSON.parse(r.favorites),preferences:JSON.parse(r.preferences)}:{cart:[],favorites:[],preferences:{}}}
  async function balance(id){return Number((await one('SELECT COALESCE(SUM(delta),0) value FROM points WHERE user_id=?',[id])).value)}
  async function orders(id){return (await all('SELECT id,items,total,status,created_at,completed_at,payment FROM orders WHERE user_id=? ORDER BY created_at DESC',[id])).map(o=>({...o,items:JSON.parse(o.items),payment:JSON.parse(o.payment||'{}')}))}
  async function products(hidden=false){
    const sold=new Map();for(const o of await all("SELECT items FROM orders WHERE status='completed'"))for(const i of JSON.parse(o.items))sold.set(i.id,(sold.get(i.id)||0)+i.qty);
    const rows=await all(`SELECT p.*,(SELECT AVG(r.rating) FROM reviews r WHERE r.product_id=p.id AND r.hidden=0) rating,(SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id AND r.hidden=0) review_count FROM products p ${hidden?'':'WHERE p.active=1'} ORDER BY p.id`);
    return rows.map(r=>({...r,active:!!r.active,isSample:!!r.is_sample,options:JSON.parse(r.options||'{}'),variants:JSON.parse(r.variants),gallery:JSON.parse(r.gallery),imageUrl:r.image_url,desc:r.description,comparePrice:r.compare_price,rating:r.rating===null?null:Number(r.rating),reviewCount:Number(r.review_count),soldCount:sold.get(r.id)||0}));
  }
  async function selections(b){
    if(!Array.isArray(b.cart)||!Array.isArray(b.favorites)||b.cart.length>100||b.favorites.length>500)throw fail(400,'انتخاب‌ها معتبر نیستند.');
    const map=new Map((await products()).map(p=>[p.id,p])),cart=[];
    for(const c of b.cart){const pr=map.get(Number(c.id));if(!pr)continue;const qty=Number(c.qty);if(!Number.isSafeInteger(qty)||qty<1||qty>99||!pr.variants.includes(c.variant))throw fail(400,'تعداد یا مدل انتخابی معتبر نیست.');const item={id:pr.id,variant:c.variant,qty,...(c.colorId?{colorId:String(c.colorId)}:{})};if(!Catalog.valid(pr,item))throw fail(400,'رنگ محصول را دوباره انتخاب کنید.');const old=cart.find(x=>Catalog.key(x)===Catalog.key(item));if(old){if(old.qty+qty>99)throw fail(400,'تعداد بیش از حد مجاز است.');old.qty+=qty}else cart.push(item)}
    const min=Number(b.preferences?.minPrice??0),max=Number(b.preferences?.maxPrice??1e12);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<0||max<min||max>1e12)throw fail(400,'بازهٔ بودجه معتبر نیست.');
    return{cart,favorites:[...new Set(b.favorites.map(Number))].filter(id=>map.has(id)),preferences:{minPrice:min,maxPrice:max}};
  }
  async function eligible(uid,pid){return (await all("SELECT items FROM orders WHERE user_id=? AND status='completed'",[uid])).some(o=>JSON.parse(o.items).some(i=>i.id===pid))}
  async function saveImage(b,privateImage,u){const image=await storage.upload(b.base64,privateImage);await run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,?,?)',[image,u.id,privateImage?1:0,now()]);return image}
  async function checkedProduct(b){const v=validateProduct(b);for(const image of [v.imageUrl,...v.gallery,...v.options.colors.map(c=>c.imageUrl).filter(Boolean)])if(image.startsWith('/uploads/')&&!await one('SELECT path FROM uploads WHERE path=? AND private=0',[image]))throw fail(400,'عکس محصول در فضای آنلاین پیدا نشد.');if(v.options.videoUrl?.startsWith('/uploads/')&&!await one('SELECT path FROM uploads WHERE path=? AND private=0',[v.options.videoUrl]))throw fail(400,'ویدیو در فضای آنلاین پیدا نشد.');return v}

  const journalResponse=await require('./journal.cjs').route(req,{db,admin,body,json});if(journalResponse)return journalResponse;
  const recoveryResponse=await require('./account-recovery.cjs').route(req,{db,admin,body,json,passwordHash,userView});if(recoveryResponse)return recoveryResponse;
  const featureResponse=await require('./member-features.cjs').route(req,{db,auth,admin,body,json,products,saveImage,ctx});if(featureResponse)return featureResponse;
  const paymentResponse=await paymentRoute(req,{db,auth,admin,body,json,saveImage});if(paymentResponse)return paymentResponse;
  if(m==='GET'&&p==='/api/health')return json({ok:true,storage:'neon-postgres'});
  if(m==='GET'&&p==='/api/bootstrap'){const u=await getUser();return json({user:userView(u),setupRequired:!await one("SELECT id FROM users WHERE role='admin'"),setupEmail:OWNER,setupAllowed:!!ctx.allowSetup,state:u?await state(u.id):null,products:await products(),paymentSettings:await bankSettings(db),currency:'تومان',storage:'neon-postgres'})}
  if(m==='GET'&&p==='/api/products')return json({products:await products()});
  if(m==='POST'&&(p==='/api/setup'||p==='/api/register')){
    const b=await body(req),email=String(b.email||'').trim().toLowerCase(),name=text(b.name,100),phone=text(b.phone,40);checkPassword(b.password);
    if(!/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,30}$/.test(email)||!name||(p==='/api/register'&&!phone))throw fail(400,'نام، تلفن و ایمیل معتبر وارد کنید.');
    const hasAdmin=await one("SELECT id FROM users WHERE role='admin'");
    if(p==='/api/setup'){
      if(!ctx.allowSetup)throw fail(403,'حساب مدیر فقط از برنامهٔ محلی روی localhost ساخته می‌شود. راهنمای راه‌اندازی را ببینید.');
      if(email!==OWNER)throw fail(403,'ایمیل مدیر باید ایمیل مالک تعیین‌شده باشد.');if(hasAdmin)throw fail(409,'حساب مدیر قبلاً ساخته شده است.');
    }else{if(!hasAdmin)throw fail(409,'ابتدا مالک باید حساب مدیر را بسازد.');if(email===OWNER)throw fail(409,'این ایمیل برای حساب مالک رزرو شده است.');}
    if(await one('SELECT id FROM users WHERE email=?',[email]))throw fail(409,'این ایمیل قبلاً ثبت شده است.');
    const id=uuid(),pw=await passwordHash(b.password);await run('INSERT INTO users(id,email,name,password_hash,role,created_at,phone) VALUES(?,?,?,?,?,?,?)',[id,email,name,pw,p==='/api/setup'?'admin':'customer',now(),phone]);await run('INSERT INTO selections(user_id,cart,favorites) VALUES(?,?,?)',[id,'[]','[]']);
    return json({user:userView(await one('SELECT * FROM users WHERE id=?',[id]))},201,await createSession(id));
  }
  if(m==='POST'&&p==='/api/login'){
    const b=await body(req);checkPassword(b.password);const u=await one('SELECT * FROM users WHERE email=?',[String(b.email||'').trim().toLowerCase()]);
    let valid=false;if(u)valid=await passwordCheck(b.password,u.password_hash);else await scrypt(b.password,'dayamora-invalid-login',64);
    if(!u||!valid)throw fail(401,'ایمیل یا رمز عبور نادرست است.');return json({user:userView(u),state:await state(u.id)},200,await createSession(u.id));
  }
  if(m==='POST'&&p==='/api/logout'){const t=sessionToken(req);if(t)await run('DELETE FROM sessions WHERE token_hash=?',[hash(t)]);return json({ok:true},200,cookie('',url))}
  if(m==='GET'&&p==='/api/me'){const u=await auth();return json({user:userView(u),state:await state(u.id),points:await balance(u.id),orders:await orders(u.id),paymentSettings:await bankSettings(db),ledger:await all('SELECT delta,reason,created_at FROM points WHERE user_id=? ORDER BY created_at DESC',[u.id])})}
  if(m==='PUT'&&p==='/api/me'){const u=await auth(),b=await body(req),name=text(b.name,100);if(!name)throw fail(400,'نام را وارد کنید.');await run('UPDATE users SET name=?,phone=?,address=? WHERE id=?',[name,text(b.phone,40),text(b.address,1000),u.id]);return json({user:userView(await one('SELECT * FROM users WHERE id=?',[u.id]))})}
  if(m==='PUT'&&p==='/api/selections'){const u=await auth(),s=await selections(await body(req));await run('UPDATE selections SET cart=?,favorites=?,preferences=? WHERE user_id=?',[JSON.stringify(s.cart),JSON.stringify(s.favorites),JSON.stringify(s.preferences),u.id]);return json({ok:true,state:s})}
  if(m==='POST'&&p==='/api/orders'){
    const u=await auth(),b=await body(req),key=text(b.requestKey,80);if(!/^[a-zA-Z0-9-]{8,80}$/.test(key))throw fail(400,'شناسهٔ درخواست معتبر نیست.');
    const old=await one('SELECT id FROM orders WHERE user_id=? AND request_key=?',[u.id,key]);if(old)return json({id:old.id});
    if(!u.phone||!u.address)throw fail(400,'ابتدا شماره تماس و آدرس را در باشگاه تکمیل کنید.');
    const s=await selections(b);if(!s.cart.length)throw fail(400,'سبد خرید خالی است.');
    const items=[];for(const id of new Set(s.cart.map(c=>c.id))){const raw=await one('SELECT * FROM products WHERE id=? AND active=1',[id]);if(!raw)throw fail(409,'محصول دیگر فعال نیست.');const pr=view(raw),lines=s.cart.filter(c=>c.id===id);checkCart(pr,lines);for(const c of lines){const color=Catalog.color(pr,c.colorId);items.push({...c,...(color?{colorName:color.name,colorHex:color.hex}:{}),name:pr.name,price:pr.price,shippingFee:Number(pr.options?.shippingFee||0),imageUrl:Catalog.image({...pr,imageUrl:pr.image_url},c)})}}
    const bank=await bankSettings(db),payment=bank.enabled?{method:'bank-transfer',state:'awaiting_receipt',account:bank}:{};
    const id=uuid(),subtotal=items.reduce((n,c)=>n+c.price*c.qty,0);if(!Number.isSafeInteger(subtotal))throw fail(400,'مبلغ سبد بیش از حد مجاز است.');
    const coupon=await require('./coupons.cjs').quote(db,b.couponCode,u.id,subtotal),shippingTotal=items.reduce((n,c)=>n+c.shippingFee*c.qty,0),total=coupon.total+shippingTotal;if(!Number.isSafeInteger(total))throw fail(400,'مبلغ سفارش بیش از حد مجاز است.');payment.shippingTotal=shippingTotal;if(coupon.code)payment.coupon=coupon;
    await run('INSERT INTO orders(id,user_id,request_key,items,total,status,contact,created_at,payment) VALUES(?,?,?,?,?,?,?,?,?)',[id,u.id,key,JSON.stringify(items),total,'pending',JSON.stringify({name:u.name,phone:u.phone,address:u.address}),now(),JSON.stringify(payment)]);if(coupon.code)await run('INSERT INTO coupon_uses(order_id,user_id,code,discount) VALUES(?,?,?,?)',[id,u.id,coupon.code,coupon.discount]);await run('UPDATE selections SET cart=? WHERE user_id=?',['[]',u.id]);return json({id,status:'pending'},201);
  }
  if(m==='GET'&&/^\/api\/products\/\d+$/.test(p)){
    const id=Number(p.split('/').pop()),pr=(await products()).find(x=>x.id===id);if(!pr)throw fail(404,'محصول پیدا نشد.');const u=await getUser();
    return json({product:pr,reviews:await all('SELECT r.rating,r.body,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.hidden=0 ORDER BY r.created_at DESC',[id]),canReview:u?await eligible(u.id,id):false,myReview:u?await one('SELECT rating,body,hidden FROM reviews WHERE user_id=? AND product_id=?',[u.id,id])||null:null});
  }
  if(m==='POST'&&/^\/api\/products\/\d+\/reviews$/.test(p)){
    const u=await auth(),id=Number(p.split('/')[3]),b=await body(req),rating=Number(b.rating),comment=text(b.body,2000);if(!Number.isInteger(rating)||rating<1||rating>5||!comment)throw fail(400,'امتیاز و متن نظر را وارد کنید.');if(!await eligible(u.id,id))throw fail(403,'نظر فقط برای خریدار محصول در سفارش تکمیل‌شده فعال است.');
    await run('INSERT INTO reviews(id,user_id,product_id,rating,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,created_at=excluded.created_at',[uuid(),u.id,id,rating,comment,now()]);return json({ok:true});
  }
  if(m==='GET'&&p==='/api/closet'){
    const u=await auth();return json({wardrobe:await all('SELECT id,name,cat,image_url AS "imageUrl",created_at FROM wardrobe WHERE user_id=? ORDER BY created_at DESC',[u.id]),styles:(await all('SELECT id,name,product_ids,wardrobe_ids,created_at FROM styles WHERE user_id=? ORDER BY created_at DESC',[u.id])).map(r=>({...r,productIds:JSON.parse(r.product_ids),wardrobeIds:JSON.parse(r.wardrobe_ids)}))});
  }
  if(m==='POST'&&p==='/api/wardrobe'){
    const u=await auth(),b=await body(req),name=text(b.name,120),cat=text(b.cat,40);if(!name||!cat)throw fail(400,'نام و دسته را وارد کنید.');if((await one('SELECT COUNT(*) n FROM wardrobe WHERE user_id=?',[u.id])).n>=200)throw fail(400,'حداکثر ۲۰۰ آیتم قابل ذخیره است.');
    const imageUrl=await saveImage(b,true,u),id=uuid();await run('INSERT INTO wardrobe(id,user_id,name,cat,image_url,created_at) VALUES(?,?,?,?,?,?)',[id,u.id,name,cat,imageUrl,now()]);return json({id,imageUrl},201);
  }
  if(m==='DELETE'&&/^\/api\/wardrobe\/[a-f0-9-]+$/.test(p)){
    const u=await auth(),id=p.split('/').pop(),r=await one('SELECT * FROM wardrobe WHERE id=? AND user_id=?',[id,u.id]);if(!r)throw fail(404,'آیتم پیدا نشد.');
    await run('DELETE FROM wardrobe WHERE id=? AND user_id=?',[id,u.id]);await run('DELETE FROM uploads WHERE path=? AND user_id=?',[r.image_url,u.id]);ctx.afterCommit.push(()=>storage.remove(r.image_url));return json({ok:true});
  }
  if((m==='POST'&&p==='/api/styles')||(m==='PUT'&&/^\/api\/styles\/[a-f0-9-]+$/.test(p))){
    const u=await auth(),b=await body(req),name=text(b.name,120),pids=Array.isArray(b.productIds)?[...new Set(b.productIds.map(Number))]:[],wids=Array.isArray(b.wardrobeIds)?[...new Set(b.wardrobeIds.map(String))]:[];
    if(!name||pids.length+wids.length<1||pids.length+wids.length>20)throw fail(400,'نام و حداقل یک آیتم معتبر انتخاب کنید.');
    for(const id of pids)if(!Number.isSafeInteger(id)||!await one('SELECT id FROM products WHERE id=? AND active=1',[id]))throw fail(400,'محصول معتبر نیست.');
    for(const id of wids)if(!await one('SELECT id FROM wardrobe WHERE id=? AND user_id=?',[id,u.id]))throw fail(400,'آیتم کمد متعلق به شما نیست.');
    if(m==='POST'&&(await one('SELECT COUNT(*) n FROM styles WHERE user_id=?',[u.id])).n>=100)throw fail(400,'حداکثر ۱۰۰ استایل قابل ذخیره است.');
    const id=m==='PUT'?p.split('/').pop():uuid();if(m==='PUT'&&!await one('SELECT id FROM styles WHERE id=? AND user_id=?',[id,u.id]))throw fail(404,'استایل پیدا نشد.');
    if(m==='PUT')await run('UPDATE styles SET name=?,product_ids=?,wardrobe_ids=? WHERE id=? AND user_id=?',[name,JSON.stringify(pids),JSON.stringify(wids),id,u.id]);else await run('INSERT INTO styles(id,user_id,name,product_ids,wardrobe_ids,created_at) VALUES(?,?,?,?,?,?)',[id,u.id,name,JSON.stringify(pids),JSON.stringify(wids),now()]);return json({id},m==='PUT'?200:201);
  }
  if(m==='DELETE'&&/^\/api\/styles\/[a-f0-9-]+$/.test(p)){const u=await auth(),id=p.split('/').pop();if(!await one('SELECT id FROM styles WHERE id=? AND user_id=?',[id,u.id]))throw fail(404,'استایل پیدا نشد.');await run('DELETE FROM styles WHERE id=? AND user_id=?',[id,u.id]);return json({ok:true})}
  if(/^\/(private-uploads|uploads)\/[a-f0-9-]+\.(png|jpg|webp|mp4|webm)$/.test(p)&&['GET','HEAD'].includes(m)){
    const privateImage=p.startsWith('/private-uploads/');let u;if(privateImage)u=await auth();
    const image=await one('SELECT * FROM uploads WHERE path=?',[p]);const receiptAccess=privateImage&&u.role==='admin'&&(await one('SELECT path FROM receipt_files WHERE path=?',[p])||await one('SELECT id FROM community_posts WHERE image_url=?',[p]));if(!image||!!image.private!==privateImage||(privateImage&&image.user_id!==u.id&&!receiptAccess))throw fail(404,'عکس پیدا نشد.');
    const imageFile=await storage.download(p),video=/\.(mp4|webm)$/.test(p),mediaHeaders={...headers,'Content-Type':imageFile.type,'Cache-Control':privateImage?'private, no-store':'public, max-age=86400'};
    const bytes=Buffer.from(imageFile.bytes);if(video){mediaHeaders['Accept-Ranges']='bytes';const range=req.headers.get('range');if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...mediaHeaders,'Content-Range':'bytes */'+bytes.length}});const start=match[1]?Number(match[1]):Math.max(0,bytes.length-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1):bytes.length-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...mediaHeaders,'Content-Range':'bytes */'+bytes.length}});return new Response(m==='HEAD'?null:bytes.subarray(start,end+1),{status:206,headers:{...mediaHeaders,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}})}}
    return new Response(m==='HEAD'?null:bytes,{headers:{...mediaHeaders,'Content-Length':String(bytes.length)}});
  }
  if(p.startsWith('/api/admin/')){
    const a=await admin();
    if(m==='GET'&&p==='/api/admin/dashboard')return json({products:await products(true),customers:await all("SELECT u.id,u.email,u.name,u.phone,u.created_at,COALESCE((SELECT SUM(delta) FROM points WHERE user_id=u.id),0) points FROM users u WHERE u.role='customer' ORDER BY created_at DESC"),orders:(await all('SELECT o.*,u.email,u.name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC')).map(o=>({...o,items:JSON.parse(o.items),contact:JSON.parse(o.contact),payment:JSON.parse(o.payment||'{}')}))});
    if(m==='GET'&&p==='/api/admin/reviews')return json({reviews:await all('SELECT r.*,u.name,u.email,p.name AS product_name FROM reviews r JOIN users u ON r.user_id=u.id JOIN products p ON r.product_id=p.id ORDER BY r.created_at DESC')});
    if(m==='PUT'&&/^\/api\/admin\/reviews\/[a-f0-9-]+$/.test(p)){const id=p.split('/').pop(),b=await body(req);if(typeof b.hidden!=='boolean'||!await one('SELECT id FROM reviews WHERE id=?',[id]))throw fail(400,'نظر یا وضعیت معتبر نیست.');await run('UPDATE reviews SET hidden=? WHERE id=?',[b.hidden?1:0,id]);return json({ok:true})}
    if(m==='GET'&&/^\/api\/admin\/customers\/[a-f0-9-]+$/.test(p)){const id=p.split('/').pop(),u=await one("SELECT * FROM users WHERE id=? AND role='customer'",[id]);if(!u)throw fail(404,'مشتری پیدا نشد.');return json({user:userView(u),state:await state(id),points:await balance(id),orders:await orders(id),ledger:await all('SELECT delta,reason,created_at FROM points WHERE user_id=? ORDER BY created_at DESC',[id])})}
    if(m==='POST'&&p==='/api/admin/video'){const b=await body(req),videoUrl=await storage.uploadVideo(b.base64);await run('INSERT INTO uploads(path,user_id,private,created_at) VALUES(?,?,0,?)',[videoUrl,a.id,now()]);return json({videoUrl},201)}
    if(m==='POST'&&p==='/api/admin/upload')return json({imageUrl:await saveImage(await body(req),false,a)},201);
    if((m==='POST'&&p==='/api/admin/products')||(m==='PUT'&&/^\/api\/admin\/products\/\d+$/.test(p))){
      const submitted=await body(req);if(m==='PUT'&&submitted.options===undefined){const old=await one('SELECT options FROM products WHERE id=?',[Number(p.split('/').pop())]);if(old)submitted.options=JSON.parse(old.options||'{}')}const b=await checkedProduct(submitted),values=[b.name,b.brand,b.cat,b.price,b.stock,JSON.stringify(b.variants),b.imageUrl,b.description,b.active,JSON.stringify(b.gallery),b.comparePrice,JSON.stringify(b.options)];
      if(m==='POST'){const r=await one('INSERT INTO products(name,brand,cat,price,stock,variants,image_url,description,active,gallery,compare_price,options,is_sample) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0) RETURNING id',values);return json({id:r.id},201)}
      const id=Number(p.split('/').pop());if(!await one('SELECT id FROM products WHERE id=?',[id]))throw fail(404,'محصول پیدا نشد.');for(const o of await all("SELECT items FROM orders WHERE status='confirmed'"))for(const item of JSON.parse(o.items))if(item.id===id&&!Catalog.valid(b,item))throw fail(409,'رنگ یا سایز مورد استفاده در سفارش تأییدشده را نمی‌توان حذف کرد.');await run('UPDATE products SET name=?,brand=?,cat=?,price=?,stock=?,variants=?,image_url=?,description=?,active=?,gallery=?,compare_price=?,options=?,is_sample=0 WHERE id=?',[...values,id]);return json({ok:true});
    }
    if(m==='DELETE'&&/^\/api\/admin\/products\/\d+$/.test(p)){
      const id=Number(p.split('/').pop());
      const old=await one('SELECT * FROM products WHERE id=?',[id]);
      if(!old)throw fail(404,'محصول پیدا نشد.');
      // An open order still needs this product for stock and fulfillment.
      for(const o of await all("SELECT items FROM orders WHERE status IN ('pending','confirmed')")){
        if(JSON.parse(o.items).some(i=>Number(i.id)===id))throw fail(409,'این محصول سفارش باز دارد. ابتدا سفارش‌های در انتظار یا تأییدشده را تعیین تکلیف کنید.');
      }
      await run('DELETE FROM product_watches WHERE product_id=?',[id]);
      await run('DELETE FROM garment_cutouts WHERE product_id=?',[id]);
      await run('DELETE FROM reviews WHERE product_id=?',[id]);
      // Selections and styles store product IDs as JSON, not foreign keys.
      for(const r of await all('SELECT user_id,cart,favorites FROM selections')){
        const cart=JSON.parse(r.cart),favorites=JSON.parse(r.favorites);
        const updatedCart=cart.filter(x=>Number(x.id)!==id),updatedFavorites=favorites.filter(x=>Number(x)!==id);
        if(updatedCart.length!==cart.length||updatedFavorites.length!==favorites.length)
          await run('UPDATE selections SET cart=?,favorites=? WHERE user_id=?',[JSON.stringify(updatedCart),JSON.stringify(updatedFavorites),r.user_id]);
      }
      for(const r of await all('SELECT id,product_ids FROM styles')){
        const ids=JSON.parse(r.product_ids),remaining=ids.filter(x=>Number(x)!==id);
        if(remaining.length!==ids.length)await run('UPDATE styles SET product_ids=? WHERE id=?',[JSON.stringify(remaining),r.id]);
      }
      // Community posts may reference multiple products: keep posts but unlink deleted product.
      for(const r of await all('SELECT id,product_ids FROM community_posts')){
        const ids=JSON.parse(r.product_ids),remaining=ids.filter(x=>Number(x)!==id);
        if(remaining.length!==ids.length)await run('UPDATE community_posts SET product_ids=? WHERE id=?',[JSON.stringify(remaining),r.id]);
      }
      await run('DELETE FROM products WHERE id=?',[id]);
      // Keep completed/cancelled order snapshots as the financial history.
      // Remove only uploaded media no longer used by another product or user content.
      let opts={};try{opts=JSON.parse(old.options||'{}')}catch{}
      let gallery=[];try{gallery=JSON.parse(old.gallery||'[]')}catch{}
      const urls=[old.image_url,...gallery,...(opts.colors||[]).map(c=>c.imageUrl),opts.videoUrl].filter(v=>typeof v==='string'&&v.startsWith('/uploads/'));
      for(const path of new Set(urls)){
        const used=await one("SELECT id FROM products WHERE image_url=? OR gallery LIKE ? OR options LIKE ? LIMIT 1",[path,'%'+path+'%','%'+path+'%'])
          ||await one('SELECT id FROM wardrobe WHERE image_url=? LIMIT 1',[path])
          ||await one('SELECT id FROM community_posts WHERE image_url=? LIMIT 1',[path]);
        if(!used){await run('DELETE FROM uploads WHERE path=? AND private=0',[path]);ctx.afterCommit.push(()=>storage.remove(path));}
      }
      return json({ok:true});
    }
    if(m==='POST'&&p==='/api/admin/points'){
      const b=await body(req),delta=Number(b.delta),reason=text(b.reason,200);if(!Number.isInteger(delta)||!delta||Math.abs(delta)>100000||!reason||!await one("SELECT id FROM users WHERE id=? AND role='customer'",[b.userId]))throw fail(400,'مشتری، امتیاز و دلیل معتبر وارد کنید.');if(await balance(b.userId)+delta<0)throw fail(400,'ماندهٔ امتیاز نمی‌تواند منفی شود.');await run('INSERT INTO points(id,user_id,delta,reason,created_by,created_at) VALUES(?,?,?,?,?,?)',[uuid(),b.userId,delta,reason,a.id,now()]);return json({ok:true});
    }
    if(m==='PUT'&&/^\/api\/admin\/orders\/[a-f0-9-]+$/.test(p)){
      const id=p.split('/').pop(),b=await body(req),order=await one('SELECT * FROM orders WHERE id=?',[id]);if(!order)throw fail(404,'سفارش پیدا نشد.');const transitions={pending:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]};if(!Object.hasOwn(transitions,b.status))throw fail(400,'وضعیت معتبر نیست.');if(order.status===b.status)return json({ok:true});if(!transitions[order.status].includes(b.status))throw fail(409,'این تغییر وضعیت مجاز نیست.');const points=Number(b.points||0);if(!Number.isInteger(points)||points<0||points>100000)throw fail(400,'امتیاز معتبر وارد کنید.');
      const items=JSON.parse(order.items),payment=JSON.parse(order.payment||'{}');
      if(payment.method==='bank-transfer'&&b.status==='completed'&&payment.state!=='approved')throw fail(409,'ابتدا رسید و واریز واقعی را از بخش پرداخت تأیید کنید.');
      if(order.status==='pending'&&b.status==='confirmed')await changeInventory(db,items,-1);
      if(order.status==='confirmed'&&b.status==='cancelled')await changeInventory(db,items,1);
      await run('UPDATE orders SET status=?,completed_at=? WHERE id=?',[b.status,b.status==='completed'?now():null,id]);if(b.status==='completed'&&points>0)await run('INSERT INTO points(id,user_id,delta,reason,order_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)',[uuid(),order.user_id,points,'امتیاز سفارش تکمیل‌شده',id,a.id,now()]);return json({ok:true});
    }
  }
  throw fail(404,'مسیر پیدا نشد.');
}
async function handle(req,options={}){
  try{
    const url=new URL(req.url),write=!['GET','HEAD'].includes(req.method);
    if(write){if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)throw fail(403,'درخواست از مبدأ دیگر مجاز نیست.');if(req.headers.get('sec-fetch-site')==='cross-site')throw fail(403,'Cross-site request denied')}
    if(req.method==='POST'&&url.pathname==='/api/setup'&&!options.allowSetup)throw fail(403,'ساخت اولین حساب مدیر فقط از اجرای محلی مجاز است.');
    if(req.method==='POST'&&['/api/login','/api/setup','/api/register','/api/forgot-password','/api/reset-password'].includes(url.pathname))await rateLimit(options.ip||'unknown',url.pathname);
    if(req.method==='POST'&&url.pathname==='/api/forgot-password'){const b=await body(req.clone());await rateLimit(hash(String(b.email||'').trim().toLowerCase()),'password-recovery-email')}
    const ctx={...options,afterCommit:[]};const response=await withDatabase(write,db=>route(req,ctx,db));
    for(const fn of ctx.afterCommit)try{await fn()}catch{console.error('Deferred storage cleanup failed')}
    return response;
  }catch(e){
    if(e.diagnostic)console.error('Dayamora request failed:',JSON.stringify(e.diagnostic));
    else if(!e.status)console.error('Dayamora request failed:',e.code||e.name); // never log URLs or credentials
    const missing=e.code==='42P01'||e.code==='3F000';
    return json({error:missing?'فروشگاه در حال راه‌اندازی است؛ کمی بعد دوباره مراجعه کنید.':e.status?e.message:'ارتباط با سرور کامل نشد؛ دوباره امتحان کنید.'},missing?503:e.status||500);
  }
}
module.exports={handle,headers};
