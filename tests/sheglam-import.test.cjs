'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {extract}=require('../lib/product-import-preview.cjs');
const html=fs.readFileSync(path.join(__dirname,'fixtures/sheglam-shades.html'),'utf8');
const url='https://www.sheglam.com/product/Color-Bloom-Liquid-Blush-Matte-Finish-Swipe-Right-6885879218341';
function changed(fn){return html.replace(/(<script id="__NEXT_DATA__" type="application\/json">)([\s\S]*?)(<\/script>)/,(all,start,body,end)=>{const d=JSON.parse(body);fn(d.props.pageProps);return start+JSON.stringify(d)+end})}
test('SHEGLAM imports all 15 source shades instead of only selected JSON-LD colour',()=>{
 const r=extract(html,url);assert.equal(r.provider,'SHEGLAM');assert.equal(r.colors.length,15);assert.equal(r.colorVariants.length,15);assert.equal(r.colors[0],'Swipe Right');assert(r.colors.includes('Hot Topic'));assert(r.colors.includes('Night Drive'));
 assert(r.colorVariants.every(c=>c.images.length));assert(r.images.length>15);assert(r.images.every(v=>v.startsWith('https://')));assert(!r.images.some(v=>/\.gif$/i.test(v)));assert.equal(r.sourcePrice,'5.99');assert.equal(r.sourceCurrency,'USD');
});
test('SHEGLAM associates the sibling product photo with its own shade, not the selected gallery',()=>{
 const r=extract(html,url),hot=r.colorVariants.find(c=>c.name==='Hot Topic'),current=r.colorVariants.find(c=>c.name==='Swipe Right');
 assert(hot.images[0].includes('1783584498024b362f27b72986df465d8c24e9320a'));assert(!hot.images.includes(current.images[0]));assert(r.images.includes(hot.images[0]));
});
test('SHEGLAM ignores recommendations, reviews, wrong product ids and foreign hosts',()=>{
 const content=changed(p=>{p.recommendations={goodsInfo:{goods_name:'Unrelated',color_infos:[{color_name:'INJECTED',picture:'https://example.com/wrong.jpg'}]}};p.reviewData={comment_content_list:[{product_color:'REVIEW COLOUR',comment_image_list:['https://example.com/review.jpg']}]}});
 assert.deepEqual(extract(content,url).colors,extract(html,url).colors);
 assert.notEqual(extract(html,url.replace('6885879218341','9999999999999')).provider,'SHEGLAM');
 for(const host of ['www.amazon.ae','www.noon.com','sheglam.com.example.org'])assert.notEqual(extract(html,url.replace('www.sheglam.com',host)).provider,'SHEGLAM');
});
test('SHEGLAM also reads mobile locale URLs and color_infos-only data safely',()=>{
 const content=changed(p=>{p.goodsInfo.main_sale_attr={};p.goodsInfo.color_infos.push({color_name:'Unsafe',picture:'http://example.com/wrong.jpg'});p.goodsInfo.image_list.push('javascript:alert(1)')});
 const r=extract(content,url.replace('www.sheglam.com/product','m.sheglam.com/en/product'));assert.equal(r.provider,'SHEGLAM');assert.equal(r.colorVariants.find(c=>c.name==='Unsafe').images.length,0);assert(!r.images.some(v=>/javascript:|example\.com/.test(v)));
});
test('SHEGLAM keeps the existing 20-colour capacity explicit and never fabricates stock',()=>{
 const r=extract(changed(p=>{p.goodsInfo.main_sale_attr={};p.goodsInfo.color_infos=Array.from({length:25},(_,i)=>({color_name:'Shade '+i,picture:'https://img.ltwebstatic.com/example-'+i+'.jpg'}))}),url);
 assert.equal(r.colors.length,20);assert(r.warnings.some(w=>w.includes('۲۰')));assert(r.colorVariants.every(c=>!Object.hasOwn(c,'stock')));
});
test('invalid SHEGLAM scripts are data only and never executed',()=>{
 const source=html.replace(/<script id="__NEXT_DATA__" type="application\/json">[\s\S]*?<\/script>/,'<script id="__NEXT_DATA__" type="application/json">globalThis.SHEGLAM_EXECUTED=true</script>');
 const r=extract(source,url);assert.notEqual(r.provider,'SHEGLAM');assert.equal(globalThis.SHEGLAM_EXECUTED,undefined);
});
