(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CutoutCheck=api})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 // Transparency is a technical check only; it cannot identify a person or a garment.
 function inspect(data,w,h){let clear=0,solid=0,edge=0,edgeClear=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a<16)clear++;if(a>200)solid++;if(x===0||y===0||x===w-1||y===h-1){edge++;if(a<16)edgeClear++}}return{ok:w>=32&&h>=32&&clear/(w*h)>=.04&&solid/(w*h)>=.01&&edgeClear/edge>=.6,clear,solid,edgeClear,edge}}
 function choose(rows,productId,colorId=''){return rows.find(r=>Number(r.productId)===Number(productId)&&r.colorId===colorId)?.imageUrl||''}
 return{inspect,choose};
});
