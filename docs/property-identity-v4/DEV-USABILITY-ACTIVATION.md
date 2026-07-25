# Property Identity dev usability activation

Date: 2026-07-25

Environment: `kvartal-dev`

Status: active for the Moscow market in `NEW_SUBMISSIONS_ONLY` mode.

## User meaning

A registration submission is not a request sent to Fixer.guru for approval. It is an author-owned draft used to create or find one canonical record for the same physical property:

1. the author enters the property and its official identifier;
2. the registry checks whether that physical property already exists;
3. the author either creates a new canonical record or links to the existing record.

The ordinary workflow has no platform approval queue. The author edits, checks and confirms the registration.

## Usability correction

- Renamed ambiguous request-oriented UI copy to registration-oriented copy.
- Added a visible three-step explanation: fill property, check duplicates, confirm result.
- Added a clear empty state explaining what appears after a draft is created.
- The Moscow form now defaults jurisdiction to `RU` and the supported identifier to `CADASTRAL_ID` / `ROSREESTR`.
- The dedicated KVARTAL cabinet now filters registry offices to `kvartal-moscow` instead of showing the first office from another actor membership.
- Active organization owners/admins can select active offices in their own organization without a redundant office membership; the API still verifies that the office belongs to the organization and is active.

## Controlled dev activation

- Market: `moscow-commercial`.
- Rollout mode: `NEW_SUBMISSIONS_ONLY`.
- Registry enabled: yes.
- Publication gate: no.
- Active authority policies:
  - jurisdiction `RU`;
  - scheme `CADASTRAL_ID`;
  - authority namespace `ROSREESTR`;
  - normalizer `alphanumeric-v1` version 1;
  - physical scopes `LAND_PARCEL`, `BUILDING`, `PREMISE`, `UNIT`.

Other markets remain disabled until their real authority namespaces and identifier rules are reviewed. No generic wildcard or invented authority rule was enabled.

## Deployment

- Source commit: `a4d5bb5b9c047b810a4594d2ef66434969879df6`.
- Office API image digest: `sha256:1e7537b5f75a2dafa3b6165bbbaa386704855dd90de9e462e1ad55ec5dff99a3`.
- Serving office API revision: `kvartal-office-api-piuse-a4d5bb5` at 100% dev traffic.
- App Hosting build: `build-pi-usability-a4d5bb5` on `partner-admin-dev` and `kvartal-admin-dev`; both reached `READY`.
- App Hosting rollout: `rollout-pi-usability-a4d5bb5`; both reached `SUCCEEDED`.

## Verification

- Property Identity unit tests: 7 passed.
- Office API TypeScript check: passed.
- Partner Admin production build: passed.
- KVARTAL Admin production build: passed.
- Office API authenticated readiness: `200`, database ready.
- Real Firebase-session hosted-page test for `abtiurin@gmail.com`: `200`; new title, create button and ROSREESTR policy rendered.
- Real Firebase-session hosted-page test for `office@integrayachtsuae.com`: `200`; create-registration button rendered twice.
- Temporary verification jobs and temporary service-account signing permission were removed.
- Local Cloud SQL Auth Proxy was stopped.
