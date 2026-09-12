const state = { data:null, step:1, service:null, barber:null, date:null, time:null, client:{}, success:null };
const $ = s => document.querySelector(s);
const body = $('#bookingBody'), next = $('#nextBtn'), back = $('#backBtn');
const brl = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

async function api(url, options={}) { const r = await fetch(url, options); const j = await r.json(); if(!r.ok) throw new Error(j.error||'Erro inesperado'); return j; }
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}

async function init(){
  state.data = await api('/api/bootstrap');
  renderServices(); renderBooking(); bindSettings(); setupReveal();
}
function bindSettings(){const s=state.data.settings; $('#footerPhone').textContent=s.phone; $('#footerPhone').href='tel:'+s.phone.replace(/\D/g,''); $('#footerInstagram').textContent=s.instagram; $('#footerAddress').textContent=s.address; $('#whatsappBtn').href=`https://wa.me/${s.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site da Tio Higno Barbearia.')}`}
function renderServices(){ $('#serviceGrid').innerHTML=state.data.services.map(s=>`<article class="service-card reveal"><span class="service-icon">${s.icon}</span><h3>${s.name}</h3><p>${s.description}</p><div class="service-meta"><small>${s.duration} min</small><strong>${brl(s.price)}</strong></div></article>`).join('') }
function setupReveal(){ const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08}); document.querySelectorAll('.reveal').forEach(e=>io.observe(e)); }

function setChoice(type,val){state[type]=val; if(type==='service'){state.barber=null;state.date=null;state.time=null} if(type==='barber'){state.date=null;state.time=null} renderBooking()}
function stepTitle(){return ['','Escolha um serviço','Escolha o barbeiro','Escolha data e horário','Seus dados','Confirme seu horário'][state.step]}
function renderBooking(){
  const bookingBody = $('#bookingBody');
  bookingBody.classList.add('is-updating');
  requestAnimationFrame(() => {
    $('#stepTitle').textContent=state.success?'Agendamento confirmado!':stepTitle(); $('#stepCounter').textContent=state.success?'✓':`${state.step} / 5`; $('#progressBar').style.width=state.success?'100%':`${state.step*20}%`;
    back.classList.toggle('hidden',state.step===1||!!state.success);
    next.classList.toggle('hidden',!!state.success);
    if(state.success){renderSuccess();}
    else {
      if(state.step===1) renderStep1(); if(state.step===2) renderStep2(); if(state.step===3) renderStep3(); if(state.step===4) renderStep4(); if(state.step===5) renderStep5();
    }
    validateNext();
    requestAnimationFrame(() => bookingBody.classList.remove('is-updating'));
  });
}
function renderStep1(){body.innerHTML=`<div class="choice-grid">${state.data.services.map(s=>`<button class="choice ${state.service?.id===s.id?'active':''}" data-service="${s.id}"><div class="icon">${s.icon}</div><b>${s.name}</b><small>${s.duration} min • ${s.description}</small><div class="price">${brl(s.price)}</div></button>`).join('')}</div>`; body.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>setChoice('service',state.data.services.find(s=>s.id===b.dataset.service)))}
function renderStep2(){body.innerHTML=`<div class="choice-grid">${state.data.barbers.map(b=>`<button class="choice ${state.barber?.id===b.id?'active':''}" data-barber="${b.id}"><div class="barber-choice"><div class="barber-avatar">${b.initials}</div><div><b>${b.name}</b><small>${b.role}</small></div></div></button>`).join('')}</div>`; body.querySelectorAll('[data-barber]').forEach(el=>el.onclick=()=>setChoice('barber',state.data.barbers.find(b=>b.id===el.dataset.barber)))}
function getDates(){let a=[]; let d=new Date(); for(let i=0;i<10;i++){let x=new Date(d);x.setDate(d.getDate()+i);a.push(x)}return a}
function isoLocal(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
async function renderStep3(){
 const dates=getDates(); body.innerHTML=`<div class="date-row">${dates.slice(0,4).map(d=>dateBtn(d)).join('')}</div><div id="moreDates" class="date-row">${dates.slice(4,8).map(d=>dateBtn(d)).join('')}</div><p style="font-size:11px;color:var(--muted);margin:4px 0 12px">Horários disponíveis</p><div class="slots" id="slots"><small style="color:var(--muted);grid-column:1/-1">Escolha uma data para ver os horários.</small></div>`;
 body.querySelectorAll('[data-date]').forEach(el=>el.onclick=async()=>{state.date=el.dataset.date;state.time=null;renderBooking(); await loadSlots()});
 if(state.date) await loadSlots();
}
function dateBtn(d){const iso=isoLocal(d),days=['dom','seg','ter','qua','qui','sex','sáb'];return `<button class="date-btn ${state.date===iso?'active':''}" data-date="${iso}"><small>${days[d.getDay()]}</small><b>${d.getDate()}</b></button>`}
async function loadSlots(){const slots=$('#slots'); if(!slots)return; slots.innerHTML='<small style="color:var(--muted);grid-column:1/-1">Carregando...</small>'; try{const r=await api(`/api/availability?date=${state.date}&barberId=${state.barber.id}&serviceId=${state.service.id}`); slots.innerHTML=r.slots.length?r.slots.map(t=>`<button class="slot ${state.time===t?'active':''}" data-time="${t}">${t}</button>`).join(''):'<small style="color:var(--muted);grid-column:1/-1">Sem horários disponíveis nesta data.</small>'; slots.querySelectorAll('[data-time]').forEach(el=>el.onclick=()=>{state.time=el.dataset.time;renderBooking()});}catch(e){toast(e.message)} validateNext()}
function renderStep4(){body.innerHTML=`<div class="form-grid"><div class="field"><label>SEU NOME *</label><input id="clientName" value="${state.client.name||''}" placeholder="Ex.: Guilherme Silva"></div><div class="field"><label>WHATSAPP *</label><input id="clientPhone" value="${state.client.phone||''}" placeholder="(64) 99999-9999"></div><div class="field"><label>OBSERVAÇÃO</label><textarea id="clientNotes" rows="3" placeholder="Alguma preferência?">${state.client.notes||''}</textarea></div></div>`; ['Name','Phone','Notes'].forEach(k=>$('#client'+k).oninput=e=>{state.client[k.toLowerCase()]=e.target.value;validateNext()})}
function renderStep5(){const d=new Date(state.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});body.innerHTML=`<div class="summary-box"><div class="summary-row"><span>Serviço</span><b>${state.service.name}</b></div><div class="summary-row"><span>Profissional</span><b>${state.barber.name}</b></div><div class="summary-row"><span>Data</span><b style="text-transform:capitalize">${d}</b></div><div class="summary-row"><span>Horário</span><b>${state.time}</b></div><div class="summary-row"><span>Duração</span><b>${state.service.duration} min</b></div><div class="summary-row"><span>Valor</span><b style="color:var(--gold2)">${brl(state.service.price)}</b></div></div><p style="font-size:11px;color:var(--muted);margin-top:15px">Ao confirmar, seu horário será reservado imediatamente.</p>`; next.textContent='Confirmar agendamento ✓'}
function renderSuccess(){const b=state.success.booking; body.innerHTML=`<div class="success"><div class="success-icon">✓</div><h3>Horário reservado!</h3><p>Pronto, ${b.name.split(' ')[0]}. Seu atendimento com <b>${state.success.barber.name}</b> está confirmado.</p><div class="booking-code">Código: <b>${b.code}</b></div><p style="font-size:12px">${new Date(b.date+'T12:00').toLocaleDateString('pt-BR')} às ${b.time} • ${state.success.service.name}</p><button class="btn btn-ghost" id="newBooking" style="margin-top:10px">Fazer outro agendamento</button></div>`; $('#newBooking').onclick=()=>{Object.assign(state,{step:1,service:null,barber:null,date:null,time:null,client:{},success:null});next.textContent='Continuar →';renderBooking()}}
function validateNext(){let ok=false;if(state.step===1)ok=!!state.service;if(state.step===2)ok=!!state.barber;if(state.step===3)ok=!!state.date&&!!state.time;if(state.step===4)ok=(state.client.name||'').trim().length>1&&(state.client.phone||'').replace(/\D/g,'').length>=8;if(state.step===5)ok=true;next.disabled=!ok;if(state.step!==5)next.textContent='Continuar →'}
next.onclick=async()=>{if(next.disabled)return;if(state.step<5){state.step++;renderBooking();return} next.disabled=true;next.textContent='Confirmando...';try{state.success=await api('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId:state.service.id,barberId:state.barber.id,date:state.date,time:state.time,name:state.client.name,phone:state.client.phone,notes:state.client.notes})});renderBooking()}catch(e){toast(e.message);next.disabled=false;next.textContent='Confirmar agendamento ✓'}};
back.onclick=()=>{if(state.step>1){state.step--;renderBooking()}};
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{}));
init().catch(e=>{console.error(e);toast('Não foi possível carregar o site.')});
