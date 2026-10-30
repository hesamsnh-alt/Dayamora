'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),https=require('node:https'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{Transform}=require('node:stream');
const M=require('../public/garment-mask.js'),Q=require('../public/boutique-mask.js'),Cut=require('../public/boutique-cutout.js');
const MODELS={
 schp:{size:69141996,url:'https://huggingface.co/pirocheto/schp-atr-18/resolve/61f4ff3c508b899904e495cefbbaff9cacadeb45/onnx/schp-atr-18-int8-static.onnx',sha:'4420d8db8c1f266967c89485786b01209f6d405f320fc0f87e8ced49392cefb5'},
 cloth:{size:176194565,url:'https://huggingface.co/jellybox/u2net-cloth-seg/resolve/9af020d2cba3eadca33202dafb65f3d647b01ffc/u2net-cloth-seg_768.onnx',sha:'6d2cbc27bfbdc989e1fd325656d65902ecc6a3ccbe94b2d3655ec114efcb128e'},
 object:{size:4574861,url:'https://huggingface.co/edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx',sha:'309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'}
};
const modelPaths=new Map(),folder=path.join(os.tmpdir(),'dayamora-boutique-models-v1');
const failure=(code,message)=>Object.assign(Error(message),{code});
function kind(p){const n=String(p.name||'');if(/(?:ست|set).*(?:دو تکه|two.piece|2.piece)/i.test(n))return'set';if(/هودی|سویشرت|ژاکت|کاپشن|hoodie|sweatshirt/i.test(n))return'top';return M.guess(p)}
function spec(type){return type==='set'?{ids:[4,5,6,7],cloth:[1,2,3],pair:true}:M.types[type]}
function request(url,depth=0){return new Promise((resolve,reject)=>{
 const u=new URL(url);if(depth>6||u.protocol!=='https:'||u.username||u.password||!(u.hostname==='huggingface.co'||u.hostname.endsWith('.huggingface.co')||u.hostname.endsWith('.hf.co')))return reject(failure('MODEL_UNAVAILABLE','Model redirect not allowed'));
 const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;
 const req=https.get(u,{agent:proxy?new(require('https-proxy-agent').HttpsProxyAgent)(proxy):undefined},res=>{if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();request(new URL(res.headers.location,u).href,depth+1).then(resolve,reject)}else if(res.statusCode!==200){res.resume();reject(failure('MODEL_UNAVAILABLE','Model download failed'))}else resolve(res)});
 req.setTimeout(30000,()=>req.destroy(failure('MODEL_UNAVAILABLE','Model download timed out')));req.on('error',reject);
 });}
async function modelFile(name){
 if(modelPaths.has(name))return modelPaths.get(name);const m=MODELS[name];await fsp.mkdir(folder,{recursive:true});const dest=path.join(folder,m.sha+'.onnx');
 try{const stat=await fsp.stat(dest);if(stat.size===m.size){const hash=crypto.createHash('sha256');await pipeline(fs.createReadStream(dest),new Transform({transform(chunk,enc,done){hash.update(chunk);done()}}));if(hash.digest('hex')===m.sha){modelPaths.set(name,dest);return dest}}}catch{}
 const temp=dest+'.'+crypto.randomUUID()+'.tmp';let count=0;const hash=crypto.createHash('sha256');
 try{const response=await request(m.url);await pipeline(response,new Transform({transform(chunk,enc,done){count+=chunk.length;if(count>m.size)return done(failure('MODEL_UNAVAILABLE','Model too large'));hash.update(chunk);done(null,chunk)}}),fs.createWriteStream(temp,{flags:'wx'}));
  if(count!==m.size||hash.digest('hex')!==m.sha)throw failure('MODEL_UNAVAILABLE','Model checksum mismatch');await fsp.rename(temp,dest);modelPaths.set(name,dest);return dest;
 }catch(e){await fsp.unlink(temp).catch(()=>{});throw failure('MODEL_UNAVAILABLE','موتور جداسازی قابل دریافت نیست.');}
}
async function readSource(source){
 if(/^\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(source)){const r=await require('./storage.cjs').download(source);if(r.bytes.length>8*1024*1024)throw failure('IMAGE_INVALID','عکس بیش از حد بزرگ است.');return Buffer.from(r.bytes)}
 if(/^\/assets\/[a-zA-Z0-9/_.-]+$/.test(source)&&!source.split('/').some(x=>x==='.'||x==='..')){const file=path.resolve(process.cwd(),'public',source.slice(1));if((await fsp.stat(file)).size>8*1024*1024)throw failure('IMAGE_INVALID','عکس بیش از حد بزرگ است.');return fsp.readFile(file)}
 throw failure('IMAGE_INVALID','مسیر تصویر محصول معتبر نیست.');
}
async function tensor(sharp,ort,pixels,w,h,size,mean,std,flip=false){
 let chain=sharp(pixels,{raw:{width:w,height:h,channels:4}});if(flip)chain=chain.flop();
 const rgb=await chain.removeAlpha().resize(size,size,{fit:'fill'}).raw().toBuffer();const n=size*size,data=new Float32Array(n*3);
 for(let i=0;i<n;i++)for(let c=0;c<3;c++)data[c*n+i]=(rgb[i*3+c]/255-mean[c])/std[c];return new ort.Tensor('float32',data,[1,3,size,size]);
}
async function prediction(name,pixels,w,h,type,{model=modelFile}={}){
 const sharp=require('sharp'),ort=require('onnxruntime-node'),s=await ort.InferenceSession.create(await model(name),{executionProviders:['cpu'],intraOpNumThreads:1,interOpNumThreads:1,enableCpuMemArena:false,enableMemPattern:false,graphOptimizationLevel:'all'});
 try{
  const size=name==='cloth'?768:name==='schp'?512:320,mean=name==='cloth'?[.5,.5,.5]:name==='schp'?[.406,.456,.485]:[.485,.456,.406],std=name==='cloth'?[.5,.5,.5]:name==='schp'?[.225,.224,.229]:[.229,.224,.225];
  const input=await tensor(sharp,ort,pixels,w,h,size,mean,std),result=await s.run({[s.inputNames[0]]:input}),v=result.logits||result[s.outputNames[0]],mw=v.dims.at(-1),mh=v.dims.at(-2);
  if(name==='object'){let lo=Infinity,hi=-Infinity;for(const p of v.data){lo=Math.min(lo,p);hi=Math.max(hi,p)}if(hi-lo<.01)throw failure('MASK_REJECTED','مرز محصول تشخیص داده نشد.');return{prob:Float32Array.from(v.data,x=>(x-lo)/(hi-lo)),mw,mh}}
  const ids=name==='cloth'?(spec(type).cloth||(type==='top'?[1]:type==='bottom'?[2]:[3])):spec(type).ids,channels=v.dims[1];
  const info=Q.semantic(v.data,channels,mw,mh,ids),body=name==='schp'?M.semantic(v.data,channels,mw,mh,ids).bodyRatio:0;
  if(type==='set'){const parts=M.semantic(v.data,channels,mw,mh,ids).counts,n=mw*mh,upper=name==='cloth'?parts[1]:parts[4],lower=name==='cloth'?parts[2]+parts[3]:parts[5]+parts[6]+parts[7];if(upper/n<.02||lower/n<.02)throw failure('MASK_REJECTED','هر دو بخش ست در این تصویر به‌طور کامل تشخیص داده نشد.');}
  // Target classes only; never substitute the person's whole silhouette.
  if(info.targetRatio<.003)return{prob:null,body,mw,mh};
  const second=await tensor(sharp,ort,pixels,w,h,size,mean,std,true),r2=await s.run({[s.inputNames[0]]:second}),v2=r2.logits||r2[s.outputNames[0]],info2=Q.semantic(v2.data,channels,mw,mh,ids);
  return{prob:Q.consensus(info.prob,info2.prob,mw,mh),body,mw,mh};
 }finally{await s.release()}
}
async function finish(pixels,w,h,mask,{pair=false}={}){
 const sharp=require('sharp');let alpha=M.resize(mask.prob,mask.mw,mask.mh,w,h);alpha=Q.clean(alpha,w,h,pair);alpha=M.refine(pixels,alpha,w,h,2);alpha=Q.clean(alpha,w,h,pair);
 let x0=w,y0=h,x1=-1,y1=-1;for(let i=0;i<alpha.length;i++){const a=Math.round(alpha[i]*pixels[i*4+3]);pixels[i*4+3]=a;if(a>24){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
 if(x1<x0||y1<y0)throw failure('MASK_REJECTED','لباس قابل نمایش پیدا نشد.');
 const original=Cut.inspect(pixels,w,h,{allowPair:pair});if(!original.ok)throw failure('MASK_REJECTED','حاشیه یا اجزای عکس به‌طور قابل اعتماد از پس‌زمینه جدا نشده‌اند.');
 Cut.cleanSpecks(pixels,w,h);const image=sharp(pixels,{raw:{width:w,height:h,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}});
 const thumb=await image.clone().resize(192,192,{fit:'inside'}).raw().toBuffer({resolveWithObject:true}),check=Cut.inspect(thumb.data,thumb.info.width,thumb.info.height,{allowPair:pair});
 if(!check.ok)throw failure('MASK_REJECTED',check.reason);
 const png=Buffer.from(Cut.stamp(await image.png({compressionLevel:9}).toBuffer()));if(png.length>3*1024*1024)throw failure('MASK_REJECTED','خروجی شفاف بیش از حد بزرگ است.');return png;
}
async function extract(bytes,type,{model=modelFile}={}){
 const sharp=require('sharp'),decoded=await sharp(bytes,{limitInputPixels:16000000,failOn:'error'}).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=decoded.info,pixels=new Uint8ClampedArray(decoded.data),pair=type==='shoes'||type==='set';
 const clothing=['top','bottom','dress','underwear','set'].includes(type);let human,last;
 try{human=await prediction('schp',pixels,w,h,type,{model});if(human.prob&&(!clothing||human.body>.001))return await finish(new Uint8ClampedArray(pixels),w,h,human,{pair})}catch(e){last=e;if(e.code==='MODEL_UNAVAILABLE')throw e}
 if(clothing){try{const mask=await prediction('cloth',pixels,w,h,type,{model});if(mask.prob)return await finish(new Uint8ClampedArray(pixels),w,h,mask,{pair})}catch(e){last=e;if(e.code==='MODEL_UNAVAILABLE')throw e}}
 // Saliency is allowed only for a standalone object, never a detected person,
 // and never a two-piece set whose completeness could not be established.
 if(human&&human.body<.001&&type!=='set'){
  const mask=await prediction('object',pixels,w,h,type,{model});return finish(new Uint8ClampedArray(pixels),w,h,mask,{pair});
 }
 throw last||failure('MASK_REJECTED','لباس با اطمینان از شخص یا پس‌زمینه جدا نشد.');
}
module.exports={kind,spec,extract,finish,readSource,modelFile,MODELS};
