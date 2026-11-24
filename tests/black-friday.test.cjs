'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),B=require('../lib/black-friday.cjs'),S=require('../lib/seo.cjs');
test('Campaign prices reduce the current selling price without mutating USD/FX, admin, original or shipping data',()=>{
 const p={id:1,active:true,name:'محصول',cat:'زیبایی',price:100000,comparePrice:130000,stock:2,imageUrl:'/assets/bag.webp',options:{shippingFee:10000}};
 const result=B.priceProduct(p,B.ENDS_AT-1);A.equal(result.price,92000);A.equal(result.comparePrice,100000);A.equal(p.price,100000);A.equal(p.comparePrice,130000);
 A.equal(result.options.shippingFee,10000);A.equal(B.priceProduct(p,B.ENDS_AT),p);A.equal(B.priceProduct({...p,isSample:true},B.ENDS_AT-1).price,100000);
 A.equal(S.productMeta(result).schema['@graph'][0].offers.price,'920000');A.match(S.productBody(result),/۸٪ تخفیف بلک‌فرایدی/);
});
test('First visit plays once, supports dismissal and removes the overlay after failed or stalled playback',async()=>{
 const callbacks={},key=new Map(),timers=new Map();let count=0,paused=0,play=0;
 const intro={hidden:true,querySelector:s=>s==='video'?video:skip},video={play:()=>{play++;return Promise.resolve()},pause:()=>paused++,addEventListener:(e,f)=>callbacks[e]=f},skip={addEventListener:(e,f)=>callbacks.skip=f};
 const context={document:{getElementById:()=>intro},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>key.get(k),setItem:(k,v)=>key.set(k,v)},setTimeout:(fn,ms)=>{A.ok(ms<=2000);timers.set(++count,fn);return count},clearTimeout:i=>timers.delete(i),addEventListener(){}};
 const script=fs.readFileSync(require.resolve('../public/intro-loader.js'),'utf8');
 vm.runInNewContext(script,context);A.equal(intro.hidden,false);A.equal(play,1);callbacks.skip();A.equal(intro.hidden,true);vm.runInNewContext(script,context);A.equal(play,1);
 key.clear();vm.runInNewContext(script,context);[...timers.values()][0]();A.equal(intro.hidden,true);A.equal(paused,2);
 key.clear();video.play=()=>Promise.reject(Error('Autoplay denied'));vm.runInNewContext(script,context);await Promise.resolve();await Promise.resolve();A.equal(intro.hidden,true);
});
