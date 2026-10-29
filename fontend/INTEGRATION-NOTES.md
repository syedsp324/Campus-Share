# CampusShare frontend integration patch — 29 Oct 2026

This overlay updates the resource and booking UX. It is intended for the real `app/` backend repository, not the standalone mock demo.

## UI changes
- Booking form now asks for a campus-local start time and duration (0.5-hour increments, capped by `maxBookingLengthHours`) and derives the end time. The server still owns validation, eligibility, quotas and conflict checks.
- Resource edit form adds an Active/Inactive toggle. Inactive resources should be omitted from normal discovery by the existing database policy/action and remain visible to their owner.
- `ResourceSummary` includes `ownerId`; owner listings are filtered to the authenticated owner's resources in the UI.
- Visual polish: softer campus-tech background, sticky translucent nav, stronger form hierarchy, accessible focus rings and responsive spacing.

## Required backend contract alignment before using this overlay

The backend action files are not included in this overlay. Update the real `app/actions/resources.ts` to match these contracts before running typecheck:

1. Import `UpdateResourceInput` from `src/types/resource.ts`.
2. Change `updateResource(resourceId, input)` to accept `UpdateResourceInput`.
3. Map `owner_id` to `ownerId` in every resource response (`listResources`, `getResource`, create/update results).
4. Validate and allowlist only the supported update fields. For `isActive`, persist to the existing `resources.is_active` column. Do not accept an ownerId from the browser as authority; preserve the database owner_id and authorize against the authenticated actor.
5. Ensure `listResources` for normal discovery returns active resources only, while the owner-management query can return inactive resources owned by that owner. Existing RLS allows owners to see their own inactive rows, but the action/query must not accidentally filter those out for the management screen.
6. Keep manager/admin authorisation server-side. The UI ownerId filter is convenience only, not security.

No database migration is required for `is_active` or `owner_id`; both columns already exist in the handoff schema.

## Verification
From the actual project root in PowerShell:
```powershell
npx tsc --noEmit
npm run build
```
Resolve any type mismatch against the actual action signatures rather than casting around it. Then test:
- Student booking a 30-minute, 1-hour and maximum-duration session.
- Duration cannot exceed the resource's maximum in the UI; server rejects a forged/over-limit request too.
- Owner deactivates a resource; it disappears from student discovery but remains in Manage resources.
- Owner A cannot manage Owner B's resources; backend must reject direct action attempts even if a request is forged.
