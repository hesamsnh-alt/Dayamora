const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
// Syntax checks alone passed even when the deployed API could not load its driver.
// Fail the build before deployment if a production dependency is missing/broken.
for(const dependency of Object.keys(require('../package.json').dependencies)){
  try{require(dependency)}catch{throw new Error('Cannot load production dependency: '+dependency+'. Run npm ci before building.');}
}
require('../lib/api.cjs');
for(const folder of ['public','lib','netlify/functions','scripts'])for(const name of fs.readdirSync(path.join(root,folder))){
  if(/\.(js|cjs|mjs)$/.test(name))execFileSync(process.execPath,['--check',path.join(root,folder,name)],{stdio:'inherit'});
}
for(const name of ['index','admin','club','setup','product','budget'])if(!fs.existsSync(path.join(root,'public',name+'.html')))throw new Error('Missing page: '+name);
for(const name of fs.readdirSync(path.join(root,'public')).filter(n=>n.endsWith('.html'))){const html=fs.readFileSync(path.join(root,'public',name),'utf8');if(!html.includes('http-equiv="Content-Security-Policy"'))throw new Error('Missing document policy: '+name)}
console.log('Syntax and publish folder verified. Build does not need or publish secrets.');
