import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = 'your-super-secret-jwt-key-change-this';
const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/stats',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
        const json = JSON.parse(data);
        console.log('Body:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.log('Body (raw):', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
