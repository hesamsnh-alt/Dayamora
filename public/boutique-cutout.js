(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoutiqueCutout=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const QUALITY=2,TAG='DayamoraBoutique\x00v2';
 function version(bytes){const b=new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<20||b[0]!==137||b[1]!==80||b[2]!==78||b[3]!==71)return 0;for(let i=8;i+12<=b.length;){const n=v.getUint32(i);if(i+n+12>b.length)return 0;if(String.fromCharCode(...b.subarray(i+4,i+8))==='tEXt'&&String.fromCharCode(...b.subarray(i+8,i+8+Math.min(n,100)))===TAG)return QUALITY;i+=n+12;}return 0;}
 function stamp(bytes){const b=new Uint8Array(bytes),type=Uint8Array.from('tEXt',c=>c.charCodeAt(0)),data=Uint8Array.from(TAG,c=>c.charCodeAt(0)),chunk=new Uint8Array(data.length+12),v=new DataView(chunk.buffer);v.setUint32(0,data.length);chunk.set(type,4);chunk.set(data,8);let crc=0xffffffff;for(const x of chunk.subarray(4,8+data.length)){crc^=x;for(let j=0;j<8;j++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}v.setUint32(8+data.length,(crc^0xffffffff)>>>0);if(b.length<12||String.fromCharCode(...b.subarray(b.length-8,b.length-4))!=='IEND')throw Error('خروجی PNG معتبر نیست.');const out=new Uint8Array(b.length+chunk.length);out.set(b.subarray(0,b.length-12));out.set(chunk,b.length-12);out.set(b.subarray(b.length-12),b.length-12+chunk.length);return out;}
 // Technical checks cannot certify that an image contains only a garment.
 function inspect(rgba,w,h,{allowPair=false}={}){
  if(w<16||h<16||rgba.length!==w*h*4)return{ok:false,reason:'ابعاد تصویر مناسب نیست.'};
  let count=0,clear=0,edge=0,clearEdge=0,x0=w,y0=h,x1=-1,y1=-1;
  const mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,a=rgba[i*4+3];if(a<16)clear++;if(a>24){mask[i]=1;count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}if(!x||!y||x===w-1||y===h-1){edge++;if(a<16)clearEdge++}}
  if(clear/(w*h)<.04||count/(w*h)<.035||clearEdge/edge<.6||x1<x0)return{ok:false,reason:'پس‌زمینهٔ تصویر شفاف و تمیز نیست.'};
  for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;let head=0,tail=1,size=0;queue[0]=i;seen[i]=1;while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);size++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n}}}components.push(size)}
  if(count/((x1-x0+1)*(y1-y0+1))>.98)return{ok:false,reason:'کادر مستطیلی پس‌زمینه هنوز باقی مانده است.'};
  components.sort((a,b)=>b-a);const significant=components.filter(n=>n>count*.04),ratio=(x1-x0+1)/(y1-y0+1);
  if((allowPair?(components[0]||0)+(components[1]||0):(components[0]||0))/count<.9||significant.length>(allowPair?2:1)||ratio<.2||ratio>7)return{ok:false,reason:'برش تصویر تکه‌تکه یا نامناسب است.'};
  return{ok:true,bounds:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},count,components:significant.length};
 }
 function cleanSpecks(rgba,w,h){const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let solid=0;for(let i=0;i<w*h;i++)if(rgba[i*4+3]>8)solid++;else rgba[i*4+3]=0;const limit=Math.max(3,Math.floor(solid*.001));for(let i=0;i<w*h;i++){if(seen[i]||rgba[i*4+3]<=8)continue;let head=0,tail=1;queue[0]=i;seen[i]=1;while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&rgba[n*4+3]>8){seen[n]=1;queue[tail++]=n}}}if(tail<limit)for(let k=0;k<tail;k++)rgba[queue[k]*4+3]=0;}return rgba;}
 async function normalize(src,options={}){
  const response=await fetch(src,{credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('تصویر آماده دریافت نشد.');const bytes=await response.arrayBuffer();if(bytes.byteLength>8*1024*1024)throw Error('حجم تصویر آماده زیاد است.');const qualityVersion=version(bytes),inputUrl=URL.createObjectURL(new Blob([bytes]));let image;
  try{image=await new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>{im.onload=im.onerror=null;reject(Error('زمان دریافت تصویر آماده تمام شد.'))},15000);im.onload=()=>{clearTimeout(timer);resolve(im)};im.onerror=()=>{clearTimeout(timer);reject(Error('تصویر آماده دریافت نشد.'))};im.src=inputUrl});}finally{URL.revokeObjectURL(inputUrl);}
  if(image.naturalWidth*image.naturalHeight>16000000)throw Error('تصویر آماده بیش از حد بزرگ است.');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),cv=document.createElement('canvas');cv.width=Math.round(image.naturalWidth*scale);cv.height=Math.round(image.naturalHeight*scale);const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,cv.width,cv.height);
  const thumb=document.createElement('canvas'),s=Math.min(1,192/Math.max(cv.width,cv.height));thumb.width=Math.max(16,Math.round(cv.width*s));thumb.height=Math.max(16,Math.round(cv.height*s));const tc=thumb.getContext('2d',{willReadFrequently:true});tc.drawImage(cv,0,0,thumb.width,thumb.height);const check=inspect(tc.getImageData(0,0,thumb.width,thumb.height).data,thumb.width,thumb.height,options);if(!check.ok)throw Error(check.reason);
  const pixels=ctx.getImageData(0,0,cv.width,cv.height);cleanSpecks(pixels.data,cv.width,cv.height);ctx.putImageData(pixels,0,0);let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const a=pixels.data[(y*cv.width+x)*4+3];if(a>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}}
  if(x1<x0)throw Error('بخش قابل نمایش پیدا نشد.');
  const out=document.createElement('canvas'),pad=2;out.width=x1-x0+1+pad*2;out.height=y1-y0+1+pad*2;out.getContext('2d').drawImage(cv,x0,y0,x1-x0+1,y1-y0+1,pad,pad,x1-x0+1,y1-y0+1);
  let blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('تصویر شفاف آماده نشد.');let data;
  if(options.markQuality){blob=new Blob([stamp(await blob.arrayBuffer())],{type:'image/png'});if(blob.size>3*1024*1024)throw Error('خروجی شفاف از سه مگابایت بیشتر است.');data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('ساخت تصویر شفاف انجام نشد.'));reader.readAsDataURL(blob);});}
  return{url:URL.createObjectURL(blob),width:out.width,height:out.height,qualityVersion:options.markQuality?QUALITY:qualityVersion,...(data?{data}:{})};
 }
 return{inspect,normalize,cleanSpecks,version,stamp,QUALITY};
});
