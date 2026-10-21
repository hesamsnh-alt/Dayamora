import api from '../../lib/api.cjs';
export default async function(request,context){
  return api.handle(request,{ip:context.ip||'unknown',allowSetup:false});
}
export const config={path:['/api/*','/uploads/*','/private-uploads/*']};
