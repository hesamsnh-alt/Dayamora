'use strict';
const crypto=require('node:crypto'),{fail,text,checkPassword}=require('./validation.cjs');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const uuidOK=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
const emailValue=v=>{const e=String(v||'').trim().toLowerCase();if(!/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,30}$/.test(e))throw fail(400,'ایمیل معتبر وارد کنید.');return e};
function siteOrigin(){let u;try{u=new URL(process.env.DAYAMORA_SITE_URL||'https://dayamora.netlify.app')}catch{throw fail(503,'آدرس فروشگاه برای بازیابی تنظیم نشده است.')}if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw fail(503,'آدرس فروشگاه برای بازیابی معتبر نیست.');return u.origin}
function mailReady(){return !!(process.env.RESEND_API_KEY&&process.env.DAYAMORA_MAIL_FROM)}
async function sendMail(email,link){
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({from:process.env.DAYAMORA_MAIL_FROM,to:[email],subject:'تعیین رمز دایامورا',text:'برای تعیین رمز جدید دایامورا این لینک را باز کنید. لینک یک‌بارمصرف و تا ۳۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.\n\n'+link})});if(!r.ok)throw Error();const data=await r.json();if(!data.id)throw Error()}catch{throw fail(503,'ارسال ایمیل انجام نشد. کمی بعد دوباره تلاش کنید یا با فروشگاه تماس بگیرید.')}
}
async function route(req,c){
 const path=new URL(req.url).pathname;if(!['/api/forgot-password','/api/reset-password','/api/admin/accounts','/api/admin/accounts/recovery-status'].includes(path)&&!/^\/api\/admin\/accounts\/[a-f0-9-]+\/reset-link$/.test(path))return null;
 const {db,admin,body,json,passwordHash,userView}=c;
 const key=id=>'password-reset:'+id;
 async function issue(u){const token=crypto.randomBytes(32).toString('hex'),expiresAt=Date.now()+1800000;await db.run('INSERT INTO shop_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key(u.id),JSON.stringify({hash:digest(token),expiresAt,passwordVersion:digest(u.password_hash)})]);return{url:siteOrigin()+'/reset-password.html#'+u.id+'.'+token,expiresAt}}
 if(path.startsWith('/api/admin/')){
  await admin();
  if(path.endsWith('/recovery-status')&&req.method==='GET')return json({emailConfigured:mailReady()});
  if(path==='/api/admin/accounts'&&req.method==='POST'){
   const b=await body(req),email=emailValue(b.email),name=text(b.name,100)||'عضو دایامورا';if(email==='hesamsnh@gmail.com'||await db.one('SELECT id FROM users WHERE email=?',[email]))throw fail(409,'این ایمیل قبلاً ثبت شده یا برای مالک رزرو است.');
   const id=crypto.randomUUID(),pw=await passwordHash(crypto.randomBytes(48).toString('hex'));
   await db.run("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)",[id,email,name,pw,'customer',Date.now()]);await db.run('INSERT INTO selections(user_id,cart,favorites) VALUES(?,?,?)',[id,'[]','[]']);const u=await db.one('SELECT * FROM users WHERE id=?',[id]);return json({user:userView(u),reset:await issue(u)},201);
  }
  if(req.method==='POST'&&path.endsWith('/reset-link')){const id=path.split('/')[4];if(!uuidOK(id))throw fail(400,'شناسه معتبر نیست.');const u=await db.one("SELECT * FROM users WHERE id=? AND role='customer'",[id]);if(!u)throw fail(404,'مشتری پیدا نشد.');return json({reset:await issue(u)})}
  throw fail(405,'روش درخواست مجاز نیست.');
 }
 if(req.method!=='POST')throw fail(405,'روش درخواست مجاز نیست.');
 const b=await body(req);
 if(path==='/api/forgot-password'){
  const email=emailValue(b.email);if(!mailReady())throw fail(503,'بازیابی با ایمیل هنوز توسط فروشگاه تنظیم نشده است. برای دریافت لینک بازیابی با فروشگاه تماس بگیرید.');
  const u=await db.one('SELECT * FROM users WHERE email=?',[email]);if(u){const r=await issue(u);await sendMail(email,r.url)}return json({ok:true,message:'اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال می‌شود. پوشه اسپم را هم بررسی کنید.'});
 }
 checkPassword(b.password);if(!uuidOK(b.userId)||typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))throw fail(400,'لینک بازیابی نامعتبر است.');
 const row=await db.one('SELECT value FROM shop_settings WHERE key=?',[key(b.userId)]),u=await db.one('SELECT * FROM users WHERE id=?',[b.userId]);let r;try{r=JSON.parse(row?.value||'null')}catch{}
 if(!r||!u||r.expiresAt<=Date.now()||r.passwordVersion!==digest(u.password_hash)||!crypto.timingSafeEqual(Buffer.from(r.hash,'hex'),Buffer.from(digest(b.token),'hex')))throw fail(400,'لینک بازیابی نامعتبر یا منقضی شده است. لینک جدید درخواست کنید.');
 const pw=await passwordHash(b.password),claimed=await db.all('DELETE FROM shop_settings WHERE key=? AND value=? RETURNING key',[key(u.id),row.value]);if(!claimed.length)throw fail(409,'لینک قبلاً استفاده شده است.');
 await db.run('UPDATE users SET password_hash=? WHERE id=?',[pw,u.id]);await db.run('DELETE FROM sessions WHERE user_id=?',[u.id]);return json({ok:true});
}
module.exports={route,mailReady,siteOrigin};
