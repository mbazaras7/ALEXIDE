import { defineConfig } from 'drizzle-kit';

console.log('===== DRIZZLE CONFIG DEBUG =====');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('================================');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'alexide_user',
    password: process.env.DB_PASSWORD || 'alexide_password',
    database: process.env.DB_NAME || 'alexide_dev',
  },
  verbose: true
});
