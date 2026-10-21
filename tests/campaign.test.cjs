'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){
 const timers=new Map();let serial=0;
 const node=()=>({hidden:false,dataset:{},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.events[k]=v}});
 const slides=Array.from({length:5},node),dots=Array.from({length:5},(_,i)=>Object.assign(node(),{dataset:{slideTo:String(i)}}));
 const root=Object.assign(node(),{dataset:{interval:'5000'},querySelectorAll:s=>s==='[data-slide]'?slides:dots,contains:()=>false});
 const controls=Object.fromEntries(['slidePrev','slideNext','slidePause','slideStatus'].map(k=>[k,node()]));controls.campaignSlider=root;
 const document={hidden:false,activeElement:null,events:{},getElementById:k=>controls[k],addEventListener(k,v){this.events[k]=v}};
 const window={addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/campaign.js'),'utf8'),{document,window,setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});
 return{root,slides,dots,controls,document,timers,tick(){const [id,t]=timers.entries().next().value;timers.delete(id);t.fn()}};
}
test('five images rotate automatically every five seconds, wrap, and pause/resume',()=>{
 const s=setup();assert.equal(s.root.dataset.active,'0');assert.equal(s.timers.size,1);assert.equal([...s.timers.values()][0].ms,5000);
 s.tick();assert.equal(s.root.dataset.active,'1');assert.equal(s.slides[0].hidden,true);assert.equal(s.slides[1].hidden,false);assert.equal(s.dots[1].attrs['aria-current'],'true');
 for(let i=0;i<4;i++)s.tick();assert.equal(s.root.dataset.active,'0');
 s.controls.slidePause.events.click();assert.equal(s.timers.size,0);assert.equal(s.controls.slidePause.attrs['aria-pressed'],'true');
 s.controls.slidePause.events.click();assert.equal(s.timers.size,1);s.document.hidden=true;s.document.events.visibilitychange();assert.equal(s.timers.size,0);s.document.hidden=false;s.document.events.visibilitychange();assert.equal(s.timers.size,1);
});
test('navigation changes the visible linked image and restarts one timer',()=>{
 const s=setup();s.controls.slidePrev.events.click();assert.equal(s.root.dataset.active,'4');s.controls.slideNext.events.click();assert.equal(s.root.dataset.active,'0');s.dots[2].events.click();assert.equal(s.root.dataset.active,'2');assert.equal(s.timers.size,1);assert.equal(s.slides.filter(x=>!x.hidden).length,1);
});
