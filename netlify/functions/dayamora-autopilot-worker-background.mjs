import auth from '../../lib/autopilot/auth.cjs';
import storage from '../../lib/autopilot/store.cjs';
import engine from '../../lib/autopilot/engine.cjs';
export default async function(request){
 if(request.method!=='POST')return new Response(null,{status:405});
 let token;try{token=auth.verify((await auth.body(request)).ticket,'worker');}catch{return new Response(null,{status:400});}
 if(!token||typeof token.id!=='string')return new Response(null,{status:403});
 // Repeated delivery can only claim the persisted queued job once.
 await engine.createEngine(storage.createStore()).run(token.id);
 return new Response(null,{status:202});
}
export const config={background:true};
