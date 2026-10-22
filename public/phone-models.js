/* Phone-case selector data; models are selectable only, not a promise of case availability. */
window.DayaPhoneModels=Object.freeze({
 'اپل / iPhone':[
 ...['11','12','13','14','15','16','17'].flatMap(n=>['', 'Pro','Pro Max',...(['12','13'].includes(n)?['mini']:[])].filter(Boolean).map(t=>`iPhone ${n}${t==='mini'?' mini':t?' '+t:''}`)),
 'iPhone 11 Pro','iPhone 11 Pro Max','iPhone 12 mini','iPhone 13 mini','iPhone 14 Plus','iPhone 15 Plus','iPhone 16 Plus','iPhone 16e','iPhone 17 Air','iPhone 17e','iPhone 18 Pro','iPhone 18 Pro Max','iPhone SE 2020','iPhone SE 2022'
 ],
 'سامسونگ / Galaxy S':[
 ...Array.from({length:9},(_,i)=>2018+i).flatMap(y=>{const n=y-2000;return y<2020?[`Galaxy S${y===2018?'9':'10'}`,`Galaxy S${y===2018?'9+':'10+'}`,...(y===2019?['Galaxy S10e']:[])]:[`Galaxy S${n}`,`Galaxy S${n}+`,`Galaxy S${n} Ultra`,...(n===20||n===21? [`Galaxy S${n} FE`]:[])]}),
 'Galaxy S23 FE','Galaxy S24 FE','Galaxy S25 Edge','Galaxy S25 FE'
 ],
 'سامسونگ / Galaxy A & M':[
 ...['A01','A02','A03','A04','A05','A06','A07','A10','A11','A12','A13','A14','A15','A16','A17','A20','A20s','A21s','A22','A23','A24','A25','A26','A30','A30s','A31','A32','A33','A34','A35','A36','A50','A51','A52','A52s','A53','A54','A55','A56','A70','A71','A72','A73','M11','M12','M13','M14','M15','M21','M22','M23','M31','M32','M33','M34','M35','M51','M52','M53','M54','M55'].map(s=>'Galaxy '+s)
 ],
 'سامسونگ / Galaxy Z & Note':[
 ...[1,2,3,4,5,6,7].flatMap(n=>[`Galaxy Z Flip${n===1?'': ' '+n}`,`Galaxy Z Fold${n===1?'': ' '+n}`]),
 'Galaxy Note 9','Galaxy Note 10','Galaxy Note 10+','Galaxy Note 10 Lite','Galaxy Note 20','Galaxy Note 20 Ultra'
 ],
 'شیائومی / Xiaomi & Mi':[
 ...[9,10,11,12,13,14,15,16].flatMap(n=>[`Xiaomi ${n}`,`Xiaomi ${n} Pro`, `Xiaomi ${n} Ultra`]),
 'Mi 8','Mi 8 Lite','Mi 9','Mi 9T','Mi 9T Pro','Mi 10','Mi 10T','Mi 10T Pro','Mi 11','Mi 11 Lite','Xiaomi 11T','Xiaomi 11T Pro','Xiaomi 12T','Xiaomi 12T Pro','Xiaomi 13T','Xiaomi 13T Pro','Xiaomi 14T','Xiaomi 14T Pro','Xiaomi 15T','Xiaomi 15T Pro'
 ],
 'شیائومی / Redmi & Note':[
 ...[7,8,9,10,11,12,13,14,15].flatMap(n=>[`Redmi Note ${n}`,`Redmi Note ${n} Pro`,`Redmi Note ${n} Pro+`]),
 ...[8,9,10,11,12,13,14,15].flatMap(n=>[`Redmi ${n}`,`Redmi ${n}A`,`Redmi ${n}C`]),
 'Redmi Note 8T','Redmi Note 9S','Redmi Note 10S','Redmi Note 11S','Redmi Note 12S','Redmi Note 13 4G','Redmi Note 13 5G','Redmi Note 14 4G','Redmi Note 14 5G'
 ],
 'شیائومی / POCO':[
 ...['F1','F2 Pro','F3','F4','F4 GT','F5','F5 Pro','F6','F6 Pro','F7','F7 Pro','F7 Ultra','X3','X3 NFC','X3 Pro','X4 Pro','X5','X5 Pro','X6','X6 Pro','X7','X7 Pro','M3','M4 Pro','M5','M5s','M6','M6 Pro','M7','C40','C55','C65','C75'].map(s=>'POCO '+s)
 ],
 'سایر برندها / Other':[
 ...['P30','P30 Pro','P40','P40 Pro','P50','P50 Pro','Mate 20','Mate 20 Pro','Mate 30','Mate 40 Pro','Nova 5T','Nova 7i','Nova 9','Nova 11','Nova 12'].map(s=>'Huawei '+s),
 ...['A54','A55','A57','A58','A78','A79','A95','A96','A98','Reno 5','Reno 6','Reno 7','Reno 8','Reno 10','Reno 11','Reno 12','Reno 13','Reno 14','Find X5','Find X6','Find X7','Find X8'].map(s=>'OPPO '+s),
 ...['Y20','Y21','Y22','Y27','Y28','Y30','Y33s','Y35','Y36','Y55','V21','V23','V25','V27','V29','V30','V40','V50'].map(s=>'vivo '+s),
 ...['7','8','9','10','11','12','13','14','15','16'].flatMap(s=>['OnePlus '+s,'OnePlus '+s+'R']),
 ...['6','7','8','9','10'].flatMap(s=>['Google Pixel '+s,'Google Pixel '+s+' Pro'])
 ]
});
