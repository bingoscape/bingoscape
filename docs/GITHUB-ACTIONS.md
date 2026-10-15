# GitHub Actions - CI/CD Documentation

How Bingoscape Next is checked, built and deployed. All workflows live in `.github/workflows/`.

## Overview

```
pull request ──► CI (lint, tsc, tests) + test build of both images        (nothing is published)

push to main ──► CI ──► build + push images :main and :sha-<short>        (automatic)
tag v1.2.3   ──► CI ──► build + push images :1.2.3 :1.2 :1 :latest        (automatic)

Deploy workflow (manual) ──► pick a tag ──► backup ──► migrate ──► swap app ──► health check
                                                                      └─ failure: automatic rollback
```

Building is automatic, **deploying is always manual**. There is a single environment (`production`); there is no staging.

| Workflow           | File                            | Trigger                                     |
| ------------------ | ------------------------------- | ------------------------------------------- |
| CI/CD              | `.github/workflows/ci-cd.yml`   | PR to `main`, push to `main`, `v*.*.*` tags |
| Deploy             | `.github/workflows/deploy.yml`  | manual (`workflow_dispatch`)                |
| Database Migration | `.github/workflows/migrate.yml` | manual (`workflow_dispatch`)                |

Dependency updates come from Dependabot (`.github/dependabot.yml`): weekly PRs for GitHub Actions, the Dockerfile base image (Node stays on major 24) and npm (minor/patch grouped into one PR).

## CI/CD (`ci-cd.yml`)

### Jobs

1. **`check`** - runs on every trigger: `npm run lint`, `npx tsc --noEmit`, `npm test` (the Jest suite starts a throwaway PostgreSQL container through testcontainers, which works on `ubuntu-latest`), and `docker compose config -q`.
2. **`build`** - runs after `check`, once per image (matrix: `runner` = the app, `migrator` = the migration image):
   - on pull requests: builds the image but does not push it,
   - otherwise: pushes the image to GHCR, using the registry build cache (`:buildcache` tags),
   - the app image additionally gets a build provenance attestation.

### Image tags

Both images get identical tag sets, so a single tag selects a matching app and migrator.

| Trigger           | Tags (both images)                           |
| ----------------- | -------------------------------------------- |
| Push to `main`    | `main`, `sha-<short>`                        |
| Tag `v1.2.3`      | `1.2.3`, `1.2`, `1`, `latest`, `sha-<short>` |
| Tag `v1.2.3-rc.1` | `1.2.3-rc.1`, `sha-<short>` (no `latest`)    |
| Manual run        | `sha-<short>` (plus `main` if run on `main`) |

Images:

- `ghcr.io/bingoscape/bingoscape` (app)
- `ghcr.io/bingoscape/bingoscape-migrator` (migrations)

`main` always moves to the newest main build. For a deploy you can reproduce or roll back to, use `sha-<short>` or a release tag.

Branch protection: make the `check` job (and the two `build` jobs) required status checks for `main`.

## Deploy (`deploy.yml`)

Run it from **Actions -> Deploy to Production -> Run workflow**.

| Input       | Description                                                                                            | Default |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------- |
| `image_tag` | `main`, `sha-<short>` (one commit) or a release tag such as `v1.2.3`. Must already be published by CI. | `main`  |

### What it does

On the runner:

1. validates `image_tag` (letters, digits, `_`, `.`, `-`),
2. renders a `.env` file from the GitHub secrets (see [GITHUB-SECRETS.md](./GITHUB-SECRETS.md)). Secrets go through `env:` and are shell-quoted for docker compose, so values containing `"`, `$`, `#` or `\` are safe. Values with line breaks are rejected,
3. uploads `docker-compose.yml`, `scripts/` and the env file to `/tmp/bingoscape-deploy/` on the server over SCP (the env file is mode 600).

On the server (`scripts/deploy.sh`, working directory `~/bingoscape`):

1. installs the compose file, scripts and `.env` (the previous `.env` is kept as `.env.backup.<timestamp>`, the newest 5 are retained; `.env` is mode 600),
2. remembers the currently running app image, then pulls the app and migrator images for `image_tag`, then runs `docker logout ghcr.io`,
3. takes a pre-deploy database backup (`scripts/backup-db.sh pre-deploy <tag>`). It is skipped when the PostgreSQL container is not running (first deploy). A failed backup stops the deploy,
4. runs the migrations (`docker compose run --rm migrate`). A failed migration stops the deploy; the running app is not touched,
5. replaces only the app container (`docker compose up -d --no-deps --wait app`; no `docker compose down`),
6. checks `http://127.0.0.1:3000/api/uptime` until it answers (120 s timeout, the job fails on timeout),
7. records the tag in `~/bingoscape/.deployed-tag` and in `IMAGE_TAG=` in `~/bingoscape/.env`.

The pulled tag is exactly what runs: `IMAGE_TAG` is passed to every `docker compose` call, and `docker-compose.yml` uses it for both the `app` and the `migrate` service.

### Rollback

If anything fails after the app container was replaced (container never becomes healthy, health check times out), the script automatically restores the app that was running before. It uses the image ID captured before the pull, so this also works when the tag is mutable (`main` deployed over `main`).

Important limits:

- A rollback restores the **app only**. Migrations are not reverted. Write migrations so the previous app version keeps working with the new schema (add columns/tables first, remove old ones in a later release). Restore a database backup with `scripts/restore-db.sh` if you really need to undo data changes.
- On the very first deploy there is no previous version, so nothing is rolled back; the failed container is left in place for inspection.
- The first deploy after switching to this workflow has no `.deployed-tag` yet. The rollback still works (it uses the running container) and restores the old image under the local tag `rollback`.
- Only the image tag is rolled back, not the `.env`. Older `.env` files are in `~/bingoscape/.env.backup.*`.

To go back to an older version later, run the Deploy workflow again with that tag (`sha-<short>` or a release tag).

### Verify a deployment

```bash
cat ~/bingoscape/.deployed-tag      # tag that was deployed last
cd ~/bingoscape && docker compose ps
docker compose logs --tail=50 app
curl -fsS http://127.0.0.1:3000/api/uptime
```

## Database Migration (`migrate.yml`)

Deploys already run migrations, so this workflow is only for running migrations without deploying. Manual only.

| Input       | Description                                           | Default |
| ----------- | ----------------------------------------------------- | ------- |
| `image_tag` | Tag of the migrator image to run (same tags as above) | `main`  |
| `confirm`   | Type `MIGRATE` to confirm                             | -       |

The job only runs when `confirm` is exactly `MIGRATE`. It pulls the migrator image for `image_tag`, takes a pre-deploy backup if PostgreSQL is running, and runs `docker compose run --rm migrate`. It shares a concurrency group with the deploy workflow so the two never run at the same time.

## Setup requirements

### GitHub secrets

All secrets are listed in [GITHUB-SECRETS.md](./GITHUB-SECRETS.md). `GITHUB_TOKEN` is provided automatically; it is used to push images (CI) and to pull them on the server (deploy, `packages: read`).

### GitHub Environment

Create an environment named `production` (**Settings -> Environments**). Both manual workflows run in it, so you can store secrets there and add protection rules (required reviewers, restrict to the `main` branch). There is no `staging` environment.

### GHCR packages

Packages are published by CI under the repository. After the first CI run, check **Packages -> bingoscape / bingoscape-migrator -> Package settings** that the repository has access, so `GITHUB_TOKEN` can pull them from the server. Making the packages public is optional.

### Workflow permissions

The workflows declare the permissions they need (`packages: write` for CI, `packages: read` for deploy). If a push still fails with `permission_denied`, check **Settings -> Actions -> General -> Workflow permissions** (see Troubleshooting).

### SSH access

On the server:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<public key>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Create the key pair with `ssh-keygen -t ed25519 -C github-actions -f github_actions_key`, put the public key on the server and the private key into the `SSH_PRIVATE_KEY` secret. The SSH user must be able to run `docker` (docker group). `sudo` without a password is only used, if available, to set the owner of `~/bingoscape/uploads` to UID 1001.

## Server layout (`~/bingoscape`)

| Path                 | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `docker-compose.yml` | copied by every deploy                                   |
| `.env`               | generated by every deploy from GitHub secrets (mode 600) |
| `.env.backup.*`      | previous `.env` files (newest 5 kept)                    |
| `.deployed-tag`      | image tag of the last successful deploy                  |
| `scripts/`           | copied by every deploy (backup, restore, deploy scripts) |
| `uploads/`           | user uploads, mounted into the app container             |
| `osrs-image-cache/`  | OSRS Wiki image cache (regenerable, not backed up)       |
| `backups/`           | database backups                                         |

Old images accumulate on the server (one per deployed tag). Clean up occasionally, e.g. `docker image prune -a --filter "until=720h"` (only removes images not used by a container).

## Using the images by hand

```bash
docker pull ghcr.io/bingoscape/bingoscape:main
docker pull ghcr.io/bingoscape/bingoscape:sha-abc1234
docker pull ghcr.io/bingoscape/bingoscape-migrator:v1.2.3

# On the server: run compose against a specific tag
cd ~/bingoscape
IMAGE_TAG=sha-abc1234 docker compose pull app migrate
```

For normal operations use the Deploy workflow, not manual compose commands: it takes the backup, runs the migrations and can roll back.

## Troubleshooting

### Image push fails with `permission_denied: write_package`

Repository **Settings -> Actions -> General -> Workflow permissions** -> "Read and write permissions", then re-run.

### Deploy fails: `manifest unknown` / `not found` on pull

The tag does not exist. Check **Packages** and that the CI run for that commit finished (both `build` jobs). The first CI run after this setup is what creates the `main`/`sha-*` tags and the `bingoscape-migrator` package.

### Deploy fails on a required secret

The "Render .env from secrets" step names the missing secret. Add it and re-run.

### SSH connection fails

Verify `SSH_HOST`, `SSH_PORT`, `SSH_USER` and `SSH_PRIVATE_KEY`, that the firewall allows GitHub runner IPs, and `sudo systemctl status ssh` on the server.

### Migration fails

The deploy stops before the app is replaced. Read the migrator output in the job log, fix the migration, publish a new image and deploy again. The backup taken just before is in `~/bingoscape/backups/pre-deploy/`. To check the database manually:

```bash
cd ~/bingoscape
docker compose ps postgres
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Deploy fails and rolls back

The job log shows the logs of the failed container and then the rollback result. Fix the problem, publish a new image and deploy again.

### `check` fails

Reproduce locally:

```bash
npm run lint -- --fix
npx tsc --noEmit
npm test        # needs Docker for the PostgreSQL testcontainer
```

## Useful commands

```bash
gh run list --workflow=ci-cd.yml
gh workflow run deploy.yml -f image_tag=sha-abc1234
gh workflow run migrate.yml -f image_tag=main -f confirm=MIGRATE
gh attestation verify oci://ghcr.io/bingoscape/bingoscape:main --owner bingoscape
```
