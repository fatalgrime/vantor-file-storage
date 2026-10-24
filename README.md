# Vantor file storage

Next.js application with Clerk authentication, Neon metadata, and private R2 objects (or PostgreSQL blob storage).

## Run and verify

Use Node.js 22+, run `npm ci`, and configure `.env.local` with the existing Clerk and `DATABASE_URL` credentials. R2 additionally uses `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

```
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

The automated API tests use an in-memory SQL adapter and mocked identity and object storage; they never access production data. They exercise the actual route handlers, permissions, admission races, conflict handling, and recovery. Before deploying, also smoke-test uploads, media seek, password links, and concurrent saves against a staging Clerk/Neon/R2 configuration.

## Accounts and permissions

New accounts are registered from the authenticated Clerk profile with the `viewer` role. Client requests cannot register themselves, merge identities by email, choose a role, or change another user. Existing persisted administrators retain their role. For an empty database, set `VANTOR_ADMIN_USER_IDS` to a comma-separated list of trusted Clerk user IDs **before those accounts first sign in**. Once registered, manage their roles in the administrator interface; changing this variable does not promote an already registered account.

Locked accounts cannot read storage state, mutate metadata, upload, preview, or download. The state endpoint filters repositories, files, folders, comments, users, shares, and history on the server. Administrators alone manage users, platform settings, repository membership, and existing item policies. Editors may create content in permitted destinations and manage their own shares. Managers and administrators may delete content.

## Storage and concurrent edits

On first use, the app applies idempotent, additive schema changes: a revision column, immutable upload manifests, share sessions, and password-attempt counters. Legacy share passwords are hashed with salted scrypt before any state response is returned. Back up the database before deploying schema changes. Deploy the new client and API together: the old whole-state PATCH protocol is deliberately rejected.

The client sends individual record mutations with the previous visible record. The API compares those records against the current authorized view, validates permissions, and uses a database revision compare-and-swap to commit the complete operation atomically. Unrelated concurrent edits are preserved; conflicting edits return HTTP 409. Local requests are serialized. On failure the UI reloads server state, rolls back optimistic changes, and displays the error.

Uploads authorize the destination before reading bytes, enforce the 50 MB limit while reading, and create random, immutable server-owned storage IDs. Saving metadata requires the same uploader and destination recorded in the upload manifest, and a completed upload cannot be attached twice. Content URLs and R2 keys supplied by callers are not trusted. R2 failures fail the upload so the user can retry; they do not silently switch storage backends. Uploads without R2 configuration use PostgreSQL blobs. In the upload form, choose **New content version of…** to replace an existing file while preserving its logical ID, location, metadata, permissions, comments, and links. The previous content is retained in file history.

Deleted repositories and complete folder subtrees are retained as recoverable groups. Their public shares are revoked and stay revoked after restoration. File changes retain the last 20 content/metadata history entries per file. Administrators can restore them in **Admin → Audit Logs → Recovery and file history**, alongside the existing activity history. Content versions restore earlier bytes and metadata; metadata versions preserve the current bytes. Restoring fails if IDs conflict or a required parent/repository is missing. Recoverable files, retained content versions, and unattached uploads count toward an atomically reserved 50 GB capacity. Original blob content is retained until an explicit retention/purge policy is implemented; monitor database and bucket usage, including unattached uploads after interrupted saves. A metadata-save retry reuses the completed upload during the current browser session.

## Private downloads and links

Every preview/download is streamed through a permission-checked endpoint with private, no-store caching. Storage keys and long-lived signed URLs are omitted from state responses. **Disable public bucket access, R2.dev access, and public custom domains in Cloudflare before deploying.** Removing the old `R2_PUBLIC_DOMAIN` application setting alone does not revoke public URLs or copies already cached by browsers/CDNs. Existing externally issued signed URLs remain valid until their expiry. Previously exposed public files may require cache purging and object-key rotation. The app cannot revoke copies already downloaded.

Share tokens use cryptographic UUIDs. Passwords travel in a POST body and are stored as salted hashes, with persistent password-attempt limits (10 attempts per link per five minutes). A successful admission creates a 15-minute HttpOnly, SameSite cookie scoped to the public API. The session grant and access counter are committed in one SQL statement. One-time links admit one browser session; that session can browse/preview until its expiry. Access limits count admitted sessions, rather than each image/video range request. Existing admitted sessions remain valid at the visit limit, but expiry, target deletion, revocation, password changes, and disabled downloads are checked on file requests.

Preview access necessarily transfers file bytes. Disabling downloads removes the download action and blocks attachment requests; it cannot prevent an authorized recipient from retaining preview bytes or taking screenshots. Uploaded HTML/SVG receives a sandboxed content policy and `nosniff` headers. Text previews load lazily through the same authorized route and are limited to 2 MB.

Share sessions and attempt records should be periodically pruned by a maintenance job, e.g. deleting sessions with `expires_at < NOW()` and attempt windows older than a day. Run maintenance using an appropriately scoped database account. No production data is changed by the test/build commands.
