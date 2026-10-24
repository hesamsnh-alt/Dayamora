import pricing from '../../lib/fx-pricing.cjs';
export default async function(){const result=await pricing.scheduled();console.log(JSON.stringify({task:'dayamora-daily-prices',ok:result.ok!==false,skipped:!!result.skipped,changed:result.changed||0}));}
// 12:00 UTC = 16:00 UAE. Only runs on published production deploys.
export const config={schedule:'0 12 * * *'};
