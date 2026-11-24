# OnNow: demonstration platform

> **All data in this project is fictional.** Organisations, services, locations, contact details, sources and verification statuses are made up for demonstration. No real provider has confirmed anything shown.

OnNow is a social service intelligence and collaboration platform for welfare organisations, interagency networks, councils and government. This folder contains a **demonstration** for the Western Sydney pilot (Blacktown City Council and the City of Parramatta).

It has three pages, all sharing one header, one set of filters and one dataset:

| Page | Purpose |
|---|---|
| **Explore Activities** | Find services: map, register, filters and details. |
| **Service Insights** | Find opportunities: service overlaps, collaboration opportunities and recorded gaps, from a council view or an agency view. |
| **Reports** | Plan and collaborate: council and agency reports, with a preview and an editable Word (.docx) download. |

## How to open it

1. Open this folder (`Documents\OnNow`) in File Explorer.
2. Double-click **`index.html`**. It opens in your web browser.

You don't need to install anything. Map images come from OpenStreetMap, so maps need an internet connection. Everything else works offline.

## What's in the folder

| File | What it does |
|---|---|
| `index.html` | Page structure: header, navigation, the three pages. |
| `styles.css` | Visual identity (logo colours, typography, buttons, filters) and Explore Activities. |
| `analysis.css` | Service Insights, Reports and collaboration graphics. |
| `shared.js` | Brand palette, icon set, service category icons and colours, councils, shared filters, navigation. |
| `analysis.js` | All calculations: overlaps, gaps and the seven collaboration opportunity types. |
| `app.js` | Explore Activities. |
| `insights.js` | Service Insights, and the collaboration diagrams. |
| `reports.js` | Council and agency reports (preview and Word download). |
| `docx.js` | Small built-in Word document writer (no external library). |
| `sample-data.js` | The **fictional** data. |
| `Colour-Logo-TAG400px.png` | The supplied OnNow logo (unchanged). |
| `favicon.png` | Browser tab icon, cropped from the logo's speech-bubble "O". |
| `logo-data.js` | An exact embedded copy of the logo, used for Word reports when the browser blocks reading the PNG (for example when `index.html` is opened by double-clicking). |
| `README.md` | This guide. |

## Service types

There are 12 service categories, each with one permanent icon and colour used everywhere (maps, filters, register, insights, diagrams and reports). The colours and icons are defined once in `shared.js`.

**Selecting service types:** choose one or more. **No selection means all service types**, on every page.

## How the data is structured

- **`organisations`**: one record per organisation, with fictional contact details (`02 5550` phone numbers and `.example` web addresses).
- **`sites`**: physical places. Fixed sites have a host organisation; mobile stops are public places a mobile service visits.
- **`programs`**: one service run by one organisation, marked `fixed` or `mobile`.
- **`schedules`**: when a program runs at a site. When the page loads, each schedule becomes one dated `activity` per scheduled day (24 Nov to 23 Dec 2026).
- **`activities`**: one record per dated session, linked to its organisation, program and site.

Counts are kept separate: scheduled sessions, unique programs, organisations and physical locations. A weekly program counts as one program; a mobile program visiting five places counts as one program at five locations.

## Collaboration opportunities

Service Insights identifies seven types, using simple rules described on the page under "How opportunities are identified":

1. Fixed site hosting a mobile service
2. Mobile services operating together
3. Multi-agency service hub (three or more organisations)
4. Coordinating operating hours
5. Coordinating geographic coverage
6. Fixed organisation hosting a visiting provider
7. Coordinated referral pathways

Each is labelled **Existing complementary delivery**, **Potential collaboration** or **Requires further investigation**. "Nearby" means within 500 m in a straight line, and referral pathways use 2.5 km. Both are illustrative demonstration assumptions. No opportunity is a recommendation or a confirmed partnership.

## Word reports

The Reports page builds a genuine Office Open XML (.docx) document in the browser. It includes real headings, paragraphs, bulleted lists and editable tables, page numbers, and the embedded OnNow logo, icons and diagrams. No external library, server or account is used.

## Verification statuses

| Status | Meaning |
|---|---|
| **Provider confirmed** | The delivering organisation directly confirmed the session. |
| **Published only** | Seen in a public source, not confirmed by the provider. |
| **Unverified** | Reported by a partner or community member, not yet checked. |

Every status in this demo is fictional.

The dashboard treats **24 November 2026** as "today" (`demoReferenceDate` in `sample-data.js`), so the demo looks the same whenever you open it.

## Not included yet (by design)

No online hosting, accounts or sign-in, messaging, real agency data, database server or AI features.
