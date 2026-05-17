import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const pubClient = createClient({ url: REDIS_URL });
export const subClient = pubClient.duplicate();
export const storeClient = createClient({ url: REDIS_URL }); //Separate client for Yjs doc state storage

pubClient.on('error', (err) => console.error('pubClient error:', err));
subClient.on('error', (err) => console.error('subClient error:', err));
storeClient.on('error', (err) => console.error('storeClient error:', err));

export async function connectRedis(): Promise<void> {
  await Promise.all([pubClient.connect(), subClient.connect(), storeClient.connect()]);
  console.log('Redis Connected successfully');
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([pubClient.quit(), subClient.quit(), storeClient.quit()]);
  console.log('Redis Disconnected');
}

const DOC_KEY_PREFIX = 'collab:doc:';
const DOC_TTL_SECONDS = 60 * 60 * 24 * 7; //7 days

function docKey(fileId: string): string {
  return `${DOC_KEY_PREFIX}${fileId}`;
}

//Save encoded Yjs state as base64 string
export async function saveDocState(fileId: string, state: Uint8Array): Promise<void> {
  const base64 = Buffer.from(state).toString('base64');
  await storeClient.set(docKey(fileId), base64, { EX: DOC_TTL_SECONDS });
}

//Load saved Yjs state
export async function loadDocState(fileId: string): Promise<Uint8Array | null> {
  const base64 = await storeClient.get(docKey(fileId));
  if (!base64) return null;
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export async function deleteDocState(fileId: string): Promise<void> {
  await storeClient.del(docKey(fileId));
}

export async function docStateExists(fileId: string): Promise<boolean> {
  const exists = await storeClient.exists(docKey(fileId));
  return exists === 1;
}
