import preparation from '../../lib/boutique-preparation.cjs';
import seo from '../../lib/seo.cjs';
export default {async deploySucceeded(event){if(event.deploy.context==='production')await preparation.dispatch(seo.ORIGIN)}};
