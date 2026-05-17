import { db } from '../db';
import { users } from '../db/schema';
import { count } from 'drizzle-orm';

export const testDatabaseConnection = async () => {
  try {
    //Count users
    const result = await db.select({ count: count() }).from(users);
    const userCount = result[0].count;

    console.log(`Database test successful! User count: ${userCount}`);
    return true;
  } catch (error) {
    console.error('Database test failed:', error);
    return false;
  }
};
