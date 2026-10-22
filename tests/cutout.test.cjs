'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{deflateSync}=require('node:zlib'),{validatePng,crc32}=require('../lib/cutout-png.cjs'),{inspect,choose}=require('../public/cutout-check.js');
const {png}=require('./cutout-fixture.cjs');
test('transparent garment accepted; opaque square, JPEG disguise and empty image rejected',()=>{assert.deepEqual(validatePng(png()),{w:40,h:40});assert.throws(()=>validatePng(png(true)),/شفاف/);assert.throws(()=>validatePng('data:image/jpeg;base64,eA=='));assert.throws(()=>validatePng('data:image/png;base64,eA=='));assert.equal(inspect(new Uint8Array(40*40*4),40,40).ok,false)});
test('PNG sub and up row filtering preserve real alpha validation',()=>{assert.equal(validatePng(png(false,1)).w,40);assert.equal(validatePng(png(false,2)).h,40);assert.throws(()=>validatePng(png(true,2)))});
test('color never falls back to a different color or the advertising image',()=>{const rows=[{productId:1,colorId:'red',imageUrl:'/uploads/red.png'},{productId:1,colorId:'',imageUrl:'/uploads/default.png'}];assert.equal(choose(rows,1,'red'),'/uploads/red.png');assert.equal(choose(rows,1,'blue'),'');assert.equal(choose(rows,2,''),'')});
