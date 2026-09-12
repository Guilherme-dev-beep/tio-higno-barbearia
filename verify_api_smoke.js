const http = require('http');

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      host: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try {
          const data = out ? JSON.parse(out) : {};
          resolve({ status: res.statusCode, data });
        } catch (e) {
          resolve({ status: res.statusCode, raw: out });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async function main() {
  const b = await request('GET', '/api/bootstrap');
  console.log('bootstrap', b.status, Array.isArray(b.data.services) ? b.data.services.length : 'bad');

  const date = '2026-09-16';
  const availability = await request('GET', `/api/availability?date=${date}&barberId=barber-higno&serviceId=svc-cut`);
  console.log('availability', availability.status, Array.isArray(availability.data.slots) ? availability.data.slots.length : 'bad');

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const todaysAvailability = await request('GET', `/api/availability?date=${todayIso}&barberId=barber-higno&serviceId=svc-cut`);
  const pastTodaySlots = Array.isArray(todaysAvailability.data.slots) ? todaysAvailability.data.slots.filter(slot => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m < nowMinutes;
  }) : [];
  if (pastTodaySlots.length) {
    console.log('expiredSameDaySlotsVisible', pastTodaySlots.length);
    process.exitCode = 1;
  } else {
    console.log('expiredSameDaySlotsVisible', 0);
  }

  const firstSlot = availability.data.slots && availability.data.slots[0];
  const booking = await request('POST', '/api/bookings', {}, {
    serviceId: 'svc-cut', barberId: 'barber-higno', date, time: firstSlot || '09:00', name: 'Teste', phone: '64999999999', notes: ''
  });
  console.log('booking', booking.status, booking.data.booking ? booking.data.booking.id : booking.data.error);

  const password = 'Barber12';

  const login = await request('POST', '/api/admin/login', {}, { password });
  console.log('login', login.status, login.data.ok ? 'ok' : login.data.error);

  const adminData = await request('GET', '/api/admin/data', { 'x-admin-password': password });
  console.log('adminData', adminData.status, Array.isArray(adminData.data.services) ? adminData.data.services.length : 'bad');

  const serviceCreate = await request('POST', '/api/admin/services', { 'x-admin-password': password }, {
    name: 'Serviço teste', description: 'Teste', duration: 30, price: 50, icon: '★'
  });
  console.log('serviceCreate', serviceCreate.status, serviceCreate.data.id || serviceCreate.data.error);

  const blockCreate = await request('POST', '/api/admin/block', { 'x-admin-password': password }, {
    date: '2026-09-16', time: '10:00', barberId: 'barber-higno', duration: 30, reason: 'Bloqueio teste'
  });
  console.log('blockCreate', blockCreate.status, blockCreate.data.id || blockCreate.data.error);

  const serviceDelete = await request('DELETE', '/api/admin/services/' + serviceCreate.data.id, { 'x-admin-password': password });
  console.log('serviceDelete', serviceDelete.status, serviceDelete.data);

  const blockDelete = await request('DELETE', '/api/admin/block/' + blockCreate.data.id, { 'x-admin-password': password });
  console.log('blockDelete', blockDelete.status, blockDelete.data);

  const webhook = await request('POST', '/api/whatsapp/webhook', {}, {
    entry: [{
      changes: [{
        value: {
          contacts: [{ wa_id: '64999999999' }],
          messages: [{ from: '64999999999', text: { body: 'SIM' } }]
        }
      }]
    }]
  });
  console.log('webhook', webhook.status, webhook.data.ok ? 'ok' : webhook.data.error);
})();
