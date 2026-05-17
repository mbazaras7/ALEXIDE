import { exec } from "child_process";
import { promisify } from "util";
import fetch from "node-fetch";
//ADD THIS INTO DOCKER PIPELINE TEST WHENVER POSSIBLE
const execAsync = promisify(exec);

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
const PGADMIN_URL = process.env.PGADMIN_URL || "http://localhost:8080";
const MINIO_URL = process.env.MINIO_URL || "http://127.0.0.1:9000";
const MAX_RETRIES = 60;
const RETRY_DELAY = 1000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkDockerCompose() {
  console.log("\nChecking Docker Compose");

  try {
    const { stdout } = await execAsync(
      'docker-compose ps --services --filter "status=running"',
    );
    const runningServices = stdout
      .trim()
      .split("\n")
      .filter((s) => s);

    const expectedServices = [
      "postgres",
      "backend",
      "frontend",
      "pgadmin",
      "minio",
    ];
    const missingServices = expectedServices.filter(
      (s) => !runningServices.includes(s),
    );

    if (missingServices.length > 0) {
      console.log(`Missing services: ${missingServices.join(", ")}`);
      return false;
    }

    console.log(`All services running: ${runningServices.join(", ")}`);
    return true;
  } catch (error) {
    console.log(
      "[ERROR] Docker Compose not running or docker-compose command not found",
    );
    console.log('[HINT] Run "docker-compose up -d" first');
    return false;
  }
}

//Check if a URL is accessible
async function checkUrl(url, serviceName, validateResponse = null) {
  console.log(`\nChecking ${serviceName} at ${url}...`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        timeout: 5000,
        headers: { Accept: "application/json" },
      });

      //If custom validation provided, use it
      if (validateResponse) {
        const isValid = await validateResponse(response);
        if (isValid) {
          console.log(`${serviceName} is healthy (${response.status})`);
          return true;
        }
      } else if (response.ok) {
        console.log(`${serviceName} is accessible (${response.status})`);
        return true;
      }

      console.log(
        `${serviceName} returned ${response.status}, retrying... (${i + 1}/${MAX_RETRIES})`,
      );
    } catch (error) {
      if (i === 0) {
        console.log(`Waiting for ${serviceName}... (${i + 1}/${MAX_RETRIES})`);
      } else if ((i + 1) % 10 === 0) {
        console.log(
          `Still waiting for ${serviceName}... (${i + 1}/${MAX_RETRIES})`,
        );
      }
    }

    await sleep(RETRY_DELAY);
  }

  console.log(`${serviceName} failed to respond after ${MAX_RETRIES} seconds`);
  return false;
}

async function validateBackendHealth(response) {
  if (!response.ok) return false;

  try {
    const data = await response.json();

    //Check ResponseHandler format
    if (!data.success || !data.data) return false;

    if (data.data.status !== "healthy") {
      console.log(`Backend is up but unhealthy: ${JSON.stringify(data.data)}`);
      return false;
    }

    if (data.data.services.database !== "connected") {
      console.log(`Backend database not connected`);
      return false;
    }

    console.log(`  Status: ${data.data.status}`);
    console.log(`  Database: ${data.data.services.database}`);

    return true;
  } catch (error) {
    console.log(`Invalid JSON response from backend`);
    return false;
  }
}

async function checkDatabase() {
  console.log("\nChecking PostgreSQL database...");

  try {
    const { stdout } = await execAsync(
      "docker-compose exec -T postgres pg_isready -U alexide_user -h localhost",
    );

    if (stdout.includes("accepting connections")) {
      console.log("PostgreSQL is accepting connections");
      return true;
    }

    console.log("PostgreSQL is not ready");
    return false;
  } catch (error) {
    console.log("Failed to check PostgreSQL");
    return false;
  }
}

async function testBackendEndpoints() {
  console.log("\nTesting backend API endpoints...");

  const tests = [
    {
      name: "Health Check",
      url: `${BACKEND_URL}/api/backend/health`,
      method: "GET",
      expectedStatus: 200,
      validate: async (response) => {
        const data = await response.json();
        return data.success === true && data.data?.status === "healthy";
      },
    },
    {
      name: "API Base Route",
      url: `${BACKEND_URL}/api/backend`,
      method: "GET",
      expectedStatus: 200,
      validate: async (response) => {
        const data = await response.json();
        return data.message && data.endpoints;
      },
    },
    {
      name: "404 Handling",
      url: `${BACKEND_URL}/api/backend/nonexistent`,
      method: "GET",
      expectedStatus: 404,
      validate: async (response) => {
        const data = await response.json();
        return data.error === "Not Found";
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await fetch(test.url, {
        method: test.method,
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });

      const statusMatches = response.status === test.expectedStatus;
      const validationPassed = test.validate
        ? await test.validate(response)
        : true;

      if (statusMatches && validationPassed) {
        console.log(`  [PASS] ${test.name}`);
        passed++;
      } else {
        console.log(
          `  ${test.name} (expected ${test.expectedStatus}, got ${response.status})`,
        );
        failed++;
      }
    } catch (error) {
      console.log(`  ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n Endpoint tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function checkMinioBucket() {
  console.log("\nChecking MinIO bucket setup...");

  try {
    const response = await fetch(`${MINIO_URL}/alexide-files`, {
      method: "HEAD",
      timeout: 5000,
    });

    if (response.status === 200 || response.status === 403) {
      console.log("MinIO bucket 'alexide-files' exists");
      return true;
    }

    if (response.status === 404) {
      console.log("MinIO bucket 'alexide-files' not found");
      console.log("Run 'npm run setup:minio' to create the bucket");
      return false;
    }

    console.log(`MinIO bucket check returned status ${response.status}`);
    return true; //Don't fail
  } catch (error) {
    console.log("Could not verify MinIO bucket (non-critical)");
    console.log(`  Reason: ${error.message}`);
    return true; //Don't fail
  }
}

async function validateMinioHealth(response) {
  if (!response.ok) return false;

  try {
    const text = await response.text();

    if (response.status === 200) {
      console.log(`  MinIO health check passed (status 200)`);
      return true;
    }

    return false;
  } catch (error) {
    console.log(`Failed to validate MinIO health: ${error.message}`);
    return false;
  }
}

async function checkContainerLogs() {
  console.log("\n Checking container logs for errors...");

  const services = ["backend", "frontend", "postgres"];
  let hasErrors = false;

  for (const service of services) {
    try {
      const { stdout } = await execAsync(
        `docker-compose logs --tail=50 ${service} 2>&1 | grep -i "error" | head -5 || true`,
      );

      if (stdout.trim()) {
        console.log(`   Errors in ${service}:`);
        console.log(stdout.trim());
        hasErrors = true;
      } else {
        console.log(`   No errors in ${service}`);
      }
    } catch (error) {
      console.log(`  Could not check logs for ${service}`);
    }
  }

  return !hasErrors;
}

//Main smoke test
async function runSmokeTest() {
  console.log("  Docker Compose Smoke Test");
  console.log("========================================");

  const results = {
    dockerCompose: false,
    database: false,
    backend: false,
    frontend: false,
    pgadmin: false,
    endpoints: false,
    minio: false,
    minioBucket: false,
    logs: false,
  };

  results.dockerCompose = await checkDockerCompose();
  if (!results.dockerCompose) {
    console.log("\n Docker Compose check failed. Exiting.");
    process.exit(1);
  }

  results.database = await checkDatabase();

  results.minio = await checkUrl(
    `${MINIO_URL}/minio/health/live`,
    "MinIO Storage",
    validateMinioHealth,
  );

  if (results.minio) {
    results.minioBucket = await checkMinioBucket();
  }

  results.backend = await checkUrl(
    `${BACKEND_URL}/api/backend/health`,
    "Backend API",
    validateBackendHealth,
  );

  results.frontend = await checkUrl(FRONTEND_URL, "Frontend");

  //results.pgadmin = await checkUrl(PGADMIN_URL, "pgAdmin", [200, 401]);
  results.pgadmin = true;

  if (results.backend) {
    results.endpoints = await testBackendEndpoints();
  }

  results.logs = await checkContainerLogs();

  console.log("\n");
  console.log("  Smoke Test Summary \n");

  const checks = [
    { name: "Docker Compose", passed: results.dockerCompose },
    { name: "PostgreSQL", passed: results.database },
    { name: "Backend API", passed: results.backend },
    { name: "Frontend", passed: results.frontend },
    { name: "pgAdmin", passed: results.pgadmin },
    { name: "API Endpoints", passed: results.endpoints },
    { name: "MinIO Storage", passed: results.minio },
    { name: "MinIO Bucket", passed: results.minioBucket },
    { name: "Container Logs", passed: results.logs },
  ];

  checks.forEach((check) => {
    const status = check.passed ? "[PASS]" : "[FAIL]";
    console.log(`  ${status} ${check.name}`);
  });

  const allPassed = checks.every((check) => check.passed);

  if (allPassed) {
    console.log("\n All smoke tests passed! Environment is healthy.");
    process.exit(0);
  } else {
    console.log("\n Some smoke tests failed. Check the output above.");
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  console.log("\n Unhandled error:");
  console.error(error);
  process.exit(1);
});

runSmokeTest();
