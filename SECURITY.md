# Prototype security boundary

This code is **not production safe**. It has no authentication, authorization, rate limiting, persistence, anti-abuse controls, or payment integration. The caller-provided ownerId is untrusted. The HTTP server listens only on localhost and must not be deployed to a public host.

Before any public release: add verified identity, durable transactional persistence, owner authorization, request limits, audit integrity, independent security review, privacy assessment, and legal review. Never use this prototype to issue grants or custody assets.

Mainnet/token distribution: HOLD.
