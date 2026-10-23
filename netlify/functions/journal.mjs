// Explicit Netlify route for magazine articles; delegates to the existing API and its auth rules.
import api from '../../lib/api.cjs';
export default async function(request, context) {
  return api.handle(request, { ip: context.ip || 'unknown', allowSetup: false });
}
export const config = {
  path: ['/api/journal', '/api/journal/*', '/api/admin/journal', '/api/admin/journal/*']
};
