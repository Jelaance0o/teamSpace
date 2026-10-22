# TeamSpace — Project Documentation

> Source of truth: the frontend and backend files in this repository. This document describes implemented behavior and explicitly calls out functionality that is not present or could not be verified in the current environment.

## Table of contents

1. [Project overview](#1-project-overview)
2. [Current feature and role matrix](#2-current-feature-and-role-matrix)
3. [Technology stack](#3-technology-stack)
4. [Repository structure](#4-repository-structure)
5. [Architecture and request flow](#5-architecture-and-request-flow)
6. [Environment variables](#6-environment-variables)
7. [Prerequisites and fresh-clone setup](#7-prerequisites-and-fresh-clone-setup)
8. [Database, models, and migrations](#8-database-models-and-migrations)
9. [Authentication and security](#9-authentication-and-security)
10. [Frontend guide](#10-frontend-guide)
11. [Backend guide](#11-backend-guide)
12. [API reference](#12-api-reference)
13. [Profile-image API and rendering](#13-profile-image-api-and-rendering)
14. [Styling and responsive layout](#14-styling-and-responsive-layout)
15. [Testing and verification](#15-testing-and-verification)
16. [Production considerations](#16-production-considerations)
17. [Rebuild from empty directories](#17-rebuild-from-empty-directories)
18. [Troubleshooting](#18-troubleshooting)
19. [Known gaps and unverified behavior](#19-known-gaps-and-unverified-behavior)
20. [Change log for this update](#20-change-log-for-this-update)

---

## 1. Project overview

TeamSpace is a multi-workspace team-management application. It organizes workspaces, users, projects, project membership, tasks, task reports, and invitations. The browser UI is a React single-page application. A FastAPI service exposes JSON APIs and a protected binary profile-image API. SQLAlchemy maps Python models to PostgreSQL tables; Alembic versions the schema.

The API prefix is `/api/v1`. The backend is configured to run locally at `http://localhost:8000`, and Vite's default local frontend origin is `http://localhost:5173`.

### Main user flows

1. An initial Admin and workspace are created with the bootstrap script.
2. An Admin logs in; the API sets an HttpOnly `access_token` cookie.
3. Admin invites an Admin, Project Manager, or Member. The API returns a 24-hour invitation URL for the inviter to share.
4. The recipient opens `/accept-invitation?token=...`, validates the token, fills in account/profile fields, and accepts the invitation.
5. Admin creates projects and may assign an active Project Manager in the same workspace.
6. Admin or the assigned Project Manager creates tasks and may assign an active regular Member in the same workspace.
7. Members see their assigned tasks and can update allowed status transitions and submit task-linked progress/discussion/blocker/issue/question reports.
8. Admins and assigned Project Managers can review reports according to the server-side permission checks.

## 2. Current feature and role matrix

| Capability | Admin | Project Manager | Member (`employee`) |
|---|---|---|---|
| Read projects | All projects in own workspace | Projects assigned to them or where they are a project member | Projects where they are a project member |
| Create projects | Yes | No | No |
| Update project | Any workspace project | Only projects assigned to them | No |
| Create tasks | Yes, in workspace-accessible project | Only projects assigned to them | No |
| Assign task | Active regular Member in the project's workspace | Active regular Member in the project's workspace | No |
| List tasks | All workspace tasks | Tasks in managed projects plus tasks assigned to themselves | Assigned tasks only |
| Update tasks | Yes, workspace-scoped | Tasks in projects they manage | Own assigned task status only, within allowed transitions |
| List workspace teammates | Yes, paginated | Active Members workspace-wide through Manager endpoints | No general teammate directory |
| Read teammate work details | Admin workspace teammate details endpoint | Active Member details in same workspace | Not generally permitted by these APIs |
| Change teammate role/deactivate | Yes, subject to safeguards | No | No |
| Invite users | Yes, role is server-validated | No | No |
| Upload own profile picture | Yes | Yes | Yes |
| View other profile pictures | Workspace-scoped Admin access | Active Member in own workspace | No, except own image |
| Submit task report | No | No | Only when assigned to the task |
| Review/respond to reports | Yes | Only for projects they manage | No |

The backend is authoritative. Frontend navigation visibility is a usability measure and is not a replacement for API authorization.

## 3. Technology stack

### Frontend

| Technology | Purpose | Evidence in repository |
|---|---|---|
| React 19 | Component UI and state | `frontend/package.json`, `frontend/src` |
| TypeScript 6 | Typed UI and API models | `frontend/tsconfig*.json`, `.tsx` files |
| Vite 8 | Dev server and production bundling | `frontend/vite.config.ts`, package scripts |
| React Router 7 | Client-side routes and protected layout | `frontend/src/App.tsx` |
| Axios | Cookie-enabled API client | `frontend/src/lib/api.ts` |
| Tailwind CSS 4 | Utility styling | `frontend/src/index.css`, Vite plugin |
| lucide-react | Icons | Feature components |
| ESLint / typescript-eslint | Linting | `frontend/eslint.config.js`, package scripts |

There is no charting package such as Recharts or Chart.js in the supplied `package.json` or frontend source. Existing dashboard statistics are rendered from API data, but a dedicated chart library is not currently part of this source snapshot.

### Backend

| Technology | Purpose |
|---|---|
| Python | API and business logic |
| FastAPI | HTTP routing, dependency injection, validation, OpenAPI docs |
| Pydantic v2 | Request/response schemas and validation |
| SQLAlchemy 2 | ORM, relationships, database sessions |
| Alembic | Database migrations |
| PostgreSQL | Persistent data store; psycopg 3 driver |
| PyJWT | Signed access tokens |
| pwdlib | Password hashing and verification |
| python-dotenv | Loading `backend/.env` |
| Uvicorn | ASGI development/runtime server |
| pytest + HTTPX | Backend tests and API test client |

Dependency versions are pinned in `backend/requirements.txt`; JavaScript dependency versions are specified in `frontend/package.json` and locked in `frontend/package-lock.json`.

## 4. Repository structure

```text
TeamSpace/
├── PROJECT_DOCUMENTATION.md
├── .env.example
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   └── security.py
│       ├── db/session.py
│       ├── database.py
│       ├── dependencies/auth.py
│       ├── api/v1/
│       │   ├── router.py
│       │   └── endpoints/
│       ├── models/
│       ├── schemas/
│       ├── services/
│       └── scripts/create_admin.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    ├── tsconfig*.json
    ├── public/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── components/
        ├── contexts/
        ├── lib/api.ts
        ├── styles/
        └── features/
            ├── auth/
            ├── dashboard/
            ├── projects/
            ├── tasks/
            └── team/
```

### Important backend modules

- `app/main.py`: constructs the FastAPI app, registers CORS middleware, includes the v1 router, and defines root/database-health endpoints.
- `app/api/v1/router.py`: includes the auth, invitation, teammate, project, task, and task-report routers under `/api/v1`.
- `app/dependencies/auth.py`: reads the `access_token` cookie, validates JWTs, loads the active user, and enforces roles.
- `app/db/session.py`: creates the active SQLAlchemy engine/session factory and request-scoped session dependency.
- `app/database.py`: contains a second database engine/health helper. The request dependency imported by `main.py` and routers is `app.db.session`; treat `app/database.py` as legacy/duplicate infrastructure unless it is deliberately consolidated in a future change.
- `app/models_legacy_backup.py`: legacy backup model module; it is not the model registry imported by `app.models`.
- `app/schemas/project_service.py`: exists in the source snapshot, but active project routes use `app.schemas.project` and `app.services.project_service`.
- `app/scripts/create_admin.py`: bootstraps the first workspace and Admin only when there are no users.

### Important frontend modules

- `src/main.tsx`: mounts React StrictMode, BrowserRouter, App, and global CSS.
- `src/App.tsx`: public login and invitation-acceptance routes; protected workspace layout and dashboard/team/projects/tasks pages.
- `src/contexts/AuthContext.tsx`: login/logout, current-user restoration, and user state.
- `src/contexts/ThemeContext.tsx`: three themes and localStorage persistence.
- `src/lib/api.ts`: shared Axios instance with `withCredentials: true`.
- `src/components/layout/WorkspaceLayout.tsx`: responsive shell, sidebar/navigation, theme selector, logout, and sidebar profile-picture upload.
- `src/components/AuthenticatedProfileImage.tsx`: downloads protected image bytes through Axios and creates a temporary browser object URL.
- `src/features/*`: feature-oriented page components, API calls, types, dialogs, and CSS.

## 5. Architecture and request flow

```text
Browser (React + TypeScript)
  ├─ React Router / AuthContext / ThemeContext
  ├─ Axios (`withCredentials: true`)
  │    └─ HTTP requests to VITE_API_URL + /api/v1/...
  ▼
FastAPI (`app/main.py`)
  ├─ CORS middleware (exact FRONTEND_ORIGIN, credentials enabled)
  ├─ `/api/v1` router
  ├─ Authentication/role dependencies
  ├─ Endpoint handlers + Pydantic schemas
  ├─ Service functions (business rules)
  ▼
SQLAlchemy request session (`app/db/session.py`)
  ▼
PostgreSQL tables managed by Alembic
```

Most API responses are JSON. Profile-picture endpoints return raw image bytes with the stored MIME type. Axios is used for those protected image calls because a normal HTML `<img src>` cannot attach the app's cookie credentials through the Axios client.

## 6. Environment variables

### Backend variables

| Variable | Required | Default | Meaning |
|---|---:|---|---|
| `DATABASE_URL` | Yes | None | SQLAlchemy PostgreSQL URL; missing value stops startup/migration setup. Use `postgresql+psycopg://...` for the installed driver. |
| `JWT_SECRET_KEY` | Yes | None | Secret used to sign access tokens. Must be a long, unpredictable secret. |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | JWT cookie/token lifetime in minutes. |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Exact browser origin allowed by CORS and used to build invitation URLs. |
| `COOKIE_SECURE` | No | `false` | Set `true` when the frontend/backend are deployed over HTTPS. |
| `COOKIE_SAMESITE` | No | `lax` | Cookie SameSite policy: `lax`, `strict`, or `none`; `none` requires `COOKIE_SECURE=true`. |

The backend loads `backend/.env` via `python-dotenv`. Copy `backend/.env.example` to `backend/.env` and replace placeholders locally. Do not commit `.env`.

### Frontend variables

| Variable | Required | Default | Meaning |
|---|---:|---|---|
| `VITE_API_URL` | No | `http://localhost:8000` | Backend origin only. API calls already include `/api/v1`, so do not append `/api/v1` to this value. |

Vite loads `frontend/.env`. Copy `frontend/.env.example` to `frontend/.env`. Only variables prefixed with `VITE_` are exposed to browser code; never put secrets there.

The root `.env.example` is a combined reference, not a file loaded by either app. Use the backend/frontend-specific examples for actual setup.

### Example database URL

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

Use the actual provider URL and ensure special characters in credentials are URL-encoded as required by SQLAlchemy URL parsing.

## 7. Prerequisites and fresh-clone setup

### Prerequisites

- Git
- Node.js and npm compatible with Vite 8 (Node.js 22 is the tested local runtime in this update environment; use a current supported Node release)
- Python version supported by the pinned dependencies (the current package set and this update environment use Python 3.13)
- PostgreSQL database, for example a Neon PostgreSQL database

### 7.1 Clone and configure

```powershell
git clone <YOUR_REPOSITORY_URL> TeamSpace
cd TeamSpace
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Edit `backend/.env` with the actual database URL and a strong JWT secret. Leave the local CORS origin and cookie settings as shown for localhost development.

Generate a secret locally with Python if needed:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 7.2 Install backend dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, either adjust the local execution policy for the current user or call `.venv\Scripts\python.exe` directly.

### 7.3 Apply database migrations

With `backend/.env` configured and the database reachable:

```powershell
alembic current
alembic heads
alembic upgrade head
```

Review the reported current/head revisions before upgrading an existing production database. Do not drop or recreate the database to resolve migration errors. Back up existing data before schema changes.

### 7.4 Bootstrap the first Admin

The script creates one workspace and its first Admin. It refuses to run if any user already exists, which prevents accidental creation of a second bootstrap workspace.

```powershell
python -m app.scripts.create_admin
```

It prompts for workspace name, Admin name/email, and a password. The script requires at least 12 characters and confirmation. This is separate from the invitation form's schema-level password policy.

### 7.5 Run the API

```powershell
uvicorn app.main:app --reload
```

- API root: `http://localhost:8000/`
- Database health: `http://localhost:8000/health/database`
- OpenAPI/Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 7.6 Install and run frontend

Open another PowerShell terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. `npm ci` uses the committed lock file for reproducible dependency installation.

### 7.7 Production frontend build

```powershell
cd frontend
npm ci
npm run build
npm run preview
```

The build script runs `tsc -b` and then `vite build`. The preview server is for local verification; deploy the generated `frontend/dist` directory to your chosen static hosting service. Configure `VITE_API_URL`, `FRONTEND_ORIGIN`, cookie security, HTTPS, and database settings for the deployed origins.

## 8. Database, models, and migrations

### Tables and relationships

| Table / model | Important fields | Relationships and purpose |
|---|---|---|
| `workspaces` / `Workspace` | `id`, `name`, unique `slug`, `created_at` | One workspace has many users. |
| `users` / `User` | workspace, name, email, password hash, role, active flag, department, job title, bio, skills JSON, tech stack JSON, image bytes/MIME, creation time | Belongs to a workspace. Email is unique globally. Picture bytes are deferred from ordinary queries. |
| `invitations` / `Invitation` | workspace, inviter, email, role, SHA-256 token hash, expiry, accepted/revoked timestamps | A one-use, time-limited registration invitation. Raw token is not stored. |
| `projects` / `Project` | workspace, name, description, status, priority, dates, creator, manager, timestamps | Belongs to a workspace; references creator and optional Project Manager. |
| `project_members` / `ProjectMember` | `project_id`, `user_id`, `added_by_id`, `joined_at` | Composite primary key prevents duplicate membership for a user/project pair. |
| `tasks` / `Task` | workspace, project, title, description, status, priority, creator, assignee, due date, timestamps, completion timestamp | Belongs to project/workspace; references creator and optional assignee. |
| `task_reports` / `TaskReport` | workspace, task, submitter, report type, message, status, manager response, timestamps, resolved time | Task-linked progress/discussion/blocker/issue/question reports. |

### Key relationships

- `Workspace 1 → many User`.
- `Workspace 1 → many Project`, `Task`, `Invitation`, and `TaskReport` through workspace IDs.
- `Project 1 → many ProjectMember` and `Project 1 → many Task`.
- `ProjectMember` links `User` and `Project`; the pair is the composite primary key.
- `Task` references `Project`, `created_by` User, and optional `assigned_to` User.
- `TaskReport` references `Task` and `submitted_by` User.
- `Project.project_manager_id` references a user; service validation requires the selected manager to be active, have role `project_manager`, and belong to the same workspace.

### Model validation and CRUD boundaries

Pydantic schemas validate request fields and length limits before route/service execution. Services perform cross-record checks that schema validation cannot establish: workspace matching, active account checks, role checks, project access, duplicate memberships, invitation expiry/revocation, and allowed task status transitions. Writes generally commit then refresh the ORM object; failures roll back the session.

### Migration history present in this repository

| Revision | Purpose |
|---|---|
| `cf909397f9e6` | Create workspaces and users |
| `4ef2e500c5ea` | Add invitations |
| `e8843f607f6d` | Create projects and project members |
| `afab263b6eb2` | Follow-on project/member revision; its upgrade is a no-op in this snapshot |
| `1c0411be462b` | Create tasks |
| `3e339bec30d1` | Follow-on tasks revision; its upgrade is a no-op in this snapshot |
| `8b4f2a91c6d0` | Add profile fields and task reports |
| `9a2f7d6c4e11` | Add profile picture bytes and MIME type to users |

The migration chain is source-controlled. Do not manually edit `alembic_version` or mark migrations as applied without comparing the live schema. `alembic upgrade head` needs a reachable database.

## 9. Authentication and security

### Cookie-based JWT

1. `POST /api/v1/auth/login` validates email/password.
2. The backend signs a JWT with `sub` (user ID), `type=access`, and `exp` claims.
3. It sets an HttpOnly cookie named `access_token` with the configured lifetime, secure flag, SameSite mode, and root path.
4. Axios uses `withCredentials: true` so the browser sends the cookie to the API.
5. `get_current_user` reads and decodes the cookie, loads the user, and rejects missing, invalid, expired, inactive, or missing accounts.
6. `require_roles(...)` protects role-specific endpoints.
7. Logout deletes the cookie and clears frontend user state.

The token is not stored in localStorage. The frontend restores a session by calling `/api/v1/auth/me` at startup.

### Invitation security

- Admin-only creation.
- Cryptographically random URL-safe raw token returned once in the invitation URL.
- SHA-256 token hash stored in the database.
- Expiry after 24 hours.
- Previous pending invitations for the same workspace/email are revoked when a new one is created.
- Validation rejects unknown, expired, revoked, or accepted invitations.
- Acceptance locks the invitation row where supported and commits user creation and invitation acceptance together.
- Recipient cannot choose their own role; the invitation role is authoritative.

### Role and workspace controls

- Each protected request uses an active authenticated user.
- Most project/task queries include workspace filtering.
- Admin APIs are scoped to the Admin's workspace.
- Project Managers can only mutate projects they are assigned to and only review reports for projects they manage.
- Members are limited to their assigned tasks and allowed status transitions.
- Task assignees must be active regular Members in the project workspace; Admins and Project Managers are rejected.
- Image endpoints check same-workspace visibility and role-specific access.

### CORS and cookies

`app/main.py` allows one exact origin from `FRONTEND_ORIGIN`, credentials, selected methods, and `Content-Type`/`X-CSRF-Token` request headers. Do not use wildcard origins with credentialed cookies. If frontend and backend are on different sites in production, cookie `SameSite=None` requires `COOKIE_SECURE=true` and HTTPS. Same-site localhost development commonly uses `lax` and `false`.

## 10. Frontend guide

### Routing

`frontend/src/App.tsx` defines:

| Route | Access | Component |
|---|---|---|
| `/login` | Public | `features/auth/LoginPage.tsx` |
| `/accept-invitation?token=...` | Public | `features/auth/InvitationAcceptancePage.tsx` |
| `/dashboard` | Authenticated | `features/dashboard/DashboardPage.tsx` |
| `/team` | Authenticated; nav is Admin/Manager only, API checks actual role | `features/team/TeamPage.tsx` |
| `/projects` | Authenticated | `features/projects/ProjectsPage.tsx` |
| `/tasks` | Authenticated | `features/tasks/TasksPage.tsx` |
| `/` | Authenticated route redirects to `/dashboard` | Route declaration in `App.tsx` |
| Unknown path | Catch-all redirects to `/dashboard` | Route declaration in `App.tsx` |

`ProtectedRoute` waits for authentication initialization before redirecting to login. Invitation acceptance is intentionally outside the protected route tree so a new tab does not need an existing login session.

### Layout and state

- `WorkspaceLayout` renders the sidebar, responsive mobile menu, role-specific navigation, theme selector, profile avatar upload, and `Outlet` for page content.
- `AuthContext` exposes `user`, `loading`, `login`, and `logout`.
- `ThemeContext` exposes `theme` and `setTheme`; it stores the selection in localStorage under `teamspace-theme`.
- Feature pages keep local component state for forms, dialogs, filters, pagination, loading, errors, and results. Shared API calls use the same Axios client.

### Feature directory guide

| Path | Responsibility |
|---|---|
| `features/auth/` | Login, public invitation acceptance, and invitation form styles |
| `features/dashboard/` | Role-aware dashboard, project/task summaries, expandable project task panels, and loading/error states |
| `features/projects/` | Project list, filters, statistics, project create/edit dialog, details/member controls, types/utilities, and split CSS |
| `features/tasks/` | Task list, task forms/details, status/priority badges, task reports/discussion, API module, types, utilities, and CSS |
| `features/team/` | Admin team table, invitation/role/deactivation dialogs, Manager member directory/details, profile editor, and feedback components |
| `components/` | Reusable theme selector, layout, and protected profile image loader |
| `styles/` | Global base styles, theme tokens, and shared components |
| `lib/api.ts` | Shared Axios client |

### Forms and error handling

Forms use controlled React state and disable submit/upload actions while requests are pending. API errors are usually converted to a readable string through feature utility functions or `AuthContext`. Each page should preserve entered form values on request failure; invitation submission clears fields only after success. `features/team/MemberProfileEditor.tsx` exists in this snapshot but is not imported by a routed page; the active profile-picture workflow is the sidebar avatar uploader. The backend supports updating profile metadata, but a dedicated profile-metadata editor is not currently reachable from the app routes.

### Themes and styling

The three supported theme IDs are `github-light`, `github-dark`, and `dark`. `ThemeContext` sets `document.documentElement.dataset.theme` and CSS `color-scheme`; `theme.css` maps the data attribute to theme tokens. `index.css` imports Tailwind and the global CSS layers. Feature CSS is kept beside the feature and imported by its feature entry point.

### Image rendering

Protected images are fetched as a `Blob` through Axios and converted to a temporary object URL. This permits credentialed access and keeps image bytes out of JSON responses. The component revokes temporary URLs when the source changes or the component unmounts. Avatar initials remain visible underneath while the image is loading or if it fails.

## 11. Backend guide

### Initialization

`app/main.py` creates the FastAPI instance, registers CORS middleware, includes `api_router`, and defines `/` and `/health/database`.

### Routing

`app/api/v1/router.py` sets the prefix `/api/v1` and includes six routers:

- `/auth`
- `/invitations`
- `/teammates`
- `/projects`
- `/tasks`
- `/task-reports`

### Configuration and database sessions

- `app/core/config.py` reads JWT/cookie/CORS settings and validates SameSite configuration.
- `app/db/session.py` loads `DATABASE_URL`, creates a SQLAlchemy engine with `pool_pre_ping`, a session factory, a generator dependency, and a database health check.
- `alembic/env.py` imports `Base` from `app.models`, loads backend `.env`, and uses `Base.metadata` for migration autogeneration/comparison.

### Services and business logic

| Service | Responsibility |
|---|---|
| `auth_service.py` | Normalize email, reject inactive/missing accounts, verify password hash |
| `invitation_service.py` | Hash token, create/revoke invitations, validate token lifetime/state, atomically create invited user and accept invitation |
| `project_service.py` | Validate Project Manager, create/update/list projects, resolve project access, add project members |
| `task_service.py` | Project access, task creation/list/read/update, assignee validation, status transition rules |
| `task_report_service.py` | Create reports, role-scoped report list, manager/Admin responses and resolution timestamps |
| `teammate_service.py` | Workspace teammate list/read, deactivate, change role, and last-Admin protections |

### Request lifecycle

1. FastAPI parses the request and validates its Pydantic body/query parameters.
2. Dependencies open a request-scoped SQLAlchemy session and authenticate the cookie where required.
3. The route enforces role access and invokes a service or scoped query.
4. Services validate related records and workspace boundaries.
5. Database writes commit atomically or roll back on failure.
6. Pydantic response models serialize only the declared fields; binary image endpoints use a raw `Response` with an image MIME type.

## 12. API reference

All paths below include `/api/v1`. Authenticated endpoints require the `access_token` cookie unless marked **Public**. JSON errors use FastAPI's usual `{"detail": "..."}` or validation-error array shape. A 422 indicates request/schema validation failure; protected endpoints return 401 for missing/invalid authentication and 403 for role/access violations. Resource queries commonly return 404 when a record is not available to the caller. Exact service-level error messages are described where material.

### 12.1 Health

| Method and path | Auth | Parameters/body | Success |
|---|---|---|---|
| `GET /` | Public | None | `{"message":"TeamSpace API is running"}` |
| `GET /health/database` | Public | None | `{"status":"connected","database":"teamspace_db"}`; returns 503 if database health check fails |

### 12.2 Authentication

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `POST /auth/login` | Public | JSON `{ "email": "person@example.com", "password": "..." }` | 200 `UserResponse`; sets HttpOnly `access_token` cookie |
| `GET /auth/me` | Cookie | None | 200 `UserResponse` for current active user |
| `POST /auth/logout` | No login required to clear cookie | None | 204; deletes `access_token` cookie |

`UserResponse` contains `id`, `workspace_id`, `full_name`, `email`, `role`, `is_active`, `department`, `job_title`, `bio`, `skills`, `tech_stack`, `profile_picture_url`, and `created_at`. It does not return the password hash.

Common login errors: 401 for invalid email/password; 422 for invalid body. `/auth/me` returns 401 for absent, invalid, expired, inactive, or missing account.

### 12.3 Invitations

| Method and path | Auth | Query/body | Success |
|---|---|---|---|
| `POST /invitations` | Admin | JSON `{ "email": "person@example.com", "role": "employee" }`; role may be `admin`, `project_manager`, or `employee` | 201 `{email, role, invitation_url, expires_at}` |
| `GET /invitations/validate?token=...` | Public | Required query token, 32–200 chars | 200 `{valid, email, role, expires_at}` |
| `POST /invitations/accept` | Public | JSON `{token, full_name, password, department?, job_title?, bio?, skills?, tech_stack?}` | 201 `UserResponse` |

Validation: name 2–150 chars; password 8–128 chars and must contain a letter, number, and symbol; department ≤100 chars, job title ≤120, bio ≤1000; skill/tech lists up to 50 items, each ≤80 chars. The role is determined by the invitation, not by the recipient. Invalid/revoked/expired/already accepted tokens return 400; an Admin invitation for an existing email returns 409 at creation. The API returns a link for the Admin to share; no email delivery provider is configured in this source.

### 12.4 Teammates and profile pictures

| Method and path | Auth | Query/body | Success and purpose |
|---|---|---|---|
| `GET /teammates?limit=20&offset=0` | Admin | `limit` 1–100; `offset` ≥0 | 200 array of `UserResponse`; current Admin workspace |
| `GET /teammates/{user_id}` | Admin | Path user ID | 200 `UserResponse`; 404 if not in workspace |
| `GET /teammates/{user_id}/details` | Admin | Path user ID | 200 `ManagerMemberDetail` with profile/work summary |
| `GET /teammates/manager/members` | Project Manager | None | 200 array of active workspace Members (`role=employee`) |
| `GET /teammates/manager/members/{user_id}` | Project Manager | Path user ID | 200 `ManagerMemberDetail`; only active workspace Members, otherwise 404 |
| `PATCH /teammates/me/profile` | Any authenticated user | JSON partial profile fields: `department`, `job_title`, `bio`, `skills`, `tech_stack` | 200 `UserResponse`; profile text/list validation applies |
| `PUT /teammates/me/picture` | Any authenticated user | Raw image bytes in request body; `Content-Type` must be `image/jpeg`, `image/png`, `image/webp`, or `image/gif`; max 5 MiB | 200 `UserResponse`; bytes stored in `users.profile_picture` |
| `GET /teammates/me/picture` | Any authenticated user | None | Raw image bytes with stored MIME type; 404 if absent |
| `GET /teammates/{user_id}/picture` | Authenticated | Path user ID | Raw image bytes; self-access allowed; Admin may access same-workspace picture; Project Manager may access active Member in same workspace; others get 403/404 |
| `PATCH /teammates/{user_id}/role` | Admin | JSON `{ "role": "admin" | "project_manager" | "employee" }` | 200 `UserResponse`; cannot change own role or demote last active Admin |
| `PATCH /teammates/{user_id}/deactivate` | Admin | None | 200 `UserResponse`; cannot deactivate self or last active Admin |

`ManagerMemberDetail` extends `UserResponse` with `projects`, `task_stats` (`total`, `completed`, `pending`, `overdue`), `recent_tasks`, and `recent_reports`. These are computed from workspace-scoped records, not fabricated values.

Image errors: 400 empty/mismatched image bytes; 413 over 5 MiB; 415 unsupported MIME type; 401 missing/invalid cookie; 403/404 when visibility rules fail or no image exists.

### 12.5 Projects

| Method and path | Auth | Query/body | Success |
|---|---|---|---|
| `POST /projects` | Admin | `ProjectCreate` JSON | 201 `ProjectResponse` |
| `GET /projects?limit=20&offset=0` | Authenticated | `limit` 1–100, `offset` ≥0 | 200 array of projects visible to caller |
| `GET /projects/{project_id}` | Authenticated | Path project ID | 200 `ProjectResponse`, otherwise 404 |
| `PATCH /projects/{project_id}` | Admin or assigned Project Manager | Partial `ProjectUpdate` JSON | 200 `ProjectResponse`; otherwise 404/403/400 |
| `GET /projects/{project_id}/top-tasks` | Authenticated with project access | Path project ID | 200 array of up to three tasks ordered urgent/high/medium/low, then nearest due date; Members see only their assigned tasks |
| `GET /projects/{project_id}/eligible-assignees` | Admin or assigned Project Manager | Path project ID | 200 minimal user array for active regular Members in project workspace |
| `GET /projects/{project_id}/members` | Admin or assigned Project Manager | Path project ID | 200 active project members, plus assigned Project Manager when active |
| `GET /projects/{project_id}/available-members` | Admin or assigned Project Manager | Path project ID | 200 active workspace users not already project members; excludes the assigned Project Manager |
| `POST /projects/{project_id}/members` | Admin or assigned Project Manager | JSON `{ "user_id": 123 }` | 201 `UserResponse`; 409 if duplicate/invalid member |

`ProjectCreate`: `name` 2–200 chars; optional `description` ≤5000; `status` one of `planned`, `active`, `on_hold`, `completed`, `cancelled`; `priority` one of `low`, `medium`, `high`, `urgent`; optional ISO `start_date`, `due_date`, and `project_manager_id`. Due date cannot precede start date. A Project Manager must be active, role `project_manager`, and in the same workspace. `ProjectResponse` includes project IDs, dates, status/priority, creator ID, `project_manager_id`, `project_manager_name`, and timestamps.

### 12.6 Tasks

| Method and path | Auth | Query/body | Success |
|---|---|---|---|
| `POST /tasks` | Admin or Project Manager assigned to the project | `TaskCreate` JSON | 201 `TaskResponse` |
| `GET /tasks?project_id=&status=&limit=50&offset=0` | Authenticated | Optional positive `project_id`; `status` one of `To Do`, `In Progress`, `In Review`, `Changes Required`, `Done`; `limit` 1–100; `offset` ≥0 | 200 array of scoped tasks |
| `GET /tasks/{task_id}` | Admin, assigned Project Manager, or task assignee | Path task ID | 200 `TaskResponse`; otherwise 404 |
| `PATCH /tasks/{task_id}` | Admin, assigned Project Manager, or task assignee | Partial `TaskUpdate` JSON | 200 `TaskResponse`; 400 invalid transition, 403 unauthorized update, 404 unavailable task |
| `POST /tasks/{task_id}/reports` | Member assigned to the task | JSON `{ "report_type": "progress", "message": "..." }` | 201 `TaskReportResponse` |
| `GET /tasks/{task_id}/reports` | Authenticated with task access | Path task ID | 200 array; Members see their own reports, reviewers see task-scoped reports if authorized |

`TaskCreate`: positive `project_id`; title 2–200; optional description ≤5000; priority `low`, `medium`, `high`, `urgent`; optional positive `assigned_to_id`; optional ISO due date. Status starts as `To Do`. `TaskUpdate` supports title, description, status, priority, assignee, and due date; title/status/priority cannot be explicitly null.

Members may only update the status of tasks assigned to them. Allowed transitions are `To Do → In Progress`, `In Progress → In Review`, and `Changes Required → In Progress`. A Member cannot approve/reject a review. An assigned Project Manager can move `In Review` to `Done` or `Changes Required`. Setting `Done` records `completed_at`; moving away from `Done` clears it. Admins can update tasks within their workspace.

`TaskResponse` includes IDs, title/description, status/priority, assignee/creator IDs, due/created/updated/completed dates, `project_name`, `created_by_name`, `assigned_to_name`, `project_manager_id`, and `project_manager_name`.

### 12.7 Task reports / communication

| Method and path | Auth | Query/body | Success |
|---|---|---|---|
| `GET /task-reports?status=&limit=50&offset=0` | Authenticated | Optional status `open`, `acknowledged`, `resolved`; limit 1–100; offset ≥0 | 200 array scoped by role/workspace |
| `PATCH /task-reports/{report_id}` | Admin or Project Manager | JSON partial `{status?, manager_response?}` | 200 `TaskReportResponse`; only Admin or manager assigned to report's project may respond |

`report_type` is one of `progress`, `discussion`, `blocker`, `issue`, `question`. Message is trimmed and must be 5–3000 chars. Update status is `open`, `acknowledged`, or `resolved`; manager response max 3000 chars. A `resolved` status sets `resolved_at`; reopening/acknowledging clears it. The response includes task/project names, submitter, project manager, report content/status, manager response, and timestamps.

### Common HTTP errors

| Status | Meaning |
|---|---|
| 400 | Invalid business rule or invitation token state |
| 401 | Missing/invalid/expired auth cookie or invalid credentials |
| 403 | Role, project, task, or image access denied |
| 404 | Resource not found or intentionally hidden from the caller |
| 409 | Invitation conflict or duplicate project membership |
| 413 | Profile image exceeds 5 MiB |
| 415 | Unsupported profile image content type |
| 422 | Pydantic request/query validation error |
| 503 | Database health endpoint cannot connect to database |

Swagger at `/docs` is the definitive runtime route/schema listing for the running build.

## 13. Profile-image API and rendering

### API contract

1. Browser selects an image; frontend validates MIME type and a 5 MiB maximum.
2. Frontend sends raw file bytes to `PUT /api/v1/teammates/me/picture` with the file's MIME type as `Content-Type` and cookie credentials.
3. Backend validates MIME and file signature, stores bytes and MIME in the current user's `users` row, commits, and returns `UserResponse` containing `profile_picture_url`.
4. Frontend fetches the returned relative URL with Axios `responseType: "blob"` and credentials.
5. Browser creates a temporary object URL, then displays it over the initials fallback. Temporary object URLs are revoked when replaced/unmounted.
6. The image response uses `Cache-Control: private, no-store` to prevent private avatars being retained by shared caches.

### Root cause fixed in this update

`AuthenticatedProfileImage.tsx` previously sent a custom request header `Cache-Control: no-cache`. The backend CORS middleware only allows `Content-Type` and `X-CSRF-Token`. A cross-origin browser request containing the unapproved `Cache-Control` header triggers a preflight request; the browser rejects the image request before it reaches the image route. The API already sends `Cache-Control: private, no-store` on the image response, so the request header was unnecessary. The fix removes the custom request header and retains a version query parameter for cache busting. The image component also validates the response blob/MIME, keeps initials visible while loading, hides the image until `onLoad`, handles `onError`, and releases object URLs.

### Manual image checks

- Upload a valid PNG/JPEG/WebP/GIF under 5 MiB; expect 200 and a non-null `profile_picture_url`.
- Reload the page; the image should reload through the protected API and show the current picture.
- Upload an invalid MIME/signature; expect 415 or 400 and a readable UI error.
- Upload a file larger than 5 MiB; expect 413.
- Request another user's image as an unauthorized role or across workspaces; expect 403/404.
- With no picture, the endpoint returns 404 and the UI must continue to show initials without a broken-image icon.
- In browser DevTools, verify the image GET does not include a `Cache-Control` request header, response `Content-Type` is `image/...`, and response has `Cache-Control: private, no-store`.

## 14. Styling and responsive layout

Global CSS is imported by `src/index.css`: Tailwind, `styles/base.css`, `styles/theme.css`, and `styles/components.css`. Each feature imports its feature CSS, with project CSS split across layout, table, dialogs, and responsive files.

The project list is a six-column semantic table at desktop widths. At `1100px` and below, the existing table rows switch to responsive card rows using CSS grid; columns stack without requiring a horizontal scrollbar. At `650px` and below, card padding and spacing shrink; at `360px` and below, the card uses one column. Existing project stat grids switch to two columns around tablet widths and to one column where configured by the existing responsive rules.

Responsive review targets:

| Viewport width | Expected behavior |
|---:|---|
| 320–360 px | One-column project row cards, wrapping long text, no page-level horizontal overflow |
| 361–650 px | Two-column card metadata, stacked project list, compact controls |
| 651–1100 px | Card-style project rows; stats/filters adapt to tablet and narrow laptop width |
| 1101 px and wider | Original desktop project table layout |

The responsive CSS is source-reviewed in this environment; real browser/device screenshots across Chrome, Firefox, Safari, and physical devices were not available here. Verify the widths above in DevTools and test touch navigation/modal sizing on an actual mobile browser before release.

## 15. Testing and verification

### Backend automated tests

The current backend tests are in:

- `backend/tests/test_auth_api.py`
- `backend/tests/test_invitation_api.py`
- `backend/tests/test_project_api.py`
- `backend/tests/test_task_api.py`
- `backend/tests/test_teammate_api.py`

Run from `backend/` with its virtual environment active:

```powershell
python -m pytest tests -q
python -m compileall -q app tests
```

The repository's `requirements.txt` includes `pwdlib`. Do not replace the production password hashing implementation to work around a missing local dependency; install the pinned requirements in the environment instead.

### Frontend checks

```powershell
cd frontend
npm ci
npm run lint
npm run build
```

`npm run build` runs TypeScript project build checks followed by Vite production compilation. Use `npm run dev` for local development and `npm run preview` to inspect the built bundle.

### Manual role workflow

1. Bootstrap initial Admin and sign in.
2. Invite a Project Manager and a Member using different browser profiles or a private window.
3. Open the invitation link while logged out and confirm the public acceptance form appears; test expired/accepted tokens too.
4. Admin creates a project assigned to that Manager.
5. Manager opens the project and creates a task assigned to a regular Member in the same workspace.
6. Confirm an Admin or another Project Manager cannot be selected as an assignee.
7. Member sees only assigned tasks in task listings and cannot read unrelated tasks by changing URL IDs or query filters.
8. Member moves a task through allowed status transitions and submits a progress/blocker/discussion report.
9. Assigned Manager reads/responds to the report; an unrelated Manager must be denied.
10. Admin reviews all workspace projects/tasks and manages roles without demoting/deactivating the last active Admin.
11. Upload a profile image, reload, verify display in the sidebar/team/profile views, then test invalid file and cross-workspace access.
12. Verify all three themes: GitHub Light, GitHub Dark, Dark; refresh and confirm persistence.
13. Use responsive widths 320, 375, 768, 1024, 1280, and 1440 px. Check no page-level horizontal scroll, clipped dialogs, overlapping buttons, or unreadable labels.

### Results for this documentation/image/grid update

- Source files, endpoint definitions, Pydantic schemas, ORM models, migrations, and frontend API usage were inspected.
- A focused CORS reproduction using the same `CORSMiddleware` configuration returned `400 Disallowed CORS headers` for an image GET preflight containing `cache-control,content-type`, and `200 OK` when the unapproved `cache-control` header was removed. This verifies the root cause at the middleware layer.
- Python source compilation passed with `python -m compileall -q backend/app backend/tests`.
- CSS parser validation passed for the modified project responsive stylesheet.
- TypeScript/TSX syntax validation is recorded in the delivery summary.
- Backend pytest could not collect in this environment: the first run lacked `JWT_SECRET_KEY`; after setting a test secret, the environment also lacked the pinned `pwdlib` and `psycopg` packages. The suite therefore has not been verified for this update.
- `npm run build` was attempted and failed before Vite bundling because type definitions `vite/client` and `node` were unavailable. `npm ci` timed out while attempting dependency installation.
- Browser automation, real authenticated image upload against PostgreSQL, and cross-browser/device screenshot tests were not available here. Run the commands in the local project environment to verify the dependency-resolved build and live integration.

## 16. Production considerations

- Use HTTPS, `COOKIE_SECURE=true`, and review `COOKIE_SAMESITE` for the actual deployment topology.
- Set `FRONTEND_ORIGIN` to the exact production browser origin; configure `VITE_API_URL` to the API origin and rebuild the frontend after changing it.
- Use a strong, unique `JWT_SECRET_KEY`; rotate it using a deliberate session invalidation plan.
- Restrict database credentials to the least privileges needed and do not ship `.env` files.
- The current image storage keeps bytes in PostgreSQL. This is simple and workspace-protected, but large-scale usage may warrant object storage in a future designed migration. No such storage integration is implemented here.
- The API returns invitation URLs but does not send email. A delivery provider and verified sender are not configured in the source.
- Ensure the reverse proxy/server enforces upload/body limits consistently with the 5 MiB application limit.
- Consider rate limiting login/invitation endpoints, structured audit logs, and a CSRF strategy appropriate to the deployment. The current authentication is cookie-based and CORS is configured, but no explicit CSRF-token validation dependency is present in the supplied source.

## 17. Rebuild from empty directories

This is a practical rebuild sequence based on the existing architecture, not a claim that an empty-directory rebuild was executed.

### Backend rebuild sequence

1. Create a Python project and virtual environment.
2. Install FastAPI, Uvicorn, SQLAlchemy, psycopg, Alembic, Pydantic, PyJWT, pwdlib, python-dotenv, and HTTPX/pytest for tests. The pinned `requirements.txt` is the exact dependency source.
3. Create `app/main.py` with FastAPI initialization, credentialed CORS, health endpoints, and router registration.
4. Create `app/core/config.py` and `app/core/security.py` for env validation, password hashing, JWT signing, and JWT decoding.
5. Create `app/db/session.py` for the SQLAlchemy engine/session dependency.
6. Define `Base` and models in dependency order: Workspace/User, Invitation, Project/ProjectMember, Task, TaskReport. Add all foreign keys, unique constraints, indexes, and relationships before generating migrations.
7. Define Pydantic request/response schemas; keep request validation separate from service business rules.
8. Implement auth dependencies, then auth service/routes.
9. Implement invitation token creation, hashed-token lookup, expiry/revocation checks, and atomic account acceptance.
10. Implement project access and project services/routes.
11. Implement task access, assignee validation, status transition rules, and task routes.
12. Implement task reports and role-scoped responses.
13. Implement teammate/profile APIs, including raw binary image upload and protected image retrieval.
14. Register routers under `/api/v1`.
15. Create Alembic configuration, import all models into the model registry, and generate/review migrations.
16. Add tests for authorization boundaries, validation, transactions, task transitions, reports, and image MIME/size/access.
17. Configure `backend/.env`, run `alembic upgrade head`, bootstrap the first Admin, then run `uvicorn app.main:app --reload`.

### Frontend rebuild sequence

1. Create Vite React TypeScript app and install the dependencies listed in `frontend/package.json`.
2. Configure Tailwind CSS Vite plugin and the TypeScript project files.
3. Add `src/main.tsx`, global CSS imports, theme tokens, and the three-theme provider.
4. Implement the Axios client with the backend origin and `withCredentials: true`.
5. Implement `AuthContext` for login, logout, and `/auth/me` restoration; do not store JWTs in localStorage.
6. Configure public login/invitation routes and a protected workspace layout.
7. Build feature folders for dashboard, projects, tasks, and team, including typed API contracts and loading/error/empty states.
8. Implement project/task forms and role-aware controls, but retain server-side authorization.
9. Implement task report UI backed by the report endpoints.
10. Implement protected profile-image fetch as a Blob with the credentialed API client, response MIME validation, object URL cleanup, and initials fallback. Do not send the disallowed `Cache-Control` request header.
11. Implement responsive CSS using min-width-safe grids and table-to-card transformations for narrow widths.
12. Run `npm run lint`, `npm run build`, browser route tests, role tests, and responsive checks.

## 18. Troubleshooting

### Backend fails at startup: missing environment variable

- Confirm `backend/.env` exists and contains `DATABASE_URL` and `JWT_SECRET_KEY`.
- Run commands from `backend/` with the correct virtual environment.
- The active config/session modules load `backend/.env`; root `.env` is not the runtime config file.

### Database connection or migration fails

- Check host, port, database, credentials, and provider SSL requirements in `DATABASE_URL`.
- Run `alembic current` and `alembic heads` before applying changes.
- Check that the database user can create/alter tables.
- Do not drop tables or edit Alembic's version table as a first response.
- `/health/database` returns 503 when `SELECT 1` fails.

### Login returns 401 even with valid credentials

- Verify account email is normalized to lowercase and the account is active.
- Verify the backend has `pwdlib` installed from `requirements.txt` and that password hashes were created with the current hash implementation.
- Check that the browser stores the HttpOnly `access_token` cookie.
- Ensure the frontend origin exactly matches `FRONTEND_ORIGIN` and Axios uses `withCredentials: true`.

### CORS or cookie failures

- Use browser DevTools Network to inspect the OPTIONS preflight and request/response headers.
- `FRONTEND_ORIGIN` must match scheme, host, and port exactly.
- Do not use `Access-Control-Allow-Origin: *` with credentials.
- Avoid unapproved custom request headers. For image fetching, do not add `Cache-Control` to the request; the response is already private/no-store.
- For cross-site production, configure HTTPS, `COOKIE_SECURE=true`, and a valid SameSite strategy.

### Profile image is blank or initials remain visible

- Confirm `PUT /api/v1/teammates/me/picture` returns 200 and `profile_picture_url` is non-null.
- Check the following GET request returns 200, `Content-Type: image/...`, and non-empty bytes.
- A 401 means the cookie was not sent/accepted; 403/404 may be expected under access rules or if no image exists.
- Check the browser's OPTIONS preflight. The image component must not send `Cache-Control: no-cache` as a request header because that header is not in `allow_headers`.
- Verify upload `Content-Type` matches the actual PNG/JPEG/WebP/GIF file signature and size ≤5 MiB.
- The UI intentionally keeps initials as fallback when image fetch/decode fails.

### Frontend says it cannot resolve `vite/client` or `node` types

- Run `npm ci` from `frontend/` and ensure the registry is reachable.
- Check `node_modules` was created and package installation completed without errors.
- Use a Node version compatible with Vite 8.
- Then run `npm run build` to see the actual TypeScript/Vite errors.

### Project/task table causes horizontal scroll

- Verify the latest `features/projects/styles/projects-responsive.css` is loaded.
- At widths ≤1100 px, the project table should become card-style rows. Inspect ancestor containers for fixed widths or unbreakable text.
- Ensure long names/descriptions have `min-width: 0`/`overflow-wrap` rules and that dialog content has bounded width/height.

### API returns 403 or 404

- Confirm current user's role and workspace in `/api/v1/auth/me`.
- Check that the Project Manager is actually assigned to the project.
- Confirm a Member is assigned to the task before accessing it or submitting reports.
- The API may return 404 for records intentionally not visible to the caller; do not infer that a resource is absent globally.

## 19. Known gaps and unverified behavior

- No configured email provider exists; Admins must share the returned invitation URL manually.
- No charting library is installed in the supplied frontend package. A dedicated chart/graph dashboard is not documented as implemented.
- Profile pictures are stored as binary data in PostgreSQL, not external object storage.
- No explicit CSRF-token verification dependency appears in the supplied backend; evaluate a CSRF strategy before production if deployment topology warrants it.
- No live production/Neon database was used to validate this documentation update.
- Cross-browser screenshots and physical-device checks were not run in this environment.
- Backend pytest remains unverified because the local environment is missing the pinned `pwdlib` and `psycopg` packages; the test run could not complete collection.
- Frontend production build remains a required local verification step; do not treat static parsing as a successful production build.
- The repository includes duplicate/legacy database initialization modules and backup/schema files called out above; they have not been deleted because the requested scope was documentation, image API reliability, and responsive layout, not cleanup/refactoring.

## 20. Change log for this update

### Modified

- `frontend/src/components/AuthenticatedProfileImage.tsx`
  - Removed the disallowed `Cache-Control` request header that caused a CORS preflight failure for protected cross-origin image requests.
  - Added response blob/content-type checks, loading visibility, image decode error handling, and object URL cleanup while retaining caller-provided initials fallback.
- `frontend/src/features/projects/styles/projects-responsive.css`
  - Added tablet/mobile CSS grid cards for project rows at ≤1100 px, smaller mobile spacing, text wrapping, and one-column treatment at ≤360 px. Desktop table layout remains unchanged above the breakpoint.

### Added

- `PROJECT_DOCUMENTATION.md`
- `.env.example`
- `backend/.env.example`
- `frontend/.env.example`

### Verification record

- Static source review of image request header vs. `CORSMiddleware.allow_headers` identified the CORS mismatch.
- Automated backend tests and a production frontend build must be run in the local project environment; results for the final files are reported separately in the delivery response.
