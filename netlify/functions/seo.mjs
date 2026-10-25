import fs from 'node:fs';
import path from 'node:path';
import api from '../../lib/api.cjs';
import seo from '../../lib/seo.cjs';
const templates=new Map();
function template(name){if(!templates.has(name))templates.set(name,fs.readFileSync(path.join(process.cwd(),'public',name+'.html'),'utf8'));return templates.get(name)}
// Deliberately omit the visitor's cookies and headers: only public API responses
// may appear in crawlable/cacheable HTML. Admin/customer records are never requested.
const handle=seo.createHandler({template,get:async endpoint=>{
 const r=await api.handle(new Request(seo.ORIGIN+endpoint),{ip:'seo-public',allowSetup:false});
 if(!r.ok)throw Object.assign(new Error('Public content unavailable'),{status:r.status});
 return r.json();
}});
export default handle;
export const config={path:['/product','/product.html','/journal.html','/discover/journal','/sitemap.xml','/shop','/budget','/budget.html','/value']};
