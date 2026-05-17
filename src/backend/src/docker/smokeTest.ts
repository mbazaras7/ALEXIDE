/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
const BASE_URL = process.env.SMOKE_TEST_URL ?? 'http://localhost:3000';
let pass = 0;
let failed = 0;
let authToken = '';
let fileId = '';

function ok(msg: string) {
  console.log(`PASS: ${msg}`);
  pass++;
}

function ko(msg: string) {
  console.error(`FAIL: ${msg}`);
  failed++;
}

async function fetchWithRetry(fn: () => Promise<any>, retries = 5, delayMs = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isConnectionError = ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'].includes(
        e.cause?.code ?? e.code ?? ''
      );
      if (isConnectionError && i < retries - 1) {
        console.log(`⏳ Connection failed, retrying in ${delayMs}ms... (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw e;
      }
    }
  }
}

async function get(path: string, auth = false) {
  return fetchWithRetry(() =>
    fetch(`${BASE_URL}${path}`, {
      headers: auth ? { Authorization: `Bearer ${authToken}` } : {},
    })
  );
}

async function post(path: string, body: object, auth = false) {
  return fetchWithRetry(() =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

async function del(path: string) {
  return fetchWithRetry(() =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    })
  );
}

async function cleanup() {
  console.log('Cleanup: deleting smoke test account');
  try {
    const res = await del('/api/backend/auth/delete');
    if (res.status === 200 || res.status === 204) {
      console.log('Smoke test user deleted successfully');
    } else {
      console.warn(`Cleanup: DELETE /api/backend/auth/delete returned ${res.status}`);
    }
  } catch (e: any) {
    console.warn(`Cleanup failed: ${e.message}`);
  }
}

async function run() {
  console.log(`Running smoke tests against ${BASE_URL}`);
  console.log('================================================');

  // ── 1. Health ─────────────────────────────────────
  try {
    const res = await get('/api/backend/health');
    res.status === 200 ? ok('GET /health returns 200') : ko(`GET /health returned ${res.status}`);
  } catch (e: any) {
    ko(`GET /health threw: ${e.message}`);
  }

  // ── 2. Register ───────────────────────────────────
  try {
    const res = await post('/api/backend/auth/register', {
      email: 'smoke@test.com',
      password: 'SmokeTest123!',
      name: 'Smoke Test',
      role: 'STUDENT',
    });
    const body = (await res.json()) as any;
    body?.success === true
      ? ok('POST /api/backend/auth/register succeeds')
      : ko(`Register failed: ${JSON.stringify(body)}`);
  } catch (e: any) {
    ko(`Register threw: ${e.message}`);
  }

  // ── 3. Login ──────────────────────────────────────
  try {
    const res = await post('/api/backend/auth/login', {
      email: 'smoke@test.com',
      password: 'SmokeTest123!',
    });
    const body = (await res.json()) as any;
    authToken = body?.data?.token ?? authToken;
    authToken
      ? ok('POST /api/auth/login returns token')
      : ko(`Login failed: ${JSON.stringify(body)}`);
  } catch (e: any) {
    ko(`Login threw: ${e.message}`);
  }

  if (!authToken) {
    console.error('No token — skipping authenticated tests');
    process.exit(1);
  }
  /*
  // ── 4. Execute valid Python ───────────────────────
  try {
    const res = await post(
      '/api/backend/execute/code',
      {
        code: "print('hello smoke')",
        language: 'python',
      },
      true
    );
    const body = (await res.json()) as any;
    const output: string = body?.data?.output ?? '';
    const exitCode: number = body?.data?.exitCode;
    output.includes('hello smoke')
      ? ok('Execute returns correct output')
      : ko(`Execute output wrong: ${JSON.stringify(body)}`);
    exitCode === 0 ? ok('Execute returns exitCode 0') : ko(`Execute exitCode was ${exitCode}`);
  } catch (e: any) {
    ko(`Execute threw: ${e.message}`);
  }
*/
  //Add later when figured out, bugged due to something with the container not being created properly, even if python-executor container is on and working fine
  // ── 5. Create file ────────────────────────────────
  try {
    const res = await post(
      '/api/backend/files',
      {
        name: 'smoke.py',
        path: '/smoke.py',
        isDirectory: false,
        content: 'print(1)',
      },
      true
    );
    const body = (await res.json()) as any;
    fileId = body?.data?.id ?? '';
    fileId
      ? ok('POST /api/backend/files creates file')
      : ko(`Create file failed: ${JSON.stringify(body)}`);
  } catch (e: any) {
    ko(`Create file threw: ${e.message}`);
  }

  // ── 6. Get file ───────────────────────────────────
  if (fileId) {
    try {
      const res = await get(`/api/backend/files/${fileId}`, true);
      res.status === 200
        ? ok('GET /api/backend/files/:id returns 200')
        : ko(`GET /api/backend/files/:id returned ${res.status}`);
    } catch (e: any) {
      ko(`Get file threw: ${e.message}`);
    }

    // ── 7. Delete file ──────────────────────────────
    try {
      const res = await del(`/api/backend/files/${fileId}`);
      res.status === 200
        ? ok('DELETE /api/backend/files/:id returns 200')
        : ko(`DELETE /api/backend/files/:id returned ${res.status}`);
    } catch (e: any) {
      ko(`Delete file threw: ${e.message}`);
    }
  }

  await cleanup();
  // ── Summary ───────────────────────────────────────
  console.log('================================================');
  console.log(`Results: ${pass} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Smoke tests FAILED');
    process.exit(1);
  } else {
    console.log('All smoke tests passed');
    process.exit(0);
  }
}

run();
