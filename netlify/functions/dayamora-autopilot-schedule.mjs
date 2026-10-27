import storage from '../../lib/autopilot/store.cjs';
import engine from '../../lib/autopilot/engine.cjs';
export default async function(){
 // Dormant and zero paid AI calls until the independent setup is complete.
 if(!process.env.AUTOPILOT_ADMIN_KEY||!process.env.AUTOPILOT_OPENAI_API_KEY||!process.env.AUTOPILOT_S3_BUCKET)return;
 await engine.createEngine(storage.createStore()).tick();
}
export const config={schedule:'0 * * * *'};
