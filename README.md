# ALEXIDE

**A web-based Integrated Development Environment for programming education.**

ALEXIDE combines the editing experience of a professional IDE (Monaco Editor, real-time collaboration, an in-browser terminal) with the classroom-management workflow of an LMS: assignments, automated grading, timed exams with live monitoring, and AI-assisted feedback, all accessible from a browser with no local installation. It was built as a final-year Computer Science project at Dublin City University by Medas Bazaras and Dziugas Vaitiekus, supervised by Graham Healy.

![ALEXIDE Home Page](docs/images/
homepage.png)

## Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Security Model](#security-model)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [CI/CD Pipeline](#cicd-pipeline)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Future Work](#future-work)

## Motivation

Existing tools split into two camps that don't fully serve programming education. General-purpose web IDEs (e.g. GitHub Codespaces, Replit) offer strong coding environments but no assignment management, enrolment, or exam enforcement. Learning management systems (Moodle, Loop, Canvas) handle submissions and grading but force students to write code locally and paste it in, breaking the development workflow. ALEXIDE closes this gap with a single integrated platform combining VS Code-style editing, Google Docs-style real-time collaboration, and a purpose-built educational workflow layer.

The project was delivered in three tiers: an MVP (multi-file Monaco editor, role-based auth, object-storage-backed files, sandboxed Python execution, a web terminal), a core feature set (real-time collaborative editing, live timed exams with tab-switch monitoring, role-specific dashboards, automated test-case grading), and stretch goals (AI-assisted feedback, further exam-integrity features).

## Features

### For Everyone
- **Real-time coding**: a Monaco Editor-powered browser IDE with syntax highlighting, bracket matching, multi-cursor editing and autocompletion, configured for Python.
- **Live collaboration**: Google Docs-style pair programming on shared files using Yjs CRDTs over Socket.IO, with per-user coloured cursors and a live collaborator presence bar. Share links let anyone join a session via `/join/:shareCode`.
- **Integrated terminal**: an xterm.js terminal wired to an isolated, per-user Docker container via a PTY exec session, with output batched at a 16ms (~60fps) flush interval to avoid flooding the connection.
- **Virtual file system**: create, rename, delete, upload, download and drag-and-drop files/folders. Metadata lives in PostgreSQL; content is stored as blobs in MinIO.

### For Students
- Dashboard summarising active assignments, average grade, active classes and a grades-by-class chart.
- Join classes via a join code, view classmates, and track submission history.
- Submit code for automatic grading against teacher-defined test cases, then receive AI-generated feedback once the teacher releases grades.
- Sit timed exams (open-book or closed-book) with a live wall-clock countdown, colour-coded time warnings (10/5/1-minute marks), auto-submit on expiry, and tab-switch detection.

### For Teachers
- Dashboard with total students, active classes, total grades and a class performance chart.
- Manage classes: create/edit/delete, view or remove members, regenerate join codes.
- Build assignments with weighted test cases, publish them, review submissions, re-grade, and edit or adopt AI-generated feedback.
- Run live exams and monitor every student who has ever joined, whether online, offline, or already submitted, with tab-switch alerts and on-demand answer snapshots.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Editor | Monaco Editor | Powers VS Code; strong Python/TypeScript support |
| Real-time collaboration | Yjs (CRDTs) | Conflict-free merging without a central authority; scales across servers |
| Transport | Socket.IO (3 namespaces: `/`, `/collaboration`, `/exam`) | Reliable WebSocket fallback; rooms fit collaboration, terminal and exam use cases |
| Code sandboxing | Docker / Dockerode | Per-user isolated, network-restricted containers for safe Python execution |
| File storage | MinIO | S3-compatible, self-hosted object storage |
| Relational data | PostgreSQL + Drizzle ORM | Type-safe schema and queries without heavyweight ORM overhead |
| Real-time/session state | Redis | Socket.IO pub/sub adapter, Yjs doc persistence, exam heartbeats and timers |
| Frontend | React + TypeScript + Mantine (UI/Charts) | Component-driven, accessible, themeable UI |
| Backend | Node.js + Express | Well suited to high-concurrency WebSocket workloads |
| AI feedback | OpenAI Chat Completions API | Asynchronous qualitative feedback on submissions |
| Auth | JWT + bcryptjs | Stateless, role-aware (STUDENT/TEACHER) authentication |
| Validation | Zod | Sanitises and validates all REST request bodies/params |
| Testing | Jest, React Testing Library, Supertest, Playwright | Unit, component, integration and E2E coverage |
| CI/CD | GitLab CI/CD, Docker-in-Docker | Six-stage pipeline: install, lint, build, test, smoke, e2e |

## System Architecture

ALEXIDE follows a layered, five-tier architecture:

1. **Client Layer**: a role-divided React/TypeScript SPA. Teachers use the Teacher Dashboard, Class Management and Exam Monitor; students use the Student Dashboard, Class/Assignment pages and Student Exam page. Both roles share a single **IDE Page** (Monaco Editor, xterm.js terminal and File Explorer side by side).
2. **Transport Layer**: stateless HTTP/REST with JWT Bearer auth for CRUD operations, plus three persistent Socket.IO connections: `/collaboration` (binary Yjs updates and cursor awareness), `/` root (raw PTY bytes to/from the Docker terminal), and `/exam` (heartbeats, tab-switch alerts, snapshots).
3. **Backend Layer**: Express REST routes (auth, files, execution, class, assignment, grade, submission, exam, share) behind JWT auth middleware, plus three WebSocket gateways behind both JWT auth and an **Exam Mode Middleware** that blocks file access/collaboration during closed-book exams.
4. **Service Layer**: sixteen decoupled services, including `UserService`, `ContainerService`/`ExecutionService`/`TerminalService` (Docker lifecycle), `ExamService`/`ExamGradingService`/`ExamRedisService`/`ExamScheduler` (exam lifecycle), `FileService`/`FileShareService`/`StorageService` (virtual file system), `ClassService`/`AssignmentService`/`SubmissionService`/`GradingService`/`GradeService` (educational workflow), and `AiFeedbackService` (OpenAI integration).
5. **Data/Infrastructure Layer**: PostgreSQL (relational data via Drizzle ORM), Redis (ephemeral state: exam timers, Yjs snapshots, Socket.IO pub/sub adapter), MinIO (file content blobs), and the Docker Engine (per-user execution containers).

Routing follows: **Routes -> Controllers -> Services -> Repositories -> Database**.

![Architecture Diagramdocs/images/SystemArchitectuream.png)

### Notable design decisions

- **Collaboration persistence**: Yjs documents live in memory while users are connected. Every 5 seconds after an update, the document state is encoded and saved to Redis; on final disconnect the doc is flushed to Redis and MinIO, then destroyed. On rejoin, `getOrCreateDoc` restores from Redis (or falls back to MinIO) so a server restart never loses in-progress edits.
- **Terminal output buffering**: raw PTY output is batched with a 16ms timer-flush pattern (`createOutputBuffer`) so the terminal updates at most once per frame instead of flooding the socket with hundreds of tiny events per second.
- **Automated grading**: each test case runs sequentially in the student's own container; a weighted score is calculated as `(earnedWeight / totalWeight) * maxScore`, persisted, and AI feedback is generated fire-and-forget afterward so the OpenAI call never delays the grading response.
- **Exam timer**: `useExamTimer` recomputes remaining time as `expiresAt - Date.now()` on every tick (rather than counting down a local interval), which self-corrects for throttled background tabs and keeps the client in sync with the server-authoritative end time.
- **Live exam monitoring**: a `mergeStudents` function reconciles the live Socket.IO-connected student list with the database session list, so a student who refreshes or briefly disconnects doesn't disappear from the teacher's view.

## Security Model

- **Authentication**: JWT tokens carrying user ID, email and role (`STUDENT`/`TEACHER`), validated on every REST request (`authMiddleware`) and WebSocket connection (`createSocketAuthMiddleware`).
- **Authorisation**: role-based guards at the controller/service layer; teachers only access their own classes/assignments/exams, students only access classes they're enrolled in.
- **Exam integrity**: `createExamModeMiddleware` flags a connecting socket if the student has an active closed-book exam; the collaboration and terminal gateways check this flag and reject file access or sync attempts during the exam.
- **Code execution isolation**: each user's code runs in its own network-isolated, resource-limited Docker container; the Docker socket is reachable only by the backend, never the frontend.
- **Input validation**: all REST endpoints validate request bodies/params with Zod before they reach the service layer.

## Screenshots

Add screenshots of the key flows below once available.

**Home page**

![Home Pagedocs/images/R_homepage.png)

**Authentication (login / sign up)**

![Authenticationdocs/images/Authenticationge.png)

**Student dashboard**

![Student Dashboarddocs/images/StudentDashboardrd.png)

**Teacher dashboard**

![Teacher Dashboarddocs/images/TeacherDashboardrd.png)

**IDE, code editor, file explorer and terminal**

![IDE Viewdocs/images/IDEViewew.png)

**Assignment page with test results and feedback**

![Assignment Pagedocs/images/Assignmentge.png)

**Live exam mode (student view)**

![Exam Modedocs/images/StudentExamde.png)

**Exam monitor (teacher view)**

![Exam Monitordocs/images/TeacherExamor.png)

**Real-time collaboration session**

![Collaborationdocs/images/C_collaboration.png)

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Node.js (LTS) and npm, if running frontend/backend outside containers
- An OpenAI API key (for AI-generated submission feedback)

### Clone the repository

```bash
git clone https://github.com/<your-username>/alexide.git
cd alexide
```

## Environment Variables

Create a `.env` file (and `.env.test` for the backend test suite). Never commit real secrets to version control.

```env
# Backend
DATABASE_URL=postgresql://<user>:<password>@postgres:5432/alexide
JWT_SECRET=<your-jwt-secret>
OPENAI_API_KEY=<your-openai-api-key>
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
MINIO_ACCESS_KEY=<minio-access-key>
MINIO_SECRET_KEY=<minio-secret-key>
PORT=3000

# Frontend
REACT_APP_BACKEND_URL=http://localhost:3000
```

## Running the App

### With Docker Compose (recommended)

```bash
docker-compose up -d
```

This starts all services:

| Service | URL |
|---|---|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| pgAdmin | http://localhost:8080 |
| MinIO | http://127.0.0.1:9000 |

Verify the health endpoint and run the smoke test:

```bash
curl http://localhost:3000/api/backend/health
node src/scripts/docker-smoke-test.mjs
```

### Running services individually

**Backend**

```bash
cd src/backend
npm install
npm run dev
```

**Frontend**

```bash
cd src/frontend/alexide-frontend
npm install
npm start
```

## CI/CD Pipeline

The GitLab CI/CD pipeline runs on every merge request and every push to the default branch, in six sequential stages (backend and frontend jobs run in parallel within each stage where possible):

1. **Install**: `npm ci` for backend and frontend, cached on `package-lock.json`.
2. **Lint**: ESLint and Prettier format checks across both workspaces.
3. **Build**: backend compiled TypeScript to `dist`; frontend built via Create React App to `build`. Both are saved as pipeline artifacts.
4. **Test**: Jest suites run in parallel with PostgreSQL, MinIO and Redis as GitLab service containers; migrations and MinIO bucket setup run first. Coverage is published as JUnit XML and Cobertura.
5. **Smoke**: a Docker-in-Docker job builds the Python executor image, runs migrations, starts the backend, waits on `/api/backend/health`, then runs the smoke test suite end-to-end.
6. **E2E**: Playwright tests run on the default branch only, against a seeded test database, with HTML/JUnit reports published to the merge request.

Docker Compose wires together the frontend, backend, PostgreSQL, Redis and MinIO for local development; `docker-compose.test.yml` isolates test database state.

## Testing

**Backend unit and integration tests (Jest):**

```bash
cd src/backend
npm test
```

**Frontend component tests (Jest + React Testing Library):**

```bash
cd src/frontend/alexide-frontend
npm test
```

**End-to-end tests (Playwright):**

```bash
cd src/frontend/alexide-frontend
npx playwright test
```

**Docker smoke test** (validates API endpoints, MinIO storage/bucket, and container logs once the stack is up):

```bash
node src/scripts/docker-smoke-test.mjs
```

## Project Structure

```
src/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers (auth, files, assignments, submissions...)
│   │   ├── services/        # 16 domain services (assignment, submission, grading, execution, terminal, exam, AI feedback...)
│   │   ├── repositories/    # Drizzle ORM data access layer
│   │   ├── db/               # Schema and database connection
│   │   ├── middleware/       # JWT auth, exam-mode, validation (Zod)
│   │   ├── collaboration.ts  # Yjs collaboration Socket.IO gateway
│   │   ├── terminal.ts       # PTY terminal Socket.IO gateway
│   │   ├── examGateway.ts    # Exam lifecycle Socket.IO gateway
│   │   └── tests/            # Jest test setup
│   └── ...
├── frontend/
│   └── alexide-frontend/
│       ├── src/
│       │   ├── components/   # FileExplorer, CodeEditor, Terminal, ExamBanner, ShareModal, AssignmentsTab...
│       │   ├── pages/         # HomePage, dashboards, IDEPage, class/assignment/exam pages
│       │   ├── hooks/         # useCollaboration, useIDE, useExamSocket, useTeacherExams, useExamTimer...
│       │   └── contexts/      # AuthContext
│       └── e2e/               # Playwright specs
└── scripts/
    └── docker-smoke-test.mjs  # Post-deploy health check across all services
```

## Future Work

- **Language support expansion**: beyond Python, with dedicated execution images per language (grading/terminal infra is already language-agnostic).
- **Horizontal scaling**: decouple container orchestration from the backend so any node can attach to any user's container (Kubernetes / container-as-a-service).
- **Enhanced exam proctoring**: fullscreen lockdown, consent-based webcam snapshots, and copy-paste detection to flag externally-pasted code.
- **Code playback and timeline review**: replay a student's Yjs edit history to review how a solution was reached.
- **Voice and video integration**: WebRTC-based pair programming calls signalled over the existing Socket.IO backend.