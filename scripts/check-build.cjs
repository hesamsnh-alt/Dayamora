const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const folder of ['public','lib','netlify/functions','scripts'])for(const name of fs.readdirSync(path.join(root,folder))){
  if(/\.(js|cjs|mjs)$/.test(name))execFileSync(process.execPath,['--check',path.join(root,folder,name)],{stdio:'inherit'});
}
for(const name of ['index','admin','club','setup','product','budget'])if(!fs.existsSync(path.join(root,'public',name+'.html')))throw new Error('Missing page: '+name);
console.log('Syntax and publish folder verified. Build does not need or publish secrets.');
