import preparation from '../../lib/boutique-preparation.cjs';
import database from '../../lib/db.cjs';
import seo from '../../lib/seo.cjs';
import storage from '../../lib/storage.cjs';
const run=preparation.createWorker({withDatabase:database.withDatabase,upload:storage.upload,remove:storage.remove});
export default async function(request){if(!preparation.authorized(request))return;const result=await run();console.log('Boutique preparation',JSON.stringify(result));if(result.more)await preparation.dispatch(seo.ORIGIN);}
export const config={memory:'2gb',background:true,path:'/boutique-preparation-worker'};
