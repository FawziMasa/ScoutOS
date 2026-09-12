# ScoutOS access control and multi-unit leaders

ScoutOS uses four roles and enforces permissions in the backend. Frontend route
visibility is only a convenience; every protected API performs its own access
check.

| Capability | Admin | Group Leader | Unit Leader | Scout |
| --- | --- | --- | --- | --- |
| Manage accounts and roles | All | No | No | No |
| Manage Scouts | All units | All units | Assigned units | No |
| Award or deduct points | All units | All units | Assigned units | No |
| Take attendance | All units | All units | Assigned units | No |
| Read private Scout data | All units | All units | Assigned units | Own record |
| View leaderboard, events, Gallery | Yes | Yes | Yes | Yes |
| Upload Gallery photos | Yes | Yes | Own uploads | No |
| Finance | All units | All units | Assigned units | No |

## Data model

- `units` is the canonical unit catalog.
- `user_units` is a many-to-many relation with primary key
  `(user_id, unit_id)`. The key prevents duplicate assignments and both lookup
  directions are indexed.
- `users.scout_id` optionally links a login to one Scout. Its unique index
  prevents multiple login accounts from being linked to the same Scout.
- `users.unit` remains temporarily as a compatibility field. It stores the
  first assigned unit for older deployments; authorization uses `user_units`.

`ensureCoreSchema()` creates this structure and backfills every existing
single-unit leader into `user_units` without deleting the legacy value.

## Operational behavior

Authenticated user responses include `assignedUnits`, `scoutId`, and a typed
`permissions` object. Unit IDs sent by a browser are validated against active
database units. Scout, point, attendance, event-registration, and finance
operations use the authenticated database account rather than actor, role, or
unit values supplied by the browser.

Deleting an account deactivates it and increments `session_version`; historical
records keep their actor reference. Deleting a Scout through the API archives
the Scout as inactive, preserving attendance and point history.
