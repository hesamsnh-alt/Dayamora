/* Brand catalogue is distinct from product categories. Names are not inventory claims. */
window.DayaBrands=(()=>{
const names=["Nike", "adidas", "Puma", "New Balance", "Converse", "Vans", "Reebok", "ASICS", "Skechers", "Under Armour", "Zara", "H&M", "Mango", "Massimo Dutti", "Bershka", "Pull&Bear", "Stradivarius", "Uniqlo", "COS", "Levi’s", "Calvin Klein", "Tommy Hilfiger", "Ralph Lauren", "Lacoste", "Guess", "Diesel", "The North Face", "Columbia", "Patagonia", "Lululemon", "Chanel", "Dior", "Gucci", "Prada", "Louis Vuitton", "Hermès", "Saint Laurent", "Balenciaga", "Fendi", "Versace", "Burberry", "Valentino", "Givenchy", "Celine", "Bottega Veneta", "Coach", "Michael Kors", "Kate Spade", "Tory Burch", "Longchamp", "Furla", "Aldo", "Charles & Keith", "Ray-Ban", "Oakley", "Pandora", "Swarovski", "Cartier", "Tiffany & Co.", "MAC", "Maybelline", "L’Oréal Paris", "NYX", "Fenty Beauty", "Rare Beauty", "Huda Beauty", "Charlotte Tilbury", "NARS", "YSL Beauty", "Sephora", "Sephora Collection", "KIKO Milano", "Essence", "Catrice", "e.l.f.", "The Ordinary", "CeraVe", "La Roche-Posay", "Cetaphil", "Neutrogena", "Clinique", "Estée Lauder", "Lancôme", "Kiehl’s", "Olaplex", "Moroccanoil", "Garnier", "Dove", "Nivea", "Sol de Janeiro", "Bath & Body Works", "Victoria’s Secret", "SHEGLAM", "SHEIN", "Miniso", "Apple", "Samsung", "Xiaomi", "Spigen", "Casetify", "Anker", "Baseus", "UGREEN", "JBL", "Sony"];
const generic=new Set(['case','قاب','کلاه','اکسسوری','آرایشی','اقتصادی','لباس','پوشاک','کفش','کیف','beauty','makeup','accessory','accessories','hat','phone case','لوازم آرایشی','بدون برند','no brand','generic']);
const valid=s=>{const t=String(s||'').trim();return !!t&&!generic.has(t.toLocaleLowerCase('en-US'))};
const match=s=>names.find(n=>n.toLocaleLowerCase('en-US')===String(s||'').trim().toLocaleLowerCase('en-US'));
const normalize=s=>valid(s)?(match(s)||String(s).trim()):'';
const all=products=>[...names,...new Set((products||[]).map(p=>normalize(p.brand)).filter(Boolean).filter(b=>!match(b)))];
/* Brand typography remains local; not a claim of official trademark artwork. */
const iconSlugs={Nike:'nike',adidas:'adidas',Puma:'puma','New Balance':'newbalance',Converse:'converse',Vans:'vans',Reebok:'reebok',ASICS:'asics',Skechers:'skechers','Under Armour':'underarmour',Zara:'zara','H&M':'handm',Mango:'mango',Uniqlo:'uniqlo','Levi’s':'levis','Calvin Klein':'calvinklein','Tommy Hilfiger':'tommyhilfiger',Lacoste:'lacoste',Diesel:'diesel','The North Face':'thenorthface',Patagonia:'patagonia',Chanel:'chanel',Dior:'dior',Gucci:'gucci',Prada:'prada','Louis Vuitton':'louisvuitton',Versace:'versace',Burberry:'burberry',Valentino:'valentino',Givenchy:'givenchy',Fendi:'fendi',Coach:'coach','Michael Kors':'michaelkors','Ray-Ban':'rayban',Oakley:'oakley',Pandora:'pandora',Swarovski:'swarovski',Cartier:'cartier',Maybelline:'maybelline',SHEGLAM:'sheglam',Sephora:'sephora','Sephora Collection':'sephora',NARS:'nars','The Ordinary':'theordinary',CeraVe:'cerave',Clinique:'clinique','Estée Lauder':'esteelauder',Garnier:'garnier',Dove:'dove',Nivea:'nivea',SHEIN:'shein',Apple:'apple',Samsung:'samsung',Xiaomi:'xiaomi',Spigen:'spigen',Anker:'anker',JBL:'jbl',Sony:'sony'};
/* Prefer verified, locally stored brand marks. When no local SVG exists,
   the versioned brand icon service is tried. Never show broken images or initials.
   Add licensed brand-provided SVG files to public/assets/brand-logos/<slug>.svg. */
const safeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mark=name=>{
 const slug=iconSlugs[name];
 const text='<span class="daya-brand-wordmark">'+safeText(name)+'</span>';
 if(!slug)return '<span class="daya-brand-mark" aria-hidden="true">'+text+'</span>';
 const local='/assets/brand-logos/'+slug+'.svg';
 return '<span class="daya-brand-mark" aria-hidden="true">'+
 '<img src="'+local+'" data-brand-remote="https://cdn.simpleicons.org/'+slug+'" alt="" loading="lazy">'+text+'</span>';
};
const reveal=img=>{img.classList.add('daya-brand-loaded');img.closest('.daya-brand-mark')?.classList.add('has-logo')};
document.addEventListener('load',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.closest('.daya-brand-mark'))reveal(img)},true);
document.addEventListener('error',event=>{const img=event.target;
 if(!(img instanceof HTMLImageElement)||!img.closest('.daya-brand-mark'))return;
 const remote=img.dataset.brandRemote;
 if(remote){delete img.dataset.brandRemote;img.src=remote;return}
 img.remove();
},true);

return {names,valid,normalize,all,mark};
})();
