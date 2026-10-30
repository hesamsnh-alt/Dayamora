(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BoutiqueCore=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function clothing(products){return products.filter(p=>p.cat==='پوشاک'&&p.active&&!p.isSample)}
 const media=s=>typeof s==='string'&&(/^\/(?:uploads|assets)\/[a-zA-Z0-9/_.+-]+$/.test(s))&&!s.split('/').some(part=>part==='..'||part==='.');
 const localMedia=s=>typeof s==='string'&&/^blob:https?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?\/[a-fA-F0-9-]{8,}$/.test(s);
 function photos(p,colorId,cutouts=[]){const cs=p.options?.colors||[],c=cs.find(c=>c.id===colorId),source=c?.imageUrl||p.imageUrl,out=[];
  const prepared=cutouts.find(r=>Number(r.productId)===Number(p.id)&&r.colorId===(colorId||'')&&r.sourceImage===source&&(media(r.imageUrl)||(r.local===true&&localMedia(r.imageUrl))));
  if(prepared)out.push({src:prepared.imageUrl,label:cs.length>1&&!c?.imageUrl?'تصویر اصلی محصول؛ رنگ این انتخاب تأیید نشده':'نمای آمادهٔ لباس',prepared:true});
  return out;
 }
 function initial(p,ready=[]){const cs=p.options?.colors||[],c=cs.find(c=>photos(p,c.id,ready).length&&(p.variants||[]).some(v=>Number(c.stock?.[v])>0))||cs.find(c=>photos(p,c.id,ready).length)||cs.find(c=>(p.variants||[]).some(v=>Number(c.stock?.[v])>0))||cs[0],variant=(p.variants||[]).find(v=>c?Number(c.stock?.[v])>0:Number(p.stock)>0)||(p.variants||[])[0]||'';return{colorId:c?.id||'',variant}}
 function catalogue(products,mode='clothing'){return mode==='shoes'?products.filter(p=>p.cat==='کفش'&&p.active&&!p.isSample):clothing(products)}
 function filter(products,query,available,mode='clothing'){const q=String(query||'').trim().toLocaleLowerCase('fa');return catalogue(products,mode).filter(p=>(!q||[p.name,p.brand].join(' ').toLocaleLowerCase('fa').includes(q))&&(!available||Number(p.stock)>0))}
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function pose(delta){return{angle:clamp(delta*25,-56,56),scale:1-Math.min(Math.abs(delta),2)*.12,opacity:1-Math.min(Math.abs(delta),3)*.12}}
 function orbit(index,selected,count,width){let delta=(index-selected+count)%count;if(delta>count/2)delta-=count;const angle=delta*Math.PI/3.8;return{visible:Math.abs(delta)<=3,x:Math.sin(angle)*width*.34,y:-35*(1-Math.cos(angle)),scale:1-Math.min(Math.abs(delta),3)*.17,opacity:1-Math.min(Math.abs(delta),3)*.2,z:10-Math.abs(delta)}}
 return{clothing,catalogue,media,localMedia,photos,initial,filter,pose,orbit};
});
