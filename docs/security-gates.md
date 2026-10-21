# Security gates before public release

Current prototype is localhost-only and must not be deployed publicly.

1. Replace client-supplied ownerId with verified server-side identity.
2. Add durable transactional storage with uniqueness constraints.
3. Add request limits, safe error codes and privacy controls.
4. Independently review all changes at the exact commit SHA.
5. Require explicit founder approval before merge or deployment.
6. Keep token issuance, payments, and public distribution on HOLD pending legal review.

The initial two unit tests were run locally and passed. They do not prove production security.
