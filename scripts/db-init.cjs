'use strict';
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path');
const {neon}=require('@neondatabase/serverless');
const seed=require('../lib/seed.cjs');
async function init(value=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL){
  if(!value)throw new Error('DATABASE_URL is missing from .env');
  const u=new URL(value);if(!u.hostname.endsWith('.neon.tech'))throw new Error('A Neon connection is required');
  u.hostname=u.hostname.replace(/-pooler\./,'.');
  const sql=neon(u.toString()),source=fs.readFileSync(path.join(__dirname,'../database/001-initial.sql'),'utf8');
  const statements=source.split(';').map(x=>x.trim()).filter(Boolean);
  await sql.transaction(statements.map(s=>sql.query(s)));
  await sql.transaction(require('../lib/migrations.cjs').upgradeSql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s)));
  const [{n}]=await sql.query('SELECT COUNT(*) n FROM dayamora.products');
  if(Number(n)===0)await sql.transaction(seed.map((p,i)=>sql.query(`INSERT INTO dayamora.products(id,name,brand,cat,price,stock,variants,image_url,description,is_sample)
    VALUES($1,$2,$3,$4,$5,10,$6,$7,$8,1) ON CONFLICT(id) DO NOTHING`,[i+1,p.name,p.brand,p.cat,p.price,JSON.stringify(p.variants),'/assets/'+p.image+'.webp','محصول نمونه؛ مشخصات و قیمت باید توسط مدیر بررسی شود.'])));
  await sql.query("SELECT setval(pg_get_serial_sequence('dayamora.products','id'),GREATEST(COALESCE((SELECT MAX(id) FROM dayamora.products),0),1),true)");
  console.log('Dayamora schema ready. Existing users and orders preserved.');
}
if(require.main===module)init().catch(e=>{console.error('Database setup failed:',e.code||'Check DATABASE_URL and network');process.exitCode=1});
module.exports={init};
