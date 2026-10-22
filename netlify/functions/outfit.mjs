import outfits from '../../lib/outfits.cjs';
export default async function(request){return outfits.handle(request)}
export const config={path:'/outfit-api/*'};
