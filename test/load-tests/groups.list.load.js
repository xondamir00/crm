// test/load-tests/groups.list.load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% requestlar 400ms dan tez bo‘lsin
    http_req_failed: ['rate<0.01'], // HTTP errorlar < 1%
  },
};

const BASE_URL = __ENV.BASE_URL;
const ADMIN_PHONE = __ENV.ADMIN_PHONE;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;

function loginAdmin() {
  const payload = JSON.stringify({
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  const body = safeJson(res);
  return body && body.accessToken ? body.accessToken : null;
}

// JSON’ni xavfsiz parse qilish helper’i
function safeJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export function setup() {
  const accessToken = loginAdmin();
  return { accessToken };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/groups?page=1&limit=50`, {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
  });

  const body = safeJson(res);

  // Agar backend sendagi kabi { meta, items } qaytarsa:
  const items = body && Array.isArray(body.items) ? body.items : [];

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is valid json': () => body !== null,
    'has items array (or empty)': () => Array.isArray(items),
  });

  sleep(1);
}
