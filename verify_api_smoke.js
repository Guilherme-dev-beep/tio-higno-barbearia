const http = require('http');

const port = Number(process.env.PORT || 3000);
const host = process.env.API_HOST || 'localhost';

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = http.request({
      host,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, response => {
      let output = '';
      response.on('data', chunk => output += chunk);
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, data: output ? JSON.parse(output) : {} });
        } catch {
          resolve({ status: response.statusCode, raw: output });
        }
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

(async function main() {
  const bootstrap = await request('GET', '/api/bootstrap');
  console.log('bootstrap', bootstrap.status, Array.isArray(bootstrap.data.services) ? 'ok' : 'invalid');
  if (bootstrap.status !== 200 || !Array.isArray(bootstrap.data.services) || !Array.isArray(bootstrap.data.barbers)) process.exitCode = 1;

  const sensitiveKeys = Object.keys(bootstrap.data.settings || {}).filter(key => /password|token|recoveryCode|recoveryPhone/i.test(key));
  console.log('publicSensitiveFields', sensitiveKeys.length ? 'exposed' : 'hidden');
  if (sensitiveKeys.length) process.exitCode = 1;

  const invalidAvailability = await request('GET', '/api/availability?date=2026-99-99&barberId=missing&serviceId=missing');
  console.log('invalidAvailability', invalidAvailability.status);
  if (invalidAvailability.status !== 400) process.exitCode = 1;

  const invalidBooking = await request('POST', '/api/bookings', {}, {
    serviceId: 'missing', barberId: 'missing', date: '2026-99-99', time: '99:99', name: '', phone: ''
  });
  console.log('invalidBooking', invalidBooking.status);
  if (invalidBooking.status !== 400) process.exitCode = 1;

  const protectedAdmin = await request('GET', '/api/admin/data');
  console.log('adminProtection', protectedAdmin.status);
  if (protectedAdmin.status !== 401) process.exitCode = 1;
})();
