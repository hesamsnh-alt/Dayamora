'use strict';
const {inflateSync}=require('node:zlib'),{inspect}=require('../public/cutout-check.js'),{fail}=require('./outfit-validation.cjs');
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(b){let n=0xffffffff;for(const v of b)n=crcTable[(n^v)&255]^(n>>>8);return (n^0xffffffff)>>>0}
function validatePng(data){
 if(typeof data!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data))fail(400,'تصویر ست‌ساز باید PNG شفاف باشد.');
 const b=Buffer.from(data.split(',')[1],'base64');if(b.length>3*1024*1024)fail(413,'تصویر باید کمتر از ۳ مگابایت باشد.');
 const bad=()=>fail(400,'PNG معتبر با شفافیت واقعی و حاشیهٔ خالی لازم است.');
 if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))bad();let w,h,ended=false,idats=[],offset=8,header=false;
 while(offset+12<=b.length){const n=b.readUInt32BE(offset),t=b.toString('ascii',offset+4,offset+8);if(offset+n+12>b.length)bad();if(crc32(b.subarray(offset+4,offset+8+n))!==b.readUInt32BE(offset+8+n))bad();const v=b.subarray(offset+8,offset+8+n);offset+=n+12;
  if(!header&&t!=='IHDR')bad();if(t==='IHDR'){if(header||n!==13)bad();header=true;w=v.readUInt32BE(0);h=v.readUInt32BE(4);if(w<32||h<32||w>2048||h>2048||v[8]!==8||v[9]!==6||v[10]||v[11]||v[12])bad()}
  else if(t==='IDAT')idats.push(v);else if(t==='IEND'){ended=true;break}else if(t==='acTL')bad();
 }
 if(!ended||!idats.length)bad();const stride=w*4,limit=(stride+1)*h;let raw;try{raw=inflateSync(Buffer.concat(idats),{maxOutputLength:limit})}catch{bad()}if(raw.length!==limit)bad();const pixels=Buffer.alloc(w*h*4);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)];if(f>4)bad();for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?pixels[i-4]:0,up=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;pixels[i]=(raw[y*(stride+1)+1+x]+(f===0?0:f===1?a:f===2?up:f===3?Math.floor((a+up)/2):paeth(a,up,c)))&255}}
 if(!inspect(pixels,w,h).ok)bad();return{w,h};
}
module.exports={validatePng,crc32};
