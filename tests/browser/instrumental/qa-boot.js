
 const {put,STORES,openDB}=await import(new URL('./js/persistence/db.js',location.href).href);
 await openDB();
 await put(STORES.PROFILES,{id:'qa',name:'Perfil de prueba',role:'usuario',createdAt:'2026-01-01',settings:{}});
 await put(STORES.CONFIG,{key:'lastProfileId',value:'qa'});
 await put(STORES.CONFIG,{key:'themePreference',value:qaParams.get('color') || 'dark'});
 const days=[['2026-11-16','GUARDIA_PLAN'],['2026-11-17','GUARDIA_PLAN'],['2026-11-18','GUARDIA_PLAN'],['2026-11-19','GUARDIA_PLAN'],['2026-11-20','GUARDIA_PLAN'],['2026-11-15','TURNO_M'],['2026-11-25','AP'],['2026-07-01','AP'],['2026-08-03','VACACIONES'],['2026-08-04','VACACIONES'],['2026-12-01','VACACIONES']];
 for(const [dateISO,type] of days)await put(STORES.DAYS,{profileId:'qa',dateISO,tags:[{type}]});
 for(const [i,dateISO] of ['2026-05-04','2026-06-01','2026-10-12','2026-11-16','2026-12-21'].entries())await put(STORES.LEDGER,{id:'credit'+i,profileId:'qa',kind:'CREDIT',category:'GUARDIA',amount:5,dateISO,ref:'guardia:'+dateISO});
 for(const [i,dateISO] of ['2026-05-12','2026-07-02','2026-11-24'].entries())await put(STORES.LEDGER,{id:'debit'+i,profileId:'qa',kind:'DEBIT',category:'LIBRE',amount:1,dateISO});

await import(new URL('./js/app.js',location.href).href);

window.qaModules=await import(new URL('./js/state/store.js',location.href).href);
