(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoutiqueMask=api})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function semantic(logits,c,w,h,ids){
  const n=w*h,prob=new Float32Array(n),wanted=new Set(ids);let target=0;
  for(let i=0;i<n;i++){let best=-Infinity,label=0,sum=0,normalized=true;for(let k=0;k<c;k++){const v=logits[k*n+i];sum+=v;if(v<0||v>1)normalized=false;if(v>best){best=v;label=k;}}normalized=normalized&&Math.abs(sum-1)<.001;let total=0,part=0;for(let k=0;k<c;k++){const v=normalized?logits[k*n+i]:Math.exp(logits[k*n+i]-best);total+=v;if(wanted.has(k))part+=v;}prob[i]=part/total;if(wanted.has(label))target++;}
  return{prob,targetRatio:target/n};
 }
 // Consensus rather than union: a stray prediction in one view must not become
 // an opaque piece of skin/background in the final image.
 function consensus(first,flipped,w,h){const out=new Float32Array(first.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=first[y*w+x],b=flipped[y*w+w-1-x];out[y*w+x]=.75*Math.min(a,b)+.25*(a+b)/2;}return out;}
 function clean(alpha,w,h,pair=false){
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),labels=new Int32Array(w*h),parts=[];
  for(let i=0;i<alpha.length;i++){if(seen[i]||alpha[i]<.35)continue;let head=0,tail=1;queue[0]=i;seen[i]=1;const id=parts.length+1;while(head<tail){const k=queue[head++],x=k%w,y=(k/w)|0;labels[k]=id;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=ny*w+nx;if(!seen[j]&&alpha[j]>=.35){seen[j]=1;queue[tail++]=j;}}}parts.push({id,size:tail});}
  parts.sort((a,b)=>b.size-a.size);if(!parts.length)throw Error('لباس قابل جداسازی پیدا نشد.');
  const total=parts.reduce((n,p)=>n+p.size,0),keep=parts.slice(0,pair?2:1),kept=keep.reduce((n,p)=>n+p.size,0);
  if(kept/total<.96)throw Error('لباس تکه‌تکه تشخیص داده شد؛ عکس دیگری از همین محصول بررسی می‌شود.');
  const ids=new Set(keep.map(p=>p.id)),out=new Float32Array(alpha.length);
  // Retain a 2px soft boundary around accepted components; no global blur and
  // no dilation of the garment silhouette. Disconnected scraps are removed.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(ids.has(labels[i])){out[i]=alpha[i];continue;}if(alpha[i]<.03||labels[i])continue;let near=false;for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&ids.has(labels[ny*w+nx])){near=true;break;}}if(near)out[i]=alpha[i];}
  return out;
 }
 return{semantic,consensus,clean};
});
