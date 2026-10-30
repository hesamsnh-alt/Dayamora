import preparation from '../../lib/boutique-preparation.cjs';
import engine from '../../lib/boutique-engine.cjs';
import database from '../../lib/db.cjs';
import seo from '../../lib/seo.cjs';
import storage from '../../lib/storage.cjs';
const run=preparation.createWorker({withDatabase:database.withDatabase,extract:engine.extractLight,upload:storage.upload,remove:storage.remove});
export default async function(request){if(!preparation.authorized(request))return;const result=await run();console.log('Boutique preparation',JSON.stringify(result));if(result.more)await preparation.dispatch(seo.ORIGIN);}
export const config={background:true,path:'/boutique-preparation-worker'};
