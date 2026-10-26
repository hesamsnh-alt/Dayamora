'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),{deflateSync}=require('node:zlib');
const C=require('../public/catalog-options.js'),Fit=require('../public/size-fit.js'),Mask=require('../public/boutique-mask.js'),Cutout=require('../public/boutique-cutout.js'),{validateOptions}=require('../lib/options-validation.cjs');
const p={name:'بلوز زنانه',cat:'پوشاک',variants:['XS','S','M','L','XL','XXL','3XL'],options:{}};
test('Existing and new clothing get only the supplied body defaults on actual offered sizes; unknown measurements remain absent',()=>{
 const g=C.sizeGuide(p);A.deepEqual(g.body.find(r=>r.size==='L'),{size:'L',waist:'75-81',hips:'100-106',height:'175-180'});A.equal(g.body.length,4);A.equal(g.body[0].bust,undefined);A.equal(g.garment,undefined);A.deepEqual(p.options,{});
 for(const cat of ['کفش','کیف','زیبایی'])A.deepEqual(C.sizeGuide({...p,cat}),{});
 A.equal(C.sizeGuide({...p,name:'بلوز کودک'}).fit.length,0);A.equal(C.sizeGuide({...p,variants:['Free Size','36']}).fit.length,0);
});
test('Published indicative women weight bands preserve size aliases; height does not arbitrarily turn a tall slim person XL',()=>{
 const g=C.sizeGuide(p);A.deepEqual(Fit.recommend(g.fit,p.variants,165,60).sizes,['M']);A.deepEqual(Fit.recommend(g.fit,p.variants,175,60).sizes,['M']);A.deepEqual(Fit.recommend(g.fit,p.variants,157,67).sizes,['L']);A.deepEqual(Fit.recommend(g.fit,p.variants,165,85).sizes,['XXL']);A.equal(Fit.recommend(g.fit,p.variants,180,60).status,'outside');A.equal(Fit.recommend(g.fit,p.variants,165,120).status,'outside');
});
test('Saved product measurements, fit rules, notes and garment tables are not overwritten by presets',()=>{
 const guide={body:[{size:'M',waist:'90',bust:'100'}],garment:[{size:'M',length:'62'}],fit:[{size:'M',heightMin:155,heightMax:180,weightMin:70,weightMax:80}],note:'Custom'};
 const result=C.sizeGuide({...p,options:{sizeGuide:guide}});A.deepEqual(result.body.find(r=>r.size==='M'),guide.body[0]);A.deepEqual(result.fit.find(r=>r.size==='M'),guide.fit[0]);A.deepEqual(result.garment,guide.garment);A.equal(result.note,'Custom');A.equal(guide.body.length,1);
});
test('Deliberately cleared defaults persist as empty rows and remain disabled after server validation and reopen',()=>{
 const guide={body:[{size:'M',waist:'',hips:'',height:''}],fit:[{size:'M',heightMin:'',heightMax:'',weightMin:'',weightMax:''}]};
 const saved=validateOptions({sizeGuide:guide},['M'],'پوشاک'),again=C.sizeGuide({...p,variants:['M'],options:saved});A.equal(again.body[0].waist,'');A.equal(Fit.recommend(again.fit,['M'],165,60).status,'missing');
 A.throws(()=>validateOptions({sizeGuide:{fit:[{size:'M',heightMin:160}]}},['M'],'پوشاک'),{status:400});
});
test('Soft segmentation retains uncertainty, rejects other semantic classes and penalizes flip-only stray detections',()=>{
 const logits=Float32Array.from([4,0,0,4]),r=Mask.semantic(logits,2,2,1,[0]);A.ok(r.prob[0]>.9&&r.prob[0]<1);A.ok(r.prob[1]<.1);
 const c=Mask.consensus(Float32Array.of(1,.9),Float32Array.of(.9,0),2,1);A.equal(c[0],.125);A.ok(c[1]>.89&&c[1]<.91);
});
test('Fragment cleanup keeps one garment or two shoes, removes detached crumbs, preserves the main silhouette, rejects torn masks',()=>{
 const w=80,h=80,a=new Float32Array(w*h);for(let y=10;y<70;y++)for(let x=20;x<60;x++)a[y*w+x]=.95;a[0]=1;const out=Mask.clean(a,w,h);A.equal(out[0],0);A.ok(out[40*w+40]>.94);A.equal(a[0],1);
 const pair=new Float32Array(w*h);for(let y=20;y<60;y++)for(const [l,r]of [[5,25],[50,70]])for(let x=l;x<r;x++)pair[y*w+x]=1;A.throws(()=>Mask.clean(pair,w,h));A.equal(Mask.clean(pair,w,h,true)[30*w+55],1);
});
test('Quality marker is valid PNG ancillary metadata and roundtrips through the unchanged server PNG validator',()=>{
 const {crc32,validatePng}=require('../lib/cutout-png.cjs'),w=96,h=120,raw=Buffer.alloc((w*4+1)*h);
 for(let y=15;y<100;y++)for(let x=20;x<76;x++){if(y<30&&(x<30||x>66))continue;const i=y*(w*4+1)+1+x*4;raw[i]=230;raw[i+1]=100;raw[i+2]=140;raw[i+3]=255;}
 const chunk=(type,data)=>{const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);};
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=6;const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
 A.equal(Cutout.version(bytes),0);const stamped=Cutout.stamp(bytes);A.equal(Cutout.version(stamped),2);A.deepEqual(validatePng('data:image/png;base64,'+Buffer.from(stamped).toString('base64')),{w,h});A.equal(Cutout.version(new Uint8Array(12)),0);
});
test('Quality path remains exclusive to boutique, rebuilds old uploads, never invokes paid APIs and persists the normalized PNG',()=>{
 const worker=fs.readFileSync(require.resolve('../public/garment-worker.js'),'utf8'),segment=fs.readFileSync(require.resolve('../public/boutique-segment.js'),'utf8'),prepare=fs.readFileSync(require.resolve('../public/boutique-prepare.js'),'utf8'),ui=fs.readFileSync(require.resolve('../public/boutique.js'),'utf8');
 A.match(worker,/if\(boutique\)importScripts/);A.match(worker,/else\{alpha=GarmentMask.cleanComponents/);A.match(segment,/garment-worker.js\?boutique=1/);A.match(prepare,/base64:preview.data/);A.match(ui,/image.qualityVersion<BoutiqueCutout.QUALITY/);A.ok(!/openai|OPENAI|api_key/i.test(worker+prepare));
});
