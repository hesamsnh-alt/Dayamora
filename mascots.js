function mascotPanel(pose,title,message,extra=''){
 const id='pose-'+String(pose).padStart(2,'0');
 return `<div class="mascot-panel ${extra}" data-pose="${pose}"><button class="mascot-character" type="button" aria-label="پیام همراه دایامورا: ${title}" aria-expanded="false"><img src="assets/mascots/${id}.webp" alt="شخصیت دختر فرفری دایامورا، حالت ${pose}" loading="lazy"><span class="mascot-spark">✧</span></button><div class="mascot-copy"><small>یه پیام کوچولو برای تو</small><h3>${title}</h3><p>${message}</p><span class="mascot-secret">${({1:'خوش اومدی خوش‌سلیقه! 🎀',2:'یه قدم نزدیک‌تر به استایل قشنگت ♡',3:'چشمک مخصوص تو 😉',4:'من اینجام؛ هر وقت آماده بودی ♡',5:'یه جرعه آرامش، یه دنیا انتخاب ☕',6:'استایل تو، قوانین تو ✨',7:'این قلب رو برات نگه داشتم ♡',8:'عجله نکن، خوشگل‌ترینو انتخاب کن 🍂',9:'بودجه‌ات هر چی باشه، با سلیقه انتخاب کن 🌸',10:'یه مکث کوچولو، بعد ادامهٔ کشف 🧋',11:'هر استایل، یه داستان تازه 📖',12:'من یه چرت کوچولو می‌زنم تا انتخاب کنی 💤',13:'اینجا همیشه یه جای گرم برای تو هست ☕',14:'با عشق، از دایامورا برای تو 🎀',15:'همین لبخندت، قشنگ‌ترین اکسسوریه ♡'})[pose]}</span></div></div>`
}
document.addEventListener('DOMContentLoaded',()=>{
 document.body.classList.add('fantasy-theme');
 document.querySelector('#mascotWelcome').innerHTML=mascotPanel(1,'سلام خوش‌سلیقه! به دنیای من خوش اومدی ♡','بیا با هم انتخاب‌های قشنگتو پیدا کنیم.','welcome-panel');
 document.querySelector('#dayaMoments').innerHTML=mascotPanel(3,'یه چشمک برای استایل تازه‌ات','با انتخاب‌های کوچیک، حالتو عوض کن.','moment-style')+mascotPanel(7,'یه دل نه، صد دل!','چیزهایی که دوست داری رو با قلب ذخیره کن.','moment-heart');
 document.querySelector('#mascotCafe').innerHTML=mascotPanel(10,'یه مکث شیرین، بین انتخاب‌ها','با خیال راحت بگرد؛ اینجا دنیای کوچولوی توئه.','cafe-panel');
 document.querySelector('#shoppingBuddy').innerHTML='<button class="buddy-close" aria-label="بستن همراه خرید">×</button>'+mascotPanel(4,'من منتظرم خرید کنی ♡','هر وقت آماده بودی، بریم سراغ انتخابت!','buddy-panel')+'<button class="buddy-go">بریم خرید ←</button>';
 const placements=[['.promo.lilac',6,'استایلتو خودت بساز','یه کم جسارت، یه کم سلیقه ♡'],['.promo.budget',9,'با بودجهٔ خودت بدرخش','انتخاب قشنگ لازم نیست همیشه گرون باشه.'],['.newsletter',5,'چای و خبرهای تازه؟','ایمیلتو بذار تا بعداً از تازه‌ها باخبرت کنیم.']];
 placements.forEach(([sel,pose,title,msg])=>{const node=document.querySelector(sel);node.insertAdjacentHTML('beforeend',mascotPanel(pose,title,msg,'corner-panel'))});
 document.querySelector('#thanksPreview').onclick=()=>modal('<span class="preview-label">پیش‌نمایش کارت تشکر · سفارشی ثبت نشده است</span>'+mascotPanel(14,'ممنون از خریدتون ♡','امیدوارم انتخابت کلی حال خوب برات بیاره!','thanks-panel')+'<p class="notice">این کارت برای نمایش طراحی پیام پس از خرید است. پرداخت و ثبت سفارش واقعی هنوز فعال نیست.</p>');
 document.querySelector('.buddy-close').onclick=()=>{document.querySelector('#shoppingBuddy').hidden=true;sessionStorage.setItem('dayamora-buddy-hidden','1')};
 document.querySelector('.buddy-go').onclick=()=>shop();
 if(sessionStorage.getItem('dayamora-buddy-hidden'))document.querySelector('#shoppingBuddy').hidden=true;
});
document.addEventListener('click',e=>{const b=e.target.closest('.mascot-character');if(b){const expanded=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!expanded));b.closest('.mascot-panel').classList.toggle('revealed',!expanded)}});
