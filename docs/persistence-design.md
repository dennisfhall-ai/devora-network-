# Durable registry and authentication design

Status: proposal, not implemented. No deployment authorized.

## Identity
- Use a standards-based OIDC provider.
- Validate issuer, audience, signature, expiry and nonce/state as appropriate in a trusted server-side adapter.
- Bind authenticated subject to every project and application; never trust an ownerId supplied in JSON.
- Never expose a caller-settable verified flag over HTTP.

## Durable storage
- Use a transactional relational database for projects, applications, and audit events.
- projects: id (UUID PK), owner_subject, title, description, status, created_at.
- applications: id (UUID PK), project_id (FK), applicant_subject, statement, status, created_at.
- Unique constraint on (project_id, applicant_subject).
- audit_events: event_id, actor_subject, action, object_id, created_at, correlation_id.
- Apply migrations and test restart recovery, transaction rollback and concurrent duplicate submissions.
- Separate private applicant data from public project listings.

## Threat and release gates
- Role-based access control for review decisions; applicants cannot approve their own requests.
- Server-side rate limiting and safe error messages.
- Privacy and retention policy before collecting personal information.
- Independent review of the exact PR head and verified test run.
- No money movement, token minting, wallet custody, public deployment or mainnet activity.
