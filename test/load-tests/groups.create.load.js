import http from 'k6/http';
import { check, sleep } from 'k6';

// 20 VU, 10s davomida, jami ~1000 ta request
export const options = {
  scenarios: {
    create_groups: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // 1% dan kam failure bo‘lishi kerak
    http_req_duration: ['p(95)<800'], // 95% request < 800ms
  },
};

const BASE_URL = __ENV.BASE_URL;
const ADMIN_PHONE = __ENV.ADMIN_PHONE;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      phone: ADMIN_PHONE,
      password: ADMIN_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(res, {
    'login status 200': (r) => r.status === 200,
  });

  const body = res.json();
  return { accessToken: body.accessToken };
}

export default function (data) {
  const token = data.accessToken;

  // HAR BIR REQUEST UCHUN UNIQUE NOM
  const name = `load-group-${__VU}-${__ITER}`; // 20 VU * 50 iter = 1000ta unik nom

  const payload = {
    name,
    capacity: 10,
    daysPattern: 'ODD',
    startTime: '09:00',
    endTime: '10:30',
    monthlyFee: 250000,
    roomId: null, // room ixtiyoriy, hozir tekshiruvdan qochish uchun null
  };

  const res = http.post(`${BASE_URL}/groups`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'group created 201': (r) => r.status === 201,
  });

  sleep(0.1);
}
