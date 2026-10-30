import api from '../../lib/api.cjs';
export default async function(request,context){
  return api.handle(request,{ip:context.ip||'unknown',allowSetup:false,production:context.deploy?.context==='production'});
}
export const config={path:['/api/*','/uploads/*','/private-uploads/*'],excludedPath:['/api/journal','/api/journal/*','/api/admin/journal','/api/admin/journal/*']};
