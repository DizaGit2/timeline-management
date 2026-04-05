# Timeline Management

Web platform for workforce scheduling.

## Installation (Docker)

The quickest way to run Timeline Management is with the published Docker images.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2.0+ (included with Docker Desktop)

### Quick Start

1. **Download the Compose file:**

   ```bash
   curl -O https://raw.githubusercontent.com/DizaGit2/timeline-management/main/docker-compose.yml
   ```

   Or clone the repository and use the file at the root:

   ```bash
   git clone https://github.com/DizaGit2/timeline-management.git
   cd timeline-management
   ```

2. **Configure environment variables:**

   The default `docker-compose.yml` ships with demo values suitable for local testing. For any non-demo deployment, override the secrets before starting:

   | Variable | Service | Description |
   |---|---|---|
   | `JWT_SECRET` | backend | Secret key for access tokens — must be ≥ 32 characters |
   | `JWT_REFRESH_SECRET` | backend | Secret key for refresh tokens — must be ≥ 32 characters |
   | `POSTGRES_PASSWORD` / `DATABASE_URL` | postgres / backend | Database password (keep them in sync) |
   | `CORS_ORIGIN` | backend | Origin URL of the frontend (default: `http://localhost:5173`) |

   You can override variables inline or via a `.env` file:

   ```bash
   # .env (place next to docker-compose.yml)
   JWT_SECRET=your-strong-secret-at-least-32-chars
   JWT_REFRESH_SECRET=your-strong-refresh-secret-at-least-32-chars
   ```

3. **Pull the images and start the stack:**

   ```bash
   docker compose pull
   docker compose up -d
   ```

   Docker will pull the latest images from Docker Hub:
   - `disadocker/timeline-management-backend:latest`
   - `disadocker/timeline-management-frontend:latest`

   The stack starts three containers: `postgres`, `backend`, and `frontend`. The backend waits for Postgres to be healthy before starting; the frontend waits for the backend.

4. **Open the app:**

   Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

### Stopping and Cleaning Up

```bash
# Stop containers (data volume is preserved)
docker compose down

# Stop and remove the database volume (full reset)
docker compose down -v
```

### Updating to the Latest Images

```bash
docker compose pull
docker compose up -d
```

