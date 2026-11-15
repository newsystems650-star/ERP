# NicCore Timber ERP — Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Unmatched collections and documents deny all reads and writes (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All reads and writes require a verified Firebase Auth user (`request.auth != null && request.auth.token.email_verified == true`).
3. **Strict Ownership & PII Isolation**: `users/{userId}` documents (containing email and name) can only be read or updated by the owning UID or a verified admin. `allow list` queries never rely on client filtering or `get()`/`exists()` calls; they validate `resource.data.ownerUid == request.auth.uid` (or `resource.data.uid == request.auth.uid` for `users`).
4. **Immutable Audit Trail**: `auditLogs/{logId}` documents are append-only (`allow update, delete: if false`).
5. **Terminal Invoice State**: Once an invoice reaches `CANCELLED`, non-admins cannot mutate it.
6. **Temporal Integrity & Strict Schema Keys**: Every write validates exact required/allowed keys (`hasAll` + `hasOnly`), field types, string length caps matching `firebase-blueprint.json`, ID regex `^[a-zA-Z0-9_\-]+$`, and server timestamps (`request.time`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read or write `/products/p1` with `request.auth == null`.
2. **Email Spoofing (`email_verified == false`)**: Admin email `newsystems650@gmail.com` with `email_verified: false` attempting to read `/users/u1`.
3. **Self-Assigned Admin Escalation**: Non-admin creating `/users/{uid}` with `role: 'ADMIN'`.
4. **Privilege Escalation Update**: Non-admin updating their own `/users/{uid}` changing `role` from `OPERATOR` to `ADMIN`.
5. **Shadow Field Injection**: Creating `/products/p1` with an undeclared ghost key `isDiscounted: true`.
6. **Cross-Owner Spoofing**: Creating `/tickets/tk1` with `ownerUid` set to another user's UID.
7. **PII Cross-User Read**: Non-admin reading `/users/other_uid`.
8. **Blanket List Scraping**: Listing `/tickets` where `resource.data.ownerUid != request.auth.uid` (non-admin).
9. **ID Poisoning**: Creating `/products/bad$id!!` or a 500-character ID violating `isValidId()`.
10. **Audit Log Tampering**: Updating or deleting an existing `/auditLogs/log1` document.
11. **Timestamp Forgery**: Creating `/invoices/inv1` with client-supplied `createdAt` instead of `request.time`.
12. **Terminal State Bypass**: Non-admin updating `/invoices/inv1` after `status == 'CANCELLED'`.
