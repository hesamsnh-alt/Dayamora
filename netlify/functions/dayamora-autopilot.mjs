import api from '../../lib/autopilot/http.cjs';
export default function(request){return api.handle(request);}
export const config={path:'/dayamora-autopilot-api/*'};
