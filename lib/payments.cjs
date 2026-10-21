'use strict';
const {fail,text}=require('./validation.cjs'),{validateBank}=require('./options-validation.cjs'),{view,adjust}=require('./inventory.cjs');
const readPayment=o=>JSON.parse(o.payment||'{}');
async function bankSettings(db){const row=await db.one("SELECT value FROM shop_settings WHERE key='bank-transfer'");return row?JSON.parse(row.value):{enabled:false,iban:'',holder:'',bank:'',instructions:''}}
async function changeInventory(db,items,direction){
 const ids=[...new Set(items.map(c=>c.id))];
 for(const id of ids){const raw=await db.one('SELECT * FROM products WHERE id=?',[id]);if(!raw||(direction===-1&&!raw.active))throw fail(409,'محصول دیگر قابل سفارش نیست.');const p=adjust(view(raw),items.filter(c=>c.id===id),direction);await db.run('UPDATE products SET stock=?,options=? WHERE id=?',[p.stock,JSON.stringify(p.options),id])}
}
async function paymentRoute(req,c){
 const path=new URL(req.url).pathname,m=req.method,{db,auth,admin,body,json,saveImage}=c;
 if(path==='/api/payment-settings'&&m==='GET')return json(await bankSettings(db));
 if(path==='/api/admin/payment-settings'&&m==='PUT'){
   await admin();const settings=validateBank(await body(req));await db.run("INSERT INTO shop_settings(key,value) VALUES('bank-transfer',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(settings)]);return json(settings);
 }
 if(/^\/api\/orders\/[a-f0-9-]+\/receipt$/.test(path)&&m==='POST'){
   const u=await auth(),id=path.split('/')[3],order=await db.one('SELECT * FROM orders WHERE id=? AND user_id=?',[id,u.id]);if(!order)throw fail(404,'سفارش پیدا نشد.');
   if(order.status!=='confirmed')throw fail(409,'ابتدا فروشگاه باید موجودی و سفارش را تأیید کند.');
   const previous=readPayment(order);if(previous.state==='approved')throw fail(409,'پرداخت این سفارش قبلاً تأیید شده است.');
   if(previous.state==='review')throw fail(409,'رسید قبلی در انتظار بررسی است.');
   const bank=previous.account||await bankSettings(db);if(!bank.iban||(!previous.account&&!bank.enabled))throw fail(409,'اطلاعات واریز هنوز توسط فروشگاه فعال نشده است.');
   const count=await db.one('SELECT COUNT(*) n FROM receipt_files WHERE order_id=?',[id]);if(Number(count.n)>=5)throw fail(409,'برای رسید جدید با فروشگاه هماهنگ کنید. حداکثر پنج بار ارسال مجاز است.');
   const b=await body(req),reference=text(b.reference,100);if(!reference)throw fail(400,'شماره پیگیری واریز را وارد کنید.');
   const receiptUrl=await saveImage(b,true,u);await db.run('INSERT INTO receipt_files(path,order_id,user_id) VALUES(?,?,?)',[receiptUrl,id,u.id]);
   const payment={method:'bank-transfer',state:'review',account:bank,receiptUrl,reference,note:text(b.note,1000),submittedAt:Date.now(),reviewNote:''};
   await db.run('UPDATE orders SET payment=? WHERE id=?',[JSON.stringify(payment),id]);return json({ok:true,payment},201);
 }
 if(/^\/api\/admin\/orders\/[a-f0-9-]+\/payment$/.test(path)&&m==='PUT'){
   const a=await admin(),id=path.split('/')[4],b=await body(req),order=await db.one('SELECT * FROM orders WHERE id=?',[id]);if(!order)throw fail(404,'سفارش پیدا نشد.');
   if(!['approved','rejected'].includes(b.decision)||!['pending','confirmed'].includes(order.status))throw fail(409,'بررسی پرداخت برای این وضعیت مجاز نیست.');
   const payment=readPayment(order);if(payment.state===b.decision)return json({ok:true});
   if(payment.state!=='review'||!payment.receiptUrl)throw fail(409,'ابتدا مشتری باید رسید پرداخت را ارسال کند.');
   if(b.decision==='rejected'&&!text(b.note,1000))throw fail(400,'علت رد رسید را بنویسید.');
   if(b.decision==='approved'&&order.status==='pending')await changeInventory(db,JSON.parse(order.items),-1);
   Object.assign(payment,{state:b.decision,reviewNote:text(b.note,1000),reviewedAt:Date.now(),reviewedBy:a.id});
   await db.run('UPDATE orders SET payment=?,status=? WHERE id=?',[JSON.stringify(payment),b.decision==='approved'?'confirmed':order.status,id]);return json({ok:true});
 }
 return null;
}
module.exports={paymentRoute,bankSettings,changeInventory};
