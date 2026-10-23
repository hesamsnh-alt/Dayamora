'use strict';
const form=document.querySelector('#resetForm'),note=document.querySelector('#resetNote');
const raw=location.hash.slice(1).split('.');history.replaceState(null,'',location.pathname);
if(raw.length!==2||!/^[a-f0-9-]{36}$/.test(raw[0])||!/^[a-f0-9]{64}$/.test(raw[1])){form.hidden=true;note.textContent='لینک بازیابی معتبر نیست. از فروشگاه یا صفحه ورود، لینک جدید درخواست کنید.'}
form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');if(form.elements.password.value!==form.elements.again.value){note.textContent='رمزها یکسان نیستند.';return}b.disabled=true;try{await Daya.api('/api/reset-password',{method:'POST',body:JSON.stringify({userId:raw[0],token:raw[1],password:form.elements.password.value})});raw.fill('');form.reset();form.hidden=true;note.textContent='رمز جدید ذخیره شد. اکنون از لینک زیر وارد شوید.'}catch(err){note.textContent=err.message}finally{b.disabled=false}};
