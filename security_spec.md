# ZONE Platform Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified collection or document path is denied by default.
2. **Identity Integrity**: Every `Order`, `TopupRequest`, `UserProfile`, and `PublicActivity` record created by a customer must bind `userId` / `uid` strictly to `request.auth.uid`.
3. **RBAC Isolation**: Customers cannot self-assign admin privileges (`users` has no `role` field; `/admins/{uid}` writes are restricted strictly to verified bootstrapped super-admin `m36464697@gmail.com` with `email_verified == true` or existing admins).
4. **Catalog & Payment Integrity**: Only verified admins may create, modify, or delete `siteConfig`, `products`, `paymentMethods`, `vouchers`, and broadcast `notifications`.
5. **Relational Existence**: An `Order` cannot be created unless its referenced `productId` exists in `/products/{productId}` and `paymentMethodId` is either `'site_balance'` (with atomic balance deduction) or exists in `/paymentMethods/{methodId}`.
6. **PII Isolation**: Customer orders (including subscription login credentials and delivered account credentials) and top-up requests are strictly readable only by `resource.data.userId == request.auth.uid` or `isAdmin()`. Public bottom-left notifications read from `/publicActivity` which stores zero PII.
7. **Terminal State Locking**: Once an `Order` or `TopupRequest` reaches terminal status, non-admin users cannot alter it.
8. **Temporal Integrity**: `createdAt` and `updatedAt` fields must equal `request.time` on write, and `createdAt` is immutable on update.
9. **Verified Reviews Integrity**: A `ProductReview` can only be created by the owner of a `completed` `Order` matching the reviewed `productId`, with `reviewId == orderId`.
10. **Support Thread & Message Isolation**: Each customer support thread (`/supportThreads/{threadId}`) is isolated strictly to its owner (`threadId == auth.uid`) or `isAdmin()`.
11. **Wallet Balance & Voucher Atomicity**: Users initialize `walletBalance == 0` and can NEVER increase their own `walletBalance` arbitrarily; increases occur strictly via `isAdmin()` top-up approval or an atomic `writeBatch` redeeming an active, unexpired `'balance'` voucher that binds `existsAfter(/vouchers/{voucherId}/redemptions/{uid})`. Decreases during `'site_balance'` checkout require atomic deduction matching `totalAmount`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Order Creation**: `create /orders/o1` with `auth: null`.
2. **Identity Spoofing on Order**: `create /orders/o2` by `uid: "userA"` with `userId: "userB"`.
3. **Shadow Field Injection on Order**: `create /orders/o3` including ghost field `isAdminBypass: true`.
4. **Orphaned Product Reference**: `create /orders/o4` referencing `productId: "non_existent_game"`.
5. **Unverified Admin Email Spoof**: `write /siteConfig/main` with `email: "m36464697@gmail.com"` and `email_verified: false`.
6. **Self-Privilege Escalation**: `create /admins/attackerUid` by non-admin user.
7. **Cross-User Order Read**: `get /orders/userAOrder` by `uid: "userB"`.
8. **Blanket Order List Scraping**: `list /orders` without `where("userId", "==", uid)` by non-admin user.
9. **Arbitrary Balance Inflation**: `update /users/userA` setting `walletBalance: 99999` without admin or atomic balance voucher redemption.
10. **Double Voucher Redemption**: `create /vouchers/v1/redemptions/userA` when redemption already exists or voucher is expired.
11. **Resource Exhaustion ID Poisoning**: `create /orders/<200-char-invalid-id!@#>` with oversized/invalid ID.
12. **Client Timestamp Forgery**: `create /orders/o12` with forged `createdAt` not equal to `request.time`.
