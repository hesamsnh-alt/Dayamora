'use strict';
// A bounded data reader for serialized SSR objects. No eval, functions, property
// access or calls. $R[number] is a data reference, never a JavaScript operation.
function readLiteral(source,start=0){
 let i=start,nodes=0;const refs=new Map();
 const ws=()=>{while(/\s/.test(source[i]||'')&&i<source.length)i++};
 function string(){const quote=source[i++];let out='';while(i<source.length){const c=source[i++];if(c===quote)return out;if(c!=='\\'){out+=c;continue}const e=source[i++],esc={b:'\b',f:'\f',n:'\n',r:'\r',t:'\t','\\':'\\','"':'"',"'":"'",'/':'/'};if(Object.hasOwn(esc,e))out+=esc[e];else if(e==='x'||e==='u'){const len=e==='x'?2:4,h=source.slice(i,i+len);if(!new RegExp('^[0-9a-f]{'+len+'}$','i').test(h))throw Error();out+=String.fromCharCode(parseInt(h,16));i+=len}else throw Error()}throw Error()}
 function value(depth=0){ws();if(depth>30||++nodes>30000)throw Error();let m;
  if(source[i]==='"'||source[i]==="'")return string();
  if(source[i]==='{'){i++;const obj=Object.create(null);ws();while(source[i]!=='}'){ws();const quoted=source[i]==='"'||source[i]==="'",key=quoted?string():(/^[A-Za-z_$][\w$]*/.exec(source.slice(i))||[])[0];if(!key||['__proto__','prototype','constructor'].includes(key))throw Error();
   if(!quoted)i+=key.length;
   ws();if(source[i++]!==':')throw Error();obj[key]=value(depth+1);ws();if(source[i]===','){i++;ws();continue}if(source[i]!=='}')throw Error();}i++;return obj;}
  if(source[i]==='['){i++;const arr=[];ws();while(source[i]!==']'){arr.push(value(depth+1));ws();if(source[i]===','){i++;ws();continue}if(source[i]!==']')throw Error()}i++;return arr;}
  if((m=/^\$R\[(\d{1,6})\]/.exec(source.slice(i)))){i+=m[0].length;ws();if(source[i]==='='){i++;const v=value(depth+1);refs.set(m[1],v);return v}return refs.get(m[1])??null;}
  for(const [token,v] of [['null',null],['true',true],['false',false],['!0',true],['!1',false],['void 0',null],['undefined',null]])if(source.startsWith(token,i)){i+=token.length;return v}
  if((m=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(source.slice(i)))){i+=m[0].length;const n=Number(m[0]);if(!Number.isFinite(n))throw Error();return n}throw Error();
 }
 try{return value()}catch{return null}
}
module.exports={readLiteral};
