'use strict';
const {Pool, neon, neonConfig, types}=require('@neondatabase/serverless');
const ws=require('ws');
const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;
neonConfig.webSocketConstructor=proxy?class extends ws{
  constructor(url,protocols,options){super(url,protocols,{...options,agent:new(require('https-proxy-agent').HttpsProxyAgent)(proxy),handshakeTimeout:30000})}
}:ws;
types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
function connectionString(){
  const value=process.env.DATABASE_URL;
  if(!value)throw Object.assign(new Error('DATABASE_URL را در فایل .env یا تنظیمات Netlify قرار بده.'),{status:503});
  let u;try{u=new URL(value)}catch{throw new Error('Invalid DATABASE_URL')}
  if(u.protocol!=='postgresql:'&&!u.protocol!=='postgres:')throw new Error('Invalid database protocol');
  if(!u.hostname.endsWith('.neon.tech'))throw new Error('This patch requires the separate Dayamora Neon database.');
  return value;
}
let pool,poolUrl,featuresPromise=null;
function getPool(){
  const value=connectionString();
  if(!pool||value!==poolUrl){
    if(pool)pool.end().catch(()=>{});
    featuresPromise=null;poolUrl=value;pool=new Pool({connectionString:value,max:3,idleTimeoutMillis:60000,allowExitOnIdle:true,connectionTimeoutMillis:30000,query_timeout:20000});
    pool.on('error',()=>{}); // The driver removes a disconnected idle client.
  }
  return pool;
}
async function ensureFeatures(){
  if(!featuresPromise)featuresPromise=(async()=>{
    const u=new URL(process.env.DATABASE_URL_UNPOOLED||connectionString());u.hostname=u.hostname.replace(/-pooler\./,'.');
    const migrationPool=new Pool({connectionString:u.toString(),max:1,connectionTimeoutMillis:30000,query_timeout:20000});
    let c;
    try{
      c=await migrationPool.connect();await c.query("BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='20s'");
      await c.query('SELECT pg_advisory_xact_lock(204261022)');
      const applied=await c.query('SELECT version FROM dayamora.migrations WHERE version=2');
      if(!applied.rows.length)await c.query(require('./migrations.cjs').upgradeSql);
      const discovery=await c.query('SELECT version FROM dayamora.migrations WHERE version=5');if(!discovery.rows.length)await c.query(require('./migrations.cjs').discoverySql);
      await c.query('COMMIT');
    }catch(e){if(c)try{await c.query('ROLLBACK')}catch{}throw e}
    finally{if(c)c.release();await migrationPool.end()}
  })().catch(e=>{featuresPromise=null;throw e});
  return featuresPromise;
}
async function withDatabase(write,fn){
  const activePool=getPool();await ensureFeatures();
  const client=await activePool.connect();
  let began=false,discard=false;
  try{
    await client.query("BEGIN; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='15s'; SET LOCAL search_path TO dayamora, pg_catalog");began=true;
    // Serializes store writes across instances, including retries, stock and loyalty awards.
    // Suitable for a small shop; split into per-order/customer locks when scaling.
    if(write)await client.query('SELECT pg_advisory_xact_lock(204261021)');
    const q=async(sql,args=[])=>{
      let i=0;const parameterized=sql.replace(/\?/g,()=>'$'+(++i));
      return (await client.query(parameterized,args)).rows;
    };
    const result=await fn({all:q,one:async(s,a)=>(await q(s,a))[0],run:q});
    await client.query('COMMIT');return result;
  }catch(e){if(began)try{await client.query('ROLLBACK')}catch{discard=true}throw e}finally{client.release(discard)}
}
async function rateLimit(ip,action){
  const crypto=require('node:crypto');
  const key=crypto.createHash('sha256').update(ip+':'+action).digest('hex');
  const sql=neon(connectionString());const now=Date.now(),until=now+900000;
  // Own transaction so rejected logins still consume their allowance.
  const [r]=await sql.query(`INSERT INTO dayamora.rate_limits(key,n,until_at) VALUES($1,1,$2)
    ON CONFLICT(key) DO UPDATE SET n=CASE WHEN rate_limits.until_at < $3 THEN 1 ELSE rate_limits.n+1 END,
    until_at=CASE WHEN rate_limits.until_at < $3 THEN $2 ELSE rate_limits.until_at END RETURNING n`,[key,until,now]);
  if(r.n>(action==='garment-cutout'?500:25))throw Object.assign(new Error('تلاش‌های زیاد؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.'),{status:429});
}
module.exports={withDatabase,rateLimit,connectionString};
