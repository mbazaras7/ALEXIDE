import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from './db/schema';
import bcrypt from 'bcryptjs';

const client = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'test_user',
  password: process.env.DB_PASSWORD || 'test_password',
  database: process.env.DB_NAME || 'alexide_test',
});

const db = drizzle(client);

async function seedE2E() {
  const hash = await bcrypt.hash('Test1234!', 10);

  await db
    .insert(users)
    .values({
      email: 'student@test.com',
      password: hash,
      role: 'STUDENT',
      name: 'Test Student',
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      email: 'teacher@test.com',
      password: hash,
      role: 'TEACHER',
      name: 'Test Teacher',
    })
    .onConflictDoNothing();

  console.log('E2E users seeded successfully');
  await client.end();
}

seedE2E().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
