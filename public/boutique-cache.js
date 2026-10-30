(function(root){
 'use strict';let opening;
 function open(){if(!root.indexedDB)return Promise.resolve(null);return opening||(opening=new Promise(resolve=>{const r=root.indexedDB.open('dayamora-boutique-local-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('cutouts',{keyPath:'key'});r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();opening=null};resolve(db)};r.onerror=r.onblocked=()=>resolve(null)}));}
 async function transaction(mode,action){const db=await open();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('cutouts',mode);let request;try{request=action(tx.objectStore('cutouts'))}catch(e){reject(e);return}tx.oncomplete=()=>resolve(request?.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Local cache unavailable'))});}
 async function get(key){try{return(await transaction('readonly',s=>s.get(key)))?.blob||null}catch{return null}}
 async function put(key,blob){try{await transaction('readwrite',s=>s.put({key,blob,time:Date.now(),size:blob.size}));const rows=await transaction('readonly',s=>s.getAll());if(!rows)return;rows.sort((a,b)=>a.time-b.time);let bytes=rows.reduce((n,r)=>n+r.size,0),count=rows.length;const remove=[];for(const r of rows){if(bytes<=32*1024*1024&&count<=40)break;remove.push(r.key);bytes-=r.size;count--;}if(remove.length)await transaction('readwrite',s=>{for(const k of remove)s.delete(k)})}catch{/* Storage denial must not block the live preview. */}}
 root.BoutiqueCache={get,put};
})(window);
