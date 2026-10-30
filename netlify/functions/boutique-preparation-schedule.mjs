import preparation from '../../lib/boutique-preparation.cjs';
import seo from '../../lib/seo.cjs';
export default async function(){await preparation.dispatch(seo.ORIGIN);return new Response('Accepted',{status:202});}
export const config={schedule:'0 * * * *'};
