'use strict';
// Keep only this OS/CPU's CPU binding. Do not ship every platform to Functions.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(path.dirname(require.resolve('onnxruntime-node/package.json')),'bin','napi-v6');
if(fs.existsSync(root))for(const platform of fs.readdirSync(root)){
 const target=path.join(root,platform);if(!fs.statSync(target).isDirectory())continue;
 if(platform!==process.platform){fs.rmSync(target,{recursive:true,force:true});continue}
 for(const arch of fs.readdirSync(target)){const dir=path.join(target,arch);if(fs.statSync(dir).isDirectory()&&arch!==process.arch)fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('Boutique CPU runtime prepared for '+process.platform+'/'+process.arch);
