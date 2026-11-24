'use strict';
const ENDS_AT=Date.parse('2026-11-28T00:00:00+04:00');
const PERCENT=8;
const LABEL='۸٪ تخفیف بلک‌فرایدی';
function priceProduct(product,at=Date.now()){
 const base=Number(product.price);
 if(at>=ENDS_AT||product.active===false||product.active===0||product.isSample||product.is_sample||!Number.isSafeInteger(base)||base<=0||base>1e12)return product;
 const price=Math.max(1,Math.round(base*(100-PERCENT)/100));
 if(price>=base)return product;
 return {...product,price,comparePrice:base,blackFriday:{percent:PERCENT,endsAt:ENDS_AT}};
}
module.exports={ENDS_AT,PERCENT,LABEL,priceProduct};
