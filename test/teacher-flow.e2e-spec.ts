// test/teacher-flow.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Teacher flow (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let teacherAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Agar main.ts da global pipes/filters ishlatsang, shu yerga ham qo‘sh:
    //
    //

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('TEACHER login qilishi kerak (POST /auth/login)', async () => {
    const res = await request(httpServer)
      .post('/auth/login')
      .send({
        phone: '+998903383030',
        password: 'Secret@123',
      })
      .expect(201); // sende login 201 qaytarayaptimi yoki 200? kerak bo'lsa shu yerini o'zgartir

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('TEACHER');

    teacherAccessToken = res.body.accessToken;
  });

  it('TEACHER faqat o`z guruhlarini ko`rishi kerak (GET /teachers/my-groups)', async () => {
    const res = await request(httpServer)
      .get('/teachers/my-groups')
      .set('Authorization', `Bearer ${teacherAccessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const g = res.body[0];
      expect(g).toHaveProperty('groupId');
      expect(g).toHaveProperty('groupName');
      expect(g).toHaveProperty('role');
    }
  });
});
