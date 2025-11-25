import http from 'k6/http';
import { check, sleep } from 'k6';

// Env parametrlar
const BASE_URL = `${__ENV.BASE_URL || 'http://localhost:3000'}`;
const ADMIN_PHONE = __ENV.ADMIN_PHONE || '+998900000000';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin@12345';

// 🚀 KATTA STRESS TEST UCHUN OPTIONS
export const options = {
  scenarios: {
    login_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Sekin-sekin qizdiramiz
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 200 }, // maksimal bosim
        { duration: '2m', target: 0 }, // asta sovutamiz
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // 95% so'rov 400ms ichida bo'lsin
    http_req_duration: ['p(95)<400'],
    // xatoliklar 1% dan kam bo'lsin
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has accessToken': (r) => {
      try {
        const body = r.json();
        return !!body.accessToken;
      } catch (e) {
        return false;
      }
    },
  });

  // biroz pauza, real foydalanuvchiga o‘xshash bo‘lsin
  sleep(0.3);
}
