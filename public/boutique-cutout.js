(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoutiqueCutout=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
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
  const image=await new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>{im.onload=im.onerror=null;reject(Error('زمان دریافت تصویر آماده تمام شد.'))},15000);im.onload=()=>{clearTimeout(timer);resolve(im)};im.onerror=()=>{clearTimeout(timer);reject(Error('تصویر آماده دریافت نشد.'))};im.src=src});
  if(image.naturalWidth*image.naturalHeight>16000000)throw Error('تصویر آماده بیش از حد بزرگ است.');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),cv=document.createElement('canvas');cv.width=Math.round(image.naturalWidth*scale);cv.height=Math.round(image.naturalHeight*scale);const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,cv.width,cv.height);
  const thumb=document.createElement('canvas'),s=Math.min(1,192/Math.max(cv.width,cv.height));thumb.width=Math.max(16,Math.round(cv.width*s));thumb.height=Math.max(16,Math.round(cv.height*s));const tc=thumb.getContext('2d',{willReadFrequently:true});tc.drawImage(cv,0,0,thumb.width,thumb.height);const check=inspect(tc.getImageData(0,0,thumb.width,thumb.height).data,thumb.width,thumb.height,options);if(!check.ok)throw Error(check.reason);
  const pixels=ctx.getImageData(0,0,cv.width,cv.height);cleanSpecks(pixels.data,cv.width,cv.height);ctx.putImageData(pixels,0,0);let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const a=pixels.data[(y*cv.width+x)*4+3];if(a>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}}
  if(x1<x0)throw Error('بخش قابل نمایش پیدا نشد.');
  const out=document.createElement('canvas'),pad=2;out.width=x1-x0+1+pad*2;out.height=y1-y0+1+pad*2;out.getContext('2d').drawImage(cv,x0,y0,x1-x0+1,y1-y0+1,pad,pad,x1-x0+1,y1-y0+1);
  const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('تصویر شفاف آماده نشد.');return{url:URL.createObjectURL(blob),width:out.width,height:out.height};
 }
 return{inspect,normalize,cleanSpecks};
});
