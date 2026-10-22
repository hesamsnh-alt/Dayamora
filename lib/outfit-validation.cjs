'use strict';
const Core=require('../public/outfit-core.js');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
function validate(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.layers)||input.layers.length>16)fail(400,'حداکثر ۱۶ آیتم برای هر ست انتخاب کن.');
 const name=String(input.name||'').trim();if(!name||name.length>100)fail(400,'نام ست را بین ۱ تا ۱۰۰ کاراکتر وارد کن.');
 const layers=input.layers.map(l=>{if(!l||!['shop','wardrobe','demo'].includes(l.source)||!Core.safePath(l.image)||!Core.slots[l.slot])fail(400,'یکی از آیتم‌های ست معتبر نیست.');
  if(l.source==='shop'&&(!Number.isSafeInteger(Number(l.id))||Number(l.id)<1))fail(400,'شناسه محصول معتبر نیست.');
  for(const k of ['x','y','w','h','rotation','opacity'])if(typeof l[k]!=='number'||!Number.isFinite(l[k]))fail(400,'موقعیت آیتم معتبر نیست.');
  return Core.normalize({key:String(l.key||'').slice(0,80),source:l.source,id:l.source==='shop'?Number(l.id):String(l.id).slice(0,80),name:String(l.name||'').slice(0,160),brand:String(l.brand||'').slice(0,80),price:Math.max(0,Number(l.price)||0),slot:l.slot,image:l.image,x:l.x,y:l.y,w:l.w,h:l.h,rotation:l.rotation,opacity:l.opacity,flip:!!l.flip,visible:l.visible!==false,variant:String(l.variant||'').slice(0,80),colorId:String(l.colorId||'').slice(0,80),colorName:String(l.colorName||'').slice(0,80),demo:l.source==='demo'});
 });
 if(new Set(layers.map(l=>l.key)).size!==layers.length)fail(400,'شناسه لایه‌ها تکراری است.');
 const snapshot=input.snapshot||'';if(snapshot&&!Core.safePath(snapshot))fail(400,'تصویر ست معتبر نیست.');
 return{version:1,name,layers,background:['ivory','rose','sage','ink'].includes(input.background)?input.background:'ivory',view:input.view==='board'?'board':'mannequin',snapshot};
}
module.exports={validate,fail};
