\# Security Audit Report — Budi Chat (AI Chat Hub)



\*\*Date:\*\* 2026-04-16

\*\*Auditor:\*\* Claude Code (claude-sonnet-4-6)

\*\*Scope:\*\* Full-stack — backend (Node.js/Express), frontend (React/Vite), infrastructure (Docker), dependencies

\*\*Branch audited:\*\* `main`



\---



\## Executive Summary



| Severity | Count | Description |

|---|---|---|

| \*\*5 — Critical\*\* | 6 | Auth bypass, RCE, stored XSS, wildcard CORS |

| \*\*4 — High\*\* | 12 | SSRF, brute force, missing headers, CSRF, file upload bypass |

| \*\*3 — Medium\*\* | 9 | SQL construction, authorization gaps, session management |

| \*\*2 — Low\*\* | 6 | Input validation, logging, race conditions |

| \*\*1 — Info\*\* | 5 | Config hygiene, CI/CD, dependency pinning |

| \*\*Total\*\* | \*\*38\*\* | |



\---



\## Top 5 Highest-ROI Fixes



1\. \*\*Require `JWT\_SECRET` env var\*\* — remove hardcoded fallback, pin algorithm to `HS256`

2\. \*\*Lock down CORS\*\* — replace `origin: true` with an explicit allowlist

3\. \*\*Replace `Function()` with a math parser\*\* — eliminate the server-side RCE vector

4\. \*\*Add `helmet` middleware\*\* — one line provides CSP, X-Frame-Options, HSTS, and more

5\. \*\*Add `express-rate-limit`\*\* — protect auth endpoints and message creation from brute force



\---



\## Critical (5/5) — Immediate Action Required



\### C1. Hardcoded Default JWT Secret

\*\*`server/middleware/auth.js:4`\*\*

```js

const JWT\_SECRET = process.env.JWT\_SECRET || 'your-super-secret-jwt-key-change-this';

```

\*\*Impact:\*\* If `JWT\_SECRET` is not set in the environment, any attacker who knows this default string can forge JWT tokens as any user, including admins — complete authentication bypass.

\*\*Fix:\*\* Remove the fallback entirely. Throw an error at startup if `JWT\_SECRET` is not set.



\---



\### C2. JWT Algorithm Not Pinned — Algorithm Confusion Attack

\*\*`server/middleware/auth.js:30`\*\*

```js

const decoded = jwt.verify(token, JWT\_SECRET);

```

\*\*Impact:\*\* Without specifying `algorithms: \['HS256']`, the library may accept tokens signed with `none` or using a different algorithm, enabling authentication bypass.

\*\*Fix:\*\* `jwt.verify(token, JWT\_SECRET, { algorithms: \['HS256'] })`



\---



\### C3. JWT Token Accepted from Query Parameters

\*\*`server/middleware/auth.js:20-22`\*\*

```js

if (!token \&\& req.query \&\& req.query.token) {

&#x20; token = req.query.token;

}

```

\*\*Impact:\*\* Tokens in URLs appear in server logs, browser history, `Referer` headers, and proxy logs — leading to session hijacking via token leakage.

\*\*Fix:\*\* Accept tokens only from `Authorization` header and `httpOnly` cookies. Remove query parameter token support entirely.



\---



\### C4. Wildcard CORS with Credentials Enabled

\*\*`server/index.js:32-35`\*\*

```js

app.use(cors({

&#x20; credentials: true,

&#x20; origin: true   // reflects any origin

}));

```

\*\*Impact:\*\* Any website can make credentialed requests on behalf of logged-in users. This enables cross-origin credential theft and CSRF at scale.

\*\*Fix:\*\* Replace `origin: true` with an explicit allowlist, e.g.:

```js

origin: process.env.ALLOWED\_ORIGINS?.split(',') || 'http://localhost:9000'

```



\---



\### C5. Remote Code Execution via `Function()` Constructor

\*\*`server/services/ai.js:369`\*\*

```js

const result = Function(`'use strict'; return (${sanitized})`)();

```

\*\*Impact:\*\* The `Function()` constructor is equivalent to `eval`. Despite regex sanitization, creative payloads can escape the filter and execute arbitrary server-side code.

\*\*Fix:\*\* Replace with a safe math expression parser such as `mathjs` or `expr-eval`.



\---



\### C6. Stored XSS via `innerHTML` with Unsanitized Filename

\*\*`client/src/pages/Chat.jsx:2803`\*\*

```js

e.target.parentElement.innerHTML = `...${att.original\_name}...</div>`;

```

\*\*Impact:\*\* `att.original\_name` is user-controlled and injected directly into the DOM without sanitization. An attacker uploads a file named `"><img src=x onerror=alert(1)>` and the script executes in every viewer's browser.

\*\*Fix:\*\* Build the DOM nodes using `document.createElement` / `textContent`, or sanitize with `DOMPurify.sanitize()` before assignment.



\---



\## High (4/5) — Fix in the Next Release



\### H1. SSRF — No Internal IP Blocking on Web Fetch Tool

\*\*`server/services/ai.js:291-307`\*\*

The URL validation only checks for an `http://` or `https://` prefix. Private/internal ranges (127.0.0.1, 169.254.x.x, 10.x.x.x, 192.168.x.x, 172.16-31.x.x) are not blocked. An attacker can exploit the AI agent's web fetch tool to probe internal services, cloud metadata endpoints (169.254.169.254), or internal APIs.

\*\*Fix:\*\* Resolve the hostname and reject requests to RFC-1918 and link-local ranges using a library like `is-ip` or a custom blocklist.



\---



\### H2. No Rate Limiting on Authentication Endpoints

\*\*`server/routes/auth.js:36-150`\*\*

`/api/auth/login` and `/api/auth/register` have zero rate limiting, enabling unlimited brute-force and credential-stuffing attacks.

\*\*Fix:\*\* Add `express-rate-limit` with a limit of \~5–10 requests per minute per IP on auth routes.



\---



\### H3. No Password Strength Requirements

\*\*`server/routes/auth.js:49-62`\*\*

Any string is accepted as a password, including single characters. No minimum length, no complexity check.

\*\*Fix:\*\* Enforce a minimum of 8 characters and at least one non-alpha character at registration and password change.



\---



\### H4. 7-Day JWT Expiry with No Revocation

\*\*`server/middleware/auth.js:78`\*\*

```js

return jwt.sign(payload, JWT\_SECRET, { expiresIn: '7d' });

```

A stolen token remains valid for a full week with no way to invalidate it.

\*\*Fix:\*\* Reduce expiry to 1–2 hours. Implement a refresh token flow or a server-side token blacklist for logout.



\---



\### H5. Missing Security Headers (No Helmet)

\*\*`server/index.js`\*\*

No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Permissions-Policy` headers are set. Enables clickjacking, MIME sniffing, and weakens XSS defenses.

\*\*Fix:\*\* `npm install helmet` then `app.use(helmet())` as the first middleware.



\---



\### H6. Docker Container Runs as Root

\*\*`Dockerfile`\*\*

No `USER` directive. If the Node.js process is compromised, the attacker gains root access inside the container.

\*\*Fix:\*\* Add `USER node` before the `CMD` instruction.



\---



\### H7. Unsanitized HTML in Search Snippets

\*\*`client/src/components/SearchModal.jsx:106`\*\*

```js

const renderHighlightedText = (html) => {

&#x20; return <span dangerouslySetInnerHTML={{ \_\_html: html }} />;

};

```

Server-returned search snippets (chat titles, message content) are rendered without `DOMPurify`. Any sanitization gap on the backend produces XSS.

\*\*Fix:\*\* Wrap the value: `DOMPurify.sanitize(html)` before passing to `dangerouslySetInnerHTML`.



\---



\### H8. Timing Attack on Login — User Enumeration

\*\*`server/routes/auth.js:104-150`\*\*

The combined check `!user || !bcrypt.compareSync(...)` returns immediately for non-existent users but runs bcrypt for existing ones. Response time differences reveal which emails are registered.

\*\*Fix:\*\* Always call `bcrypt.compare` even for non-existent users (compare against a dummy hash).



\---



\### H9. No CSRF Protection

\*\*`server/index.js`\*\*

No CSRF tokens or middleware are implemented. Combined with the wildcard CORS (C4), any site can forge state-changing requests on behalf of authenticated users.

\*\*Fix:\*\* Implement `csurf` middleware or the double-submit cookie pattern for all mutating endpoints.



\---



\### H10. File Upload MIME Type Spoofing

\*\*`server/routes/uploads.js:33-55` / `server/routes/memories.js:35-42`\*\*

Validation relies solely on `file.mimetype`, which is client-controlled HTTP header. A malicious file can carry any MIME type the uploader chooses.

\*\*Fix:\*\* Inspect file magic numbers server-side using `file-type` npm package before accepting uploads.



\---



\### H11. User API Keys Stored in Plaintext

\*\*`server/database.js:32`\*\*

```sql

openai\_api\_key TEXT

```

All user API keys are stored unencrypted in SQLite. A database compromise or SQL injection exposes every key.

\*\*Fix:\*\* Encrypt API key fields at rest using a server-side encryption key (e.g., AES-256-GCM via Node's `crypto` module).



\---



\### H12. Unsafe Syntax Highlighting via `innerHTML`

\*\*`client/src/components/Canvas.jsx:190`\*\*

```js

<code dangerouslySetInnerHTML={{ \_\_html: highlightCode(content, language) }} />

```

A custom regex-based highlighter processes AI-generated code content and outputs raw HTML. Edge cases in the regex can leave XSS payloads intact.

\*\*Fix:\*\* Replace the custom highlighter with `highlight.js` or `Prism`, which escape output safely by design.



\---



\## Medium (3/5) — Plan Remediation



\### M1. Dynamic SQL Column Names — No Whitelist Validation

\*\*`server/routes/chats.js:213-215`, `workspaces.js:150-152`, `personas.js:169-171`, `admin.js:171-173`\*\*

```js

db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`).run(...values);

```

Column names are built from conditional checks on `req.body`, but no strict whitelist is enforced. Future refactors could inadvertently introduce exploitable patterns.

\*\*Fix:\*\* Define an explicit array of allowed field names and validate each entry before adding to the `updates` array.



\---



\### M2. Missing Authorization on Persona Assignment

\*\*`server/routes/chats.js:108-150, 168-222, 253-268`\*\*

Users can assign any `persona\_id` (including another user's private personas) to chats and forks without ownership validation. The database foreign key constraint may silently fail or produce a generic 500 error.

\*\*Fix:\*\* Query the persona table to verify ownership (`user\_id = ? OR is\_default = 1`) before allowing assignment.



\---



\### M3. No Token Invalidation on Logout

\*\*`server/middleware/auth.js`\*\*

Logout is client-side only (token deletion from storage). The JWT itself remains cryptographically valid until expiry.

\*\*Fix:\*\* Maintain a server-side token blacklist (in-memory or Redis) and check it on every authenticated request.



\---



\### M4. Password Change Without Current Password Verification

\*\*`server/routes/auth.js:203-206`\*\*

```js

if (password) {

&#x20; updates.push('password = ?');

&#x20; values.push(bcrypt.hashSync(password, 10));

}

```

A compromised session can change the password without knowing the current one, permanently locking out the legitimate owner.

\*\*Fix:\*\* Require `current\_password` in the request body and verify it via `bcrypt.compare` before allowing a password change.



\---



\### M5. Unlimited Memory Images — Resource Exhaustion

\*\*`server/routes/messages.js:89`\*\*

```js

const MAX\_MEMORY\_IMAGES = null;

```

No cap on images injected into context. A user with thousands of memory images can exhaust server RAM and generate enormous API costs in a single request.

\*\*Fix:\*\* Set `MAX\_MEMORY\_IMAGES` to a reasonable value (e.g., 10) and make it configurable via environment variable.



\---



\### M6. In-Memory Rate Limiting Only

\*\*`server/services/ai.js:213-234`\*\*

Tool call rate limits are stored in a `Map`. Limits reset on server restart and are not shared across multiple instances.

\*\*Fix:\*\* Move rate limit state to Redis or the SQLite database for persistence and multi-instance correctness.



\---



\### M7. No HTTPS in Docker Compose

\*\*`docker-compose.yml`\*\*

Port 35005 is exposed without TLS. All traffic — including tokens and messages — travels unencrypted over the network.

\*\*Fix:\*\* Front the application with an nginx or Traefik reverse proxy configured with TLS certificates (Let's Encrypt).



\---



\### M8. No Audit Logging for Sensitive Operations

Admin actions, user deletions, API key changes, and password resets produce no structured log entries. Security incident investigation is impossible.

\*\*Fix:\*\* Log all sensitive operations (who, what, when, from which IP) to a dedicated audit table or structured log output.



\---



\### M9. `sameSite: 'lax'` on Auth Cookie

\*\*`server/routes/auth.js:78`\*\*

```js

sameSite: 'lax'

```

`lax` allows cookies to be sent on top-level cross-site navigations (e.g., link clicks from external sites), which can enable CSRF in some scenarios.

\*\*Fix:\*\* Change to `sameSite: 'strict'`.



\---



\## Low (2/5) — Improve When Convenient



\### L1. JWT Also Stored in `localStorage`

\*\*`client/src/App.jsx:28, 64, 84`\*\*

The JWT is stored in `localStorage` in addition to cookies. Any XSS vulnerability immediately enables full account takeover via `localStorage.getItem('token')`.

\*\*Fix:\*\* Rely exclusively on `httpOnly` cookies for token storage.



\---



\### L2. No Input Length Validation

Chat titles, system prompts, memory content, and usernames accept arbitrarily long strings. This enables database bloat and potential DoS via resource exhaustion.

\*\*Fix:\*\* Add server-side length validation on all user-supplied text fields (e.g., title ≤ 255, system\_prompt ≤ 10,000).



\---



\### L3. FTS5 Query Injection

\*\*`server/services/ai.js:406-417`\*\*

The search query sanitizer strips most special characters but does not prevent FTS5 operators (`AND`, `NOT`, `NEAR`) from appearing in search terms, which could manipulate search results.

\*\*Fix:\*\* Escape or strip FTS5 operator keywords before building the search query.



\---



\### L4. Stack Traces Leaked via `console.error`

Multiple route files log full error objects including stack traces. If logs are accessible (e.g., via a monitoring dashboard), they leak internal file paths and library versions.

\*\*Fix:\*\* In production, log a sanitized message only. Use structured logging (e.g., `pino`) with log levels.



\---



\### L5. Race Condition in Chat Fork

\*\*`server/routes/chats.js:271-275`\*\*

If the provided `message\_id` does not belong to the target chat, the subquery returns `NULL` and the fork silently succeeds with zero messages copied, causing data loss with no error.

\*\*Fix:\*\* Validate that `message\_id` exists in the chat before forking; return a 400 error if not found.



\---



\### L6. No Input Validation on `thinking\_mode`

\*\*`server/routes/chats.js:168-222`\*\*

`thinking\_mode` is stored without validation against the expected values (`light`, `medium`, `deep`), allowing arbitrary strings into the database.

\*\*Fix:\*\* Validate against an explicit allowlist before accepting the value.



\---



\## Informational (1/5)



\### I1. Default Credentials in `.env.example`

`ADMIN\_EMAIL=admin@example.com` / `ADMIN\_PASSWORD=admin123` — developers may deploy without changing these.

\*\*Fix:\*\* Replace with clearly invalid placeholder values (e.g., `ADMIN\_PASSWORD=CHANGE\_ME\_BEFORE\_DEPLOYING`).



\---



\### I2. No Dependency Vulnerability Scanning

No `npm audit`, Dependabot, or Snyk integration is configured. Vulnerable transitive dependencies will not be automatically detected.

\*\*Fix:\*\* Add `npm audit --audit-level=high` as a CI step; enable Dependabot alerts on the repository.



\---



\### I3. Docker Image Uses `:latest` Tag

\*\*`docker-compose.yml:3`\*\*

```yaml

image: ajaxx123/budi-chat:latest

```

The `latest` tag is not reproducible and can pull unexpected breaking changes.

\*\*Fix:\*\* Pin to a specific version tag (e.g., `v1.2.0`).



\---



\### I4. No Subresource Integrity on Google Fonts

\*\*`client/index.html:31-33`\*\*

Google Fonts are loaded without SRI hashes. A CDN compromise could inject malicious CSS.

\*\*Fix:\*\* Add `integrity` and `crossorigin` attributes with a valid hash, or self-host the fonts.



\---



\### I5. Source Maps May Be Exposed in Production

Vite's default build configuration may emit source maps, revealing original source code to any user who opens DevTools.

\*\*Fix:\*\* Confirm `sourcemap: false` (or `'hidden'`) is set in `vite.config.js` under `build`.



\---



\## Remediation Roadmap



\### Immediate (this sprint)

\- \[ ] C1 — Remove hardcoded JWT secret fallback

\- \[ ] C2 — Pin JWT algorithm to HS256

\- \[ ] C3 — Remove query-parameter token support

\- \[ ] C4 — Restrict CORS to explicit origin allowlist

\- \[ ] C5 — Replace `Function()` with a math expression parser

\- \[ ] C6 — Fix `innerHTML` XSS in `Chat.jsx`



\### Short-term (next 1–2 sprints)

\- \[ ] H1 — Block SSRF to private IP ranges

\- \[ ] H2 — Add `express-rate-limit` on auth endpoints

\- \[ ] H5 — Add `helmet` middleware

\- \[ ] H6 — Add `USER node` to Dockerfile

\- \[ ] H7 — Sanitize search snippets with DOMPurify

\- \[ ] H9 — Add CSRF protection

\- \[ ] H11 — Encrypt API keys at rest

\- \[ ] M4 — Require current password for password changes

\- \[ ] M5 — Cap memory image count



\### Medium-term (next quarter)

\- \[ ] H3 — Password strength requirements

\- \[ ] H4 — Shorter JWT expiry + refresh token flow

\- \[ ] H8 — Fix login timing attack

\- \[ ] H10 — Magic number file upload validation

\- \[ ] H12 — Replace custom syntax highlighter

\- \[ ] M1 — Whitelist SQL column names

\- \[ ] M2 — Validate persona ownership

\- \[ ] M3 — Server-side token blacklist

\- \[ ] M6 — Persist rate limits in Redis/SQLite

\- \[ ] M7 — Configure TLS via reverse proxy

\- \[ ] M8 — Add structured audit logging



\### Long-term / Ongoing

\- \[ ] L1–L6 — Input validation, localStorage cleanup, race conditions

\- \[ ] I1–I5 — Config hygiene, dependency scanning, SRI, source maps



