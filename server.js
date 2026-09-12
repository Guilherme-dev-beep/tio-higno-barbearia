const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_JSON_PATH = path.join(ROOT, 'data', 'db.json');
const DB_SQLITE_PATH = path.join(ROOT, 'data', 'tio_higno.sqlite');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};

const database = new DatabaseSync(DB_SQLITE_PATH);

function initDatabase(){
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL,
      icon TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      initials TEXT NOT NULL,
      workDays TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      workPeriods TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      serviceId TEXT NOT NULL,
      barberId TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blockedSlots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      barberId TEXT NOT NULL,
      duration INTEGER NOT NULL,
      reason TEXT NOT NULL
    );
  `);

  const settingsRow = database.prepare('SELECT COUNT(*) AS count FROM settings').get();
  if (!settingsRow.count) {
    const seed = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
    writeDb(seed);
  }
}

function readDb(){
  const settingsRow = database.prepare('SELECT data FROM settings WHERE id = 1').get();
  const settings = settingsRow ? JSON.parse(settingsRow.data) : {};

  const services = database.prepare('SELECT * FROM services ORDER BY name COLLATE NOCASE').all().map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration: Number(s.duration),
    price: Number(s.price),
    icon: s.icon,
    active: Boolean(s.active)
  }));

  const barbers = database.prepare('SELECT * FROM barbers ORDER BY name COLLATE NOCASE').all().map(b => ({
    id: b.id,
    name: b.name,
    role: b.role,
    initials: b.initials,
    workDays: JSON.parse(b.workDays),
    start: b.start,
    end: b.end,
    workPeriods: JSON.parse(b.workPeriods),
    active: Boolean(b.active)
  }));

  const bookings = database.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all().map(b => ({
    id: b.id,
    code: b.code,
    serviceId: b.serviceId,
    barberId: b.barberId,
    date: b.date,
    time: b.time,
    duration: Number(b.duration),
    price: Number(b.price),
    name: b.name,
    phone: b.phone,
    notes: b.notes,
    status: b.status,
    createdAt: b.createdAt
  }));

  const blockedSlots = database.prepare('SELECT * FROM blockedSlots ORDER BY date, time').all().map(b => ({
    id: b.id,
    date: b.date,
    time: b.time,
    barberId: b.barberId,
    duration: Number(b.duration),
    reason: b.reason
  }));

  return { services, barbers, bookings, blockedSlots, settings };
}

function writeDb(db){
  database.exec('BEGIN');
  try {
    database.exec('DELETE FROM settings');
    database.prepare('INSERT INTO settings(id, data) VALUES(1, ?)').run(JSON.stringify(db.settings || {}));

    database.exec('DELETE FROM services');
    const serviceInsert = database.prepare('INSERT INTO services(id, name, description, duration, price, icon, active) VALUES(?, ?, ?, ?, ?, ?, ?)');
    (db.services || []).forEach(s => serviceInsert.run(s.id, s.name, s.description, Number(s.duration), Number(s.price), s.icon, s.active ? 1 : 0));

    database.exec('DELETE FROM barbers');
    const barberInsert = database.prepare('INSERT INTO barbers(id, name, role, initials, workDays, start, end, workPeriods, active) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)');
    (db.barbers || []).forEach(b => barberInsert.run(b.id, b.name, b.role, b.initials, JSON.stringify(b.workDays || []), b.start, b.end, JSON.stringify(b.workPeriods || []), b.active ? 1 : 0));

    database.exec('DELETE FROM bookings');
    const bookingInsert = database.prepare('INSERT INTO bookings(id, code, serviceId, barberId, date, time, duration, price, name, phone, notes, status, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    (db.bookings || []).forEach(b => bookingInsert.run(b.id, b.code, b.serviceId, b.barberId, b.date, b.time, Number(b.duration), Number(b.price), b.name, b.phone, b.notes || '', b.status, b.createdAt));

    database.exec('DELETE FROM blockedSlots');
    const blockedInsert = database.prepare('INSERT INTO blockedSlots(id, date, time, barberId, duration, reason) VALUES(?, ?, ?, ?, ?, ?)');
    (db.blockedSlots || []).forEach(b => blockedInsert.run(b.id, b.date, b.time, b.barberId, Number(b.duration), b.reason || ''));

    database.exec('COMMIT');
  } catch (e) {
    database.exec('ROLLBACK');
    throw e;
  }
}

initDatabase();

const clean = (v='', max=160) => String(v).replace(/[<>]/g,'').trim().slice(0,max);
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d||'');
const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t||'');
const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
const defaultWorkPeriods = [['09:00','11:30'],['13:30','21:00']];
const normalizeWorkPeriods = periods => {
  if (!Array.isArray(periods)) return defaultWorkPeriods.map(p => [p[0], p[1]]);
  const rows = [];
  for (const p of periods) {
    if (!Array.isArray(p) || !validTime(p[0]) || !validTime(p[1])) continue;
    if (toMin(p[1]) <= toMin(p[0])) continue;
    rows.push([String(p[0]), String(p[1])]);
  }
  return rows.length ? rows : defaultWorkPeriods.map(p => [p[0], p[1]]);
};
const availablePeriods = barber => barber.workPeriods || defaultWorkPeriods;
const isAvailable = (barber,time,duration) => availablePeriods(barber).some(([start,end]) => toMin(time)>=toMin(start)&&toMin(time)+Number(duration)<=toMin(end));
const overlaps = (a,da,b,db) => { const a1=toMin(a), b1=toMin(b); return a1 < b1+Number(db) && b1 < a1+Number(da); };
async function sendWhatsAppConfirmation(booking,service,barber,settings){
  if(!settings.whatsappEnabled||!settings.whatsappToken||!settings.whatsappPhoneId)return;
  const phone=String(booking.phone).replace(/\D/g,'');
  const recipient=phone.length===10||phone.length===11?'55'+phone:phone;
  const version=settings.whatsappApiVersion||'v20.0';
  const template=settings.whatsappTemplate||'booking_confirmation';
  const payload={
    messaging_product:'whatsapp',
    to:recipient,
    type:'template',
    template:{
      name:template,
      language:{code:settings.whatsappLanguage||'pt_BR'},
      components:[{type:'body',parameters:[
        {type:'text',text:booking.name},
        {type:'text',text:service.name},
        {type:'text',text:new Date(`${booking.date}T12:00:00`).toLocaleDateString('pt-BR')},
        {type:'text',text:booking.time},
        {type:'text',text:barber.name}
      ]}]
    }
  };
  const response=await fetch(`https://graph.facebook.com/${version}/${settings.whatsappPhoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${settings.whatsappToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw new Error(`WhatsApp API retornou HTTP ${response.status}`);
}

function json(res, status, data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function parseBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>1e6){req.destroy();reject(new Error('Payload muito grande'));}});req.on('end',()=>{if(!body)return resolve({});try{resolve(JSON.parse(body));}catch(e){console.error('JSON parse failed:', body);reject(new Error('JSON inválido'));}});req.on('error',reject);});}
function adminOK(req){return req.headers['x-admin-password']===readDb().settings.adminPassword;}

function scheduleReminder(booking, service, barber, settings){
  const bookingDate = new Date(`${booking.date}T${booking.time}:00`);
  const now = Date.now();
  const target = bookingDate.getTime() - 60 * 60 * 1000;
  const delay = Math.max(0, target - now);

  setTimeout(async () => {
    try {
      await sendWhatsAppMessage({
        to: booking.phone,
        text: `Olá ${booking.name}! Seu horário ${service.name} com ${barber.name} está confirmado para ${booking.date} às ${booking.time}. Faltam 60 minutos para o atendimento. Responda SIM para confirmar ou NÃO para avisar que não poderá ir.`
      }, settings);
    } catch (e) {
      console.error('Falha no lembrete de WhatsApp:', e.message);
    }
  }, delay);
}

async function sendWhatsAppMessage({ to, text }, settings){
  if(!settings.whatsappEnabled || !settings.whatsappToken || !settings.whatsappPhoneId) return;
  const recipient = String(to).replace(/\D/g, '');
  const phone = recipient.length >= 10 ? (recipient.length === 10 ? '55' + recipient : recipient) : recipient;
  const version = settings.whatsappApiVersion || 'v20.0';
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text }
  };

  const response = await fetch(`https://graph.facebook.com/${version}/${settings.whatsappPhoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.whatsappToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if(!response.ok) throw new Error(`WhatsApp API retornou HTTP ${response.status}`);
}

function serveFile(req,res,pathname){let rel=pathname==='/'?'index.html':pathname==='/admin'?'admin.html':pathname.replace(/^\//,'');let file=path.normalize(path.join(PUBLIC,rel));if(!file.startsWith(PUBLIC))return false;if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);return true;}

async function handleApi(req,res,url){
  const p=url.pathname, method=req.method;
  if(method==='GET'&&p==='/api/bootstrap'){
    const db=readDb(),{adminPassword,...settings}=db.settings;return json(res,200,{services:db.services.filter(s=>s.active),barbers:db.barbers.filter(b=>b.active),settings});
  }
  if(method==='GET'&&p==='/api/availability'){
    const date=url.searchParams.get('date'),barberId=url.searchParams.get('barberId'),serviceId=url.searchParams.get('serviceId');
    if(!validDate(date)||!barberId||!serviceId)return json(res,400,{error:'Parâmetros inválidos.'});
    const db=readDb(),barber=db.barbers.find(b=>b.id===barberId&&b.active),service=db.services.find(s=>s.id===serviceId&&s.active);
    if(!barber||!service)return json(res,404,{error:'Barbeiro ou serviço não encontrado.'});
    const day=new Date(`${date}T12:00:00`).getDay();if(!barber.workDays.includes(day))return json(res,200,{slots:[]});
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const nowMinutes = now.getHours()*60 + now.getMinutes();
    let slots=[];
    for(const [start,end] of availablePeriods(barber)){
      for(let t=toMin(start);t+service.duration<=toMin(end);t+=30){
        const time=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
        const slotMinutes = toMin(time);
        const dateIsToday = date === todayIso;
        if(dateIsToday && slotMinutes < nowMinutes) continue;
        const occ=db.bookings.some(b=>b.date===date&&b.barberId===barberId&&b.status!=='cancelled'&&overlaps(time,service.duration,b.time,b.duration));
        const blk=db.blockedSlots.some(b=>b.date===date&&b.barberId===barberId&&overlaps(time,service.duration,b.time,b.duration||30));
        if(!occ&&!blk)slots.push(time)
      }
    }
    return json(res,200,{slots});
  }
  if(method==='POST'&&p==='/api/whatsapp/webhook'){
    const payload = await parseBody(req);
    const messages = payload.entry?.flatMap(e => e.changes || []).flatMap(c => c.value?.messages || []);
    const text = messages?.find(m => m.text)?.text?.body || '';
    const from = messages?.find(m => m.from)?.from || '';
    if(!text || !from) return json(res,400,{error:'Webhook sem mensagem.'});
    const db = readDb();
    const normalized = String(text).trim().toUpperCase();
    const booking = db.bookings.find(b => b.phone && b.phone.replace(/\D/g,'') === String(from).replace(/\D/g,''));
    if(!booking) return json(res,404,{error:'Agendamento não encontrado.'});
    if(normalized.includes('SIM')) booking.status = 'confirmed';
    if(normalized.includes('NAO') || normalized.includes('NÃO')) booking.status = 'cancelled';
    writeDb(db);
    return json(res,200,{ok:true,bookingId:booking.id,status:booking.status});
  }

  if(method==='POST'&&p==='/api/bookings'){
    const x=await parseBody(req);if(!x.serviceId||!x.barberId||!validDate(x.date)||!validTime(x.time)||!clean(x.name,80)||!clean(x.phone,30))return json(res,400,{error:'Preencha os dados obrigatórios corretamente.'});
    const db=readDb(),service=db.services.find(s=>s.id===x.serviceId&&s.active),barber=db.barbers.find(b=>b.id===x.barberId&&b.active);if(!service||!barber)return json(res,404,{error:'Serviço ou barbeiro indisponível.'});if(!barber.workDays.includes(new Date(`${x.date}T12:00:00`).getDay())||!isAvailable(barber,x.time,service.duration))return json(res,409,{error:'Este horário está fora do expediente.'});
    const occ=db.bookings.some(b=>b.date===x.date&&b.barberId===x.barberId&&b.status!=='cancelled'&&overlaps(x.time,service.duration,b.time,b.duration));const blk=db.blockedSlots.some(b=>b.date===x.date&&b.barberId===x.barberId&&overlaps(x.time,service.duration,b.time,b.duration||30));if(occ||blk)return json(res,409,{error:'Este horário acabou de ser ocupado. Escolha outro.'});
    const booking={id:crypto.randomUUID(),code:`TH-${Math.random().toString(36).slice(2,7).toUpperCase()}`,serviceId:x.serviceId,barberId:x.barberId,date:x.date,time:x.time,duration:service.duration,price:service.price,name:clean(x.name,80),phone:clean(x.phone,30),notes:clean(x.notes,240),status:'confirmed',createdAt:new Date().toISOString()};db.bookings.push(booking);writeDb(db);sendWhatsAppConfirmation(booking,service,barber,db.settings).catch(e=>console.error('Falha ao enviar confirmação pelo WhatsApp:',e.message));scheduleReminder(booking, service, barber, db.settings);
    return json(res,201,{booking,service,barber});
  }
  if(method==='POST'&&p==='/api/admin/login'){const x=await parseBody(req),db=readDb();return x.password===db.settings.adminPassword?json(res,200,{ok:true}):json(res,401,{error:'Senha inválida.'});}
  if(p.startsWith('/api/admin/')&&!adminOK(req))return json(res,401,{error:'Senha inválida.'});
  if(method==='GET'&&p==='/api/admin/data'){const db=readDb(),{adminPassword,...settings}=db.settings;return json(res,200,{...db,settings});}
  let m=p.match(/^\/api\/admin\/bookings\/([^/]+)$/);if(method==='PATCH'&&m){const x=await parseBody(req),db=readDb(),b=db.bookings.find(v=>v.id===m[1]);if(!b)return json(res,404,{error:'Agendamento não encontrado.'});if(['confirmed','completed','cancelled'].includes(x.status))b.status=x.status;writeDb(db);return json(res,200,{booking:b});}if(method==='DELETE'&&m){const db=readDb(),index=db.bookings.findIndex(v=>v.id===m[1]);if(index<0)return json(res,404,{error:'Agendamento não encontrado.'});db.bookings.splice(index,1);writeDb(db);return json(res,200,{ok:true});}
  if(method==='POST'&&p==='/api/admin/block'){const x=await parseBody(req);if(!validDate(x.date)||!validTime(x.time)||!x.barberId)return json(res,400,{error:'Dados inválidos.'});const db=readDb(),block={id:crypto.randomUUID(),date:x.date,time:x.time,barberId:x.barberId,duration:Number(x.duration||30),reason:clean(x.reason||'Bloqueado pelo admin',100)};db.blockedSlots.push(block);writeDb(db);return json(res,201,block);}
  m=p.match(/^\/api\/admin\/block\/([^/]+)$/);if(method==='DELETE'&&m){const db=readDb();db.blockedSlots=db.blockedSlots.filter(v=>v.id!==m[1]);writeDb(db);return json(res,200,{ok:true});}
  if(method==='POST'&&p==='/api/admin/services'){const x=await parseBody(req),db=readDb(),s={id:crypto.randomUUID(),name:clean(x.name,80),description:clean(x.description,140),duration:Number(x.duration||30),price:Number(x.price||0),icon:clean(x.icon||'✂️',8),active:true};if(!s.name||s.duration<5||s.price<0)return json(res,400,{error:'Serviço inválido.'});db.services.push(s);writeDb(db);return json(res,201,s);}
  m=p.match(/^\/api\/admin\/services\/([^/]+)$/);if(method==='PATCH'&&m){const x=await parseBody(req),db=readDb(),s=db.services.find(v=>v.id===m[1]);if(!s)return json(res,404,{error:'Serviço não encontrado.'});['name','description','icon'].forEach(k=>{if(x[k]!==undefined)s[k]=clean(x[k],k==='description'?140:80)});['duration','price'].forEach(k=>{if(x[k]!==undefined)s[k]=Number(x[k])});if(x.active!==undefined)s.active=Boolean(x.active);writeDb(db);return json(res,200,s);}
  if(method==='DELETE'&&m){const db=readDb(),hasBookings=db.bookings.some(v=>v.serviceId===m[1]);if(hasBookings)return json(res,409,{error:'Não é possível excluir um serviço com agendamentos. Inative-o em Editar.'});const index=db.services.findIndex(v=>v.id===m[1]);if(index<0)return json(res,404,{error:'Serviço não encontrado.'});db.services.splice(index,1);writeDb(db);return json(res,200,{ok:true});}
  if(method==='POST'&&p==='/api/admin/barbers'){const x=await parseBody(req),db=readDb(),b={id:crypto.randomUUID(),name:clean(x.name,70),role:clean(x.role||'Barbeiro',70),initials:clean(x.initials||'TH',3).toUpperCase(),workDays:Array.isArray(x.workDays)?x.workDays:[1,2,3,4,5,6],start:validTime(x.start)?x.start:'09:00',end:validTime(x.end)?x.end:'21:00',workPeriods:normalizeWorkPeriods(x.workPeriods),active:true};if(!b.name)return json(res,400,{error:'Nome obrigatório.'});db.barbers.push(b);writeDb(db);return json(res,201,b);}
  m=p.match(/^\/api\/admin\/barbers\/([^/]+)$/);if(method==='PATCH'&&m){const x=await parseBody(req),db=readDb(),b=db.barbers.find(v=>v.id===m[1]);if(!b)return json(res,404,{error:'Barbeiro não encontrado.'});['name','role','initials'].forEach(k=>{if(x[k]!==undefined)b[k]=clean(x[k],70)});if(validTime(x.start))b.start=x.start;if(validTime(x.end))b.end=x.end;if(Array.isArray(x.workPeriods))b.workPeriods=normalizeWorkPeriods(x.workPeriods);if(Array.isArray(x.workDays))b.workDays=x.workDays.map(Number);if(x.active!==undefined)b.active=Boolean(x.active);writeDb(db);return json(res,200,b);}
  if(method==='DELETE'&&m){const db=readDb(),hasBookings=db.bookings.some(v=>v.barberId===m[1]);if(hasBookings)return json(res,409,{error:'Não é possível excluir um barbeiro com agendamentos. Inative-o em Editar.'});const index=db.barbers.findIndex(v=>v.id===m[1]);if(index<0)return json(res,404,{error:'Barbeiro não encontrado.'});db.barbers.splice(index,1);writeDb(db);return json(res,200,{ok:true});}
  m=p.match(/^\/api\/admin\/clients\/(.+)$/);if(method==='DELETE'&&m){const phone=decodeURIComponent(m[1]),db=readDb(),before=db.bookings.length;db.bookings=db.bookings.filter(v=>v.phone!==phone);if(before===db.bookings.length)return json(res,404,{error:'Cliente não encontrado.'});writeDb(db);return json(res,200,{ok:true});}
  if(method==='PATCH'&&p==='/api/admin/settings'){const x=await parseBody(req),db=readDb();['businessName','tagline','phone','whatsapp','address','instagram','whatsappPhoneId','whatsappToken','whatsappApiVersion','whatsappTemplate','whatsappLanguage'].forEach(k=>{if(x[k]!==undefined)db.settings[k]=clean(x[k],k==='whatsappToken'?500:120)});if(x.whatsappEnabled!==undefined)db.settings.whatsappEnabled=Boolean(x.whatsappEnabled);if(x.adminPassword&&String(x.adminPassword).length>=4)db.settings.adminPassword=String(x.adminPassword);writeDb(db);return json(res,200,{ok:true});}
  return json(res,404,{error:'Rota não encontrada.'});
}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await handleApi(req,res,url);if(serveFile(req,res,url.pathname))return;res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Página não encontrada');}catch(e){console.error(e);json(res,500,{error:'Erro interno do servidor.'});}});
server.listen(PORT,()=>{console.log(`Tio Higno Barbearia: http://localhost:${PORT}`);console.log(`Admin: http://localhost:${PORT}/admin`);});
