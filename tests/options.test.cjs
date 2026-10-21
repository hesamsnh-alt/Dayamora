'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProduct}=require('../lib/validation.cjs'),{validateBank}=require('../lib/options-validation.cjs'),{adjust,checkCart}=require('../lib/inventory.cjs'),Catalog=require('../public/catalog-options.js');
const product=()=>validateProduct({name:'لباس',brand:'Daya',cat:'پوشاک',price:100,stock:0,variants:['S','M'],imageUrl:'/assets/blazer.webp',options:{colors:[{id:'red',name:'قرمز',hex:'#ff0000',stock:{S:2,M:0}},{id:'blue',name:'آبی',hex:'#0000ff',stock:{S:1,M:3}}],sizeGuide:{body:[{size:'S',bust:'82-86',upperBust:'78-82',height:'160-165'}]},videoUrl:'https://media.example.test/intro.mp4'}});
test('Color inventory is derived and isolated per size; confirmation/cancellation reverses exact quantities',()=>{
 const p={id:1,...product()},items=[{id:1,variant:'S',colorId:'red',qty:1},{id:1,variant:'S',colorId:'blue',qty:1}];assert.equal(p.stock,6);assert.equal(p.options.sizeGuide.body[0].upperBust,'78-82');assert.equal(p.options.sizeGuide.body[0].height,'160-165');assert.notEqual(Catalog.key(items[0]),Catalog.key(items[1]));
 const reserved=adjust(structuredClone(p),items,-1);assert.equal(reserved.stock,4);assert.equal(reserved.options.colors[0].stock.S,1);assert.equal(reserved.options.colors[1].stock.S,0);
 const restored=adjust(reserved,items,1);assert.deepEqual(restored,p);
 assert.throws(()=>checkCart(p,[{id:1,variant:'M',colorId:'red',qty:1}]),{status:409});
 assert.throws(()=>checkCart(p,[{id:1,variant:'S',colorId:'red',qty:2},{id:1,variant:'S',colorId:'red',qty:1}]),{status:409});
 assert.throws(()=>checkCart(p,[{id:1,variant:'S',colorId:'forged',qty:1}]),{status:409});
});
test('Options reject duplicate colors, unknown sizes, unsafe media and non-clothing size charts',()=>{
 const p=product(),base={name:p.name,brand:p.brand,cat:p.cat,price:p.price,stock:p.stock,variants:p.variants,imageUrl:p.imageUrl};
 for(const options of [
  {...p.options,colors:[p.options.colors[0],p.options.colors[0]]},
  {...p.options,colors:[{...p.options.colors[0],hex:'red; color: red'}]},
  {...p.options,colors:[{...p.options.colors[0],stock:{S:-1}}]},
  {...p.options,colors:[{...p.options.colors[0],stock:{XL:1}}]},
  {...p.options,sizeGuide:{body:[{size:'XL',bust:'90'}]}},
  {...p.options,videoUrl:'javascript:alert(1)'},
  {...p.options,videoUrl:'https://user:secret@example.test/intro.mp4'}
 ])assert.throws(()=>validateProduct({...base,options}),{status:400});
 assert.throws(()=>validateProduct({...base,cat:'کیف',options:p.options}),{status:400});
});
test('Legacy products keep shared stock; color products cannot bypass selection or color limits',()=>{
 const legacy={id:2,stock:3,variants:['default']};assert.ok(Catalog.canAdd(legacy,[],{id:2,variant:'default'},2));assert.ok(!Catalog.canAdd(legacy,[{id:2,variant:'default',qty:2}],{id:2,variant:'default'},2));
 const p={id:1,...product()};assert.ok(!Catalog.canAdd(p,[],{id:1,variant:'S'},1));assert.ok(!Catalog.canAdd(p,[],{id:1,variant:'M',colorId:'red'},1));
 assert.equal(Catalog.label(p,{variant:'M',colorId:'blue'}),'M · آبی');
});
test('Iranian IBAN checksum and account holder are required before enabling bank transfers',()=>{
 assert.throws(()=>validateBank({enabled:true,iban:'IR000000000000000000000000',holder:'نام',bank:'بانک'}),{status:400});
 assert.throws(()=>validateBank({enabled:true}),{status:400});assert.equal(validateBank({enabled:false}).enabled,false);
});
