const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const port = 3110;
const databasePath = path.join(root, 'data', 'test-hardening.sqlite');
const sourceDatabase = path.join(root, 'data', 'tio_higno.sqlite');
const metaSecret = 'test-meta-secret';

function request(method, requestPath, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = http.request({
      host: '127.0.0.1', port, path: requestPath, method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
    }, response => {
      let output = '';
      response.on('data', chunk => output += chunk);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data: output ? JSON.parse(output) : {} }));
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function cookieFrom(response) {
  const value = response.headers['set-cookie']?.[0] || '';
  return value.split(';')[0];
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 10000);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes(`localhost:${port}`)) { clearTimeout(timeout); resolve(); }
    });
    child.on('error', reject);
  });
}

async function main() {
  fs.copyFileSync(sourceDatabase, databasePath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, META_APP_SECRET: metaSecret, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await waitForServer(child);
    const noSession = await request('GET', '/api/admin/data');
    assert.strictEqual(noSession.status, 401, 'endpoint admin deve exigir sessão');

    const login = await request('POST', '/api/admin/login', {}, { password: 'Barber12' });
    assert.strictEqual(login.status, 200, 'login válido deve responder 200');
    const cookie = cookieFrom(login);
    assert.ok(cookie.includes('th_admin_session='), 'login deve criar cookie de sessão');
    assert.ok(!cookie.includes('HttpOnly') || login.headers['set-cookie'][0].includes('HttpOnly'), 'cookie deve ser HttpOnly');
    assert.ok(login.headers['set-cookie'][0].includes('Secure'), 'cookie deve ser Secure em produção');

    const withSession = await request('GET', '/api/admin/data', { Cookie: cookie });
    assert.strictEqual(withSession.status, 200, 'sessão deve liberar endpoint admin');
    const logout = await request('POST', '/api/admin/logout', { Cookie: cookie });
    assert.strictEqual(logout.status, 200, 'logout deve responder 200');
    const afterLogout = await request('GET', '/api/admin/data', { Cookie: cookie });
    assert.strictEqual(afterLogout.status, 401, 'sessão invalidada não deve liberar endpoint');

    const bootstrap = await request('GET', '/api/bootstrap');
    const service = bootstrap.data.services[0];
    const barber = bootstrap.data.barbers[0];
    const body = { serviceId: service.id, barberId: barber.id, date: '2026-09-16', time: '09:00', name: 'Teste Hardening', phone: '64990000000', notes: '' };
    const [first, second] = await Promise.all([request('POST', '/api/bookings', {}, body), request('POST', '/api/bookings', {}, body)]);
    assert.deepStrictEqual([first.status, second.status].sort(), [201, 409], 'concorrência deve aceitar somente um agendamento');

    const invalidDate = await request('POST', '/api/bookings', {}, { ...body, date: '2026-99-99' });
    assert.strictEqual(invalidDate.status, 400, 'data inválida deve ser rejeitada');

    const invalidWebhook = await request('POST', '/api/whatsapp/webhook', {}, { entry: [] });
    assert.strictEqual(invalidWebhook.status, 401, 'webhook sem assinatura deve ser rejeitado');
    const wrongWebhook = await request('POST', '/api/whatsapp/webhook', { 'X-Hub-Signature-256': 'sha256=invalid' }, { entry: [] });
    assert.strictEqual(wrongWebhook.status, 401, 'webhook com assinatura inválida deve ser rejeitado');
    const validWebhookPayload = { entry: [] };
    const validWebhookSignature = `sha256=${crypto.createHmac('sha256', metaSecret).update(JSON.stringify(validWebhookPayload)).digest('hex')}`;
    const validWebhook = await request('POST', '/api/whatsapp/webhook', { 'X-Hub-Signature-256': validWebhookSignature }, validWebhookPayload);
    assert.strictEqual(validWebhook.status, 400, 'webhook assinado deve passar a validação de assinatura');

    console.log('hardening tests: ok');
  } finally {
    child.kill();
    try { fs.rmSync(databasePath, { force: true }); } catch {}
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
