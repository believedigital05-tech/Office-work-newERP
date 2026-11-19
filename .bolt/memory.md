# Project memory

## Product intent & audience

- Tax/records management application (Indian Financial Year context) for managing file records, cabinets, activities, movements, reports, and dashboards.
- Users interact with FY/AY selectors across multiple modules: file creation/editing, cabinet management, search/filters, activities, file movement history, dashboard/stats, reports/exports, and detail views.
- Admins can manage year option lists via a Settings page.

## Brand personality & voice

- Administrative/professional tone; user-facing release notes are concise and feature-focused.

## Visual design & UX direction

- Framework: Vite + React.
- App shell includes a sidebar that displays the application version (updated from `v4.3.0` to `v5.0.0`).
- No About panel or dedicated release-notes screen exists yet — version is only shown in the sidebar.
- Top bar contains header year selector (FY/AY pickers) used app-wide.
- File form includes year dropdowns that auto-update AY when FY changes; both remain manually editable.
- Settings dropdown page includes admin entry for adding new year labels with format validation (`YYYY-YY`).
- Responsive target: desktop and mobile.

## Decisions, constraints & rationale

- **Centralized FY/AY logic**: A single year helper module is the authoritative calculation system; all modules must use it to prevent inconsistent results.
- **AY = FY + 1**: Assessment Year is always the Financial Year plus one year (e.g., FY `2025-26` → AY `2026-27`).
- **FY label format**: `YYYY-YY` — four-digit starting year, two-digit ending year (e.g., `2025-26`). Malformed labels like `2029-20` were the root-cause bug.
- **Database year tables**: FY table covers 2000–2039 (40 rows), AY table covers 2001–2040 (40 rows). Labels were repaired in place; no rows lost.
- **No data loss rule**: Previously saved file records retain their original FY/AY text values — never overwrite or migrate existing user data.
- **Root-cause fixes only**: No temporary UI-only patches; repair source data and calculation logic.
- **Preserve existing systems**: Authentication, permissions, overall design, and functionality must not be disrupted.
- Version bumped to **5.0.0**.

## Open questions & assumptions

- User was offered an optional "About" section with release notes; not yet confirmed or built — no About/release-notes UI currently exists.
- Assumption: year option lists are database-driven (not hardcoded), so admin-added labels must pass `YYYY-YY` validation.
- Assumption: no other version display surfaces exist beyond the sidebar (login screen, footer, About panel were checked and not found).