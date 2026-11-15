const frame=document.querySelector('iframe');
const $=s=>document.querySelector(s);
const tick=()=>new Promise(r=>setTimeout(r,120));
async function loaded(){for(let i=0;i<100;i++){if(frame.contentDocument?.querySelector('.dash')){await tick();return;}await tick();}throw Error('Dashboard timeout');}
async function show(theme=$('#theme').value,color=$('#color').value,width=$('#width').value,mode=$('#mode').value,baseline=false){
 frame.height=844;frame.width=width;frame.src=`${baseline?'baseline/':''}qa-frame.html?theme=${theme}&color=${color}&mode=${mode}`;
 await new Promise(r=>frame.onload=r);await loaded();
 frame.height=frame.contentDocument.documentElement.scrollHeight+80;
 $('#status').textContent=`${theme} · ${color} · ${width} px · ${mode}`;
}
$('#show').onclick=()=>show();
$('#test').onclick=async()=>{
 const results=[];
 try{
 for(const theme of ['f1','avion'])for(const color of ['light','dark'])for(const width of [320,390,768,1280]){
  await show(theme,color,width);
  const doc=frame.contentDocument,w=frame.contentWindow;
  const text=doc.querySelector('.gauge-value').textContent;
  const controls=[...doc.querySelectorAll('.dash button,.dash [role="button"]')].filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
  const small=controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.5||r.height<43.5;}).map(el=>el.id||el.className);
  const headings=[...doc.querySelectorAll('.quota-card')].map(el=>el.getBoundingClientRect().height);
  const a=doc.querySelector('[data-quota="ap"]');a.click();await tick();
  const detail=doc.querySelector('[role="dialog"]')?.textContent.includes('Asuntos propios');doc.querySelector('.sheet-close')?.click();await tick();
  results.push({theme,color,width,overflow:doc.documentElement.scrollWidth>width,small,quotaHeights:headings,free:text,detail,svg:doc.querySelectorAll('.inst-dial,.inst-quota').length});
  $('#results').textContent=JSON.stringify(results,null,2);
 }
 const baseline=[];
 for(const theme of ['original','f1','avion'])for(const color of ['light','dark']){
   await show(theme,color,390,'clasico',true);
   const before=frame.contentDocument.querySelector('.dash').outerHTML;
   const styles=Array.from(frame.contentDocument.querySelectorAll('.dash, .dash *')).map(e=>{const s=frame.contentWindow.getComputedStyle(e);return [s.display,s.color,s.backgroundColor,s.fontSize,s.width,s.height].join(';')}).join('\n');
   await show(theme,color,390,'clasico');
   const after=frame.contentDocument.querySelector('.dash').outerHTML;
   const newer=Array.from(frame.contentDocument.querySelectorAll('.dash, .dash *')).map(e=>{const s=frame.contentWindow.getComputedStyle(e);return [s.display,s.color,s.backgroundColor,s.fontSize,s.width,s.height].join(';')}).join('\n');
   baseline.push({theme,color,identicalDOM:before===after,identicalStyles:styles===newer});
 }
 $('#results').textContent=JSON.stringify({matrix:results,baseline},null,2);$('#status').textContent='Verificación terminada';
 }catch(e){$('#status').textContent=e.message;}
};
show();
const actions=document.createElement('button');actions.textContent='Verificar acciones';actions.id='actions';document.querySelector('header').append(actions);
actions.onclick=async()=>{
 const out={};
 try{
 await show('f1','dark',390);
 const w=frame.contentWindow,doc=frame.contentDocument;
 const {Actions,getState}=w.qaModules;
 const original=getState();
 const choose=(selector,value)=>{const el=doc.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 Actions.setScreen('settings');await tick();doc.querySelector('[data-section="look"]').open=true;
 choose('#dashboard-mode','instrumental');choose('#visual-theme','original');Actions.setScreen('dashboard');await tick();
 out.unsupportedFallback=!doc.querySelector('.dash-instrumental') && w.localStorage.getItem('calguard-dashboard')==='instrumental';
 Actions.setScreen('settings');await tick();choose('#visual-theme','avion');Actions.setScreen('dashboard');await tick();out.recovered=!!doc.querySelector('.inst-avion');
 for(const selector of ['[data-quota="ap"]','[data-quota="vac"]','[data-guard]','#dash-comps']){
  doc.querySelector(selector).click();await tick();out[selector]=doc.querySelectorAll('[role="dialog"]').length===1;doc.querySelector('.sheet-close')?.click();await tick();
 }
 doc.querySelector('[data-quota="ap"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();out.keyboard=!!doc.querySelector('[role="dialog"]');doc.querySelector('.sheet-close')?.click();await tick();
 doc.querySelector('.ws-day').click();await tick();out.weekNavigation=getState().currentScreen==='calendar';Actions.setScreen('dashboard');await tick();
 for(const selector of ['#dash-pedir','[data-pedir="ap"]','[data-pedir="vac"]']){doc.querySelector(selector).click();await tick();out[selector]=getState().currentScreen==='calendar'||!!doc.querySelector('[role="dialog"]');doc.querySelector('.sheet-close')?.click();await tick();Actions.setScreen('dashboard');await tick();}
 Actions.setData({days:[],ledger:[],services:[]});await tick();out.empty=doc.querySelector('.inst-next').textContent.includes('Sin guardias previstas');
 Actions.setData({days:[],ledger:[{kind:'DEBIT',category:'LIBRE',amount:3,dateISO:'2026-11-22'}],services:[]});await tick();out.negative=doc.querySelector('.gauge-value').textContent==='-3';
 Actions.setData({days:original.days,ledger:original.ledger,services:original.services});Actions.setScreen('dashboard');await tick();
 out.cachedAssets=await w.caches.open('calguard-v64').then(async c=>{const keys=await c.keys();return keys.length;});
 $('#results').textContent=JSON.stringify(out,null,2);$('#status').textContent='Acciones verificadas';
 }catch(e){$('#results').textContent=JSON.stringify(out,null,2)+'\n'+e.stack;}
};
