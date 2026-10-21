'use strict';
const Catalog=require('../public/catalog-options.js');
const {fail}=require('./validation.cjs');
function view(row){return{...row,variants:typeof row.variants==='string'?JSON.parse(row.variants):row.variants,options:typeof row.options==='string'?JSON.parse(row.options):row.options||{}}}
function checkCart(pr,items){
 const p=view(pr),groups=new Map();let total=0;
 for(const c of items){if(!Catalog.valid(p,c))throw fail(409,'رنگ یا سایز محصول تغییر کرده است؛ دوباره انتخاب کنید.');total+=c.qty;const k=Catalog.key(c);groups.set(k,{...c,qty:(groups.get(k)?.qty||0)+c.qty})}
 if(total>p.stock||[...groups.values()].some(c=>c.qty>Catalog.stock(p,c.variant,c.colorId)))throw fail(409,'موجودی رنگ یا سایز انتخاب‌شده کافی نیست.');
}
function adjust(pr,items,direction){
 const p=view(pr);if(direction===-1)checkCart(p,items);
 if(Catalog.colors(p).length){for(const c of items){const color=Catalog.color(p,c.colorId);if(!color||!p.variants.includes(c.variant))throw fail(409,'گزینهٔ سفارش دیگر وجود ندارد؛ ابتدا رنگ و سایز محصول را برگردانید.');color.stock[c.variant]=(color.stock[c.variant]||0)+direction*c.qty}}
 p.stock+=direction*items.reduce((s,c)=>s+c.qty,0);return p;
}
module.exports={view,checkCart,adjust};
