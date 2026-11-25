# OnNow: demonstration platform

> **All data in this project is fictional.** Organisations, services, locations, facilities, collaboration profiles, contact details, sources and verification statuses are made up for demonstration. No real provider has confirmed anything shown, and no collaboration shown is a confirmed arrangement.

**Mission:** to strengthen collaboration across the social and welfare sector, enabling organisations to connect, coordinate and deliver better services together.
**Purpose:** transform fragmented service delivery into connected community support.

This folder contains a **demonstration** for the Western Sydney pilot (Blacktown City Council and the City of Parramatta). It has four pages, sharing one header, one set of filters and one dataset:

| Page | Purpose |
|---|---|
| **Collaborate** (opens first) | Work together. Choose your organisation (or a council), see its profile, choose how you would like to collaborate, and plan a community hub with the **Community Hub Builder**. |
| **Explore Activities** | Find services: map, register, filters, details, and program and intake information. |
| **Service Insights** | Understand service delivery: service overlaps, collaboration opportunities and recorded gaps, with detailed analysis. |
| **Reports** | Plan and collaborate: council and agency Word reports. (Hub proposals are downloaded from the Hub Builder.) |

## How to open it

1. Open this folder (`Documents\OnNow`) in File Explorer.
2. Double-click **`index.html`**. It opens in your web browser.

You don't need to install anything. Map images come from OpenStreetMap, so maps need an internet connection. Everything else works offline. The site is static (HTML, CSS and JavaScript with relative paths), so it also works on GitHub Pages.

## What's in the folder

| File | What it does |
|---|---|
| `index.html` | Page structure: header, navigation, the four pages. |
| `styles.css` | Visual identity (OnNow palette, typography, buttons, filters) and Explore Activities. |
| `analysis.css` | Service Insights, Reports and collaboration graphics. |
| `collaborate.css` | Collaborate page, opportunity cards, agency profiles and the Community Hub Builder. |
| `shared.js` | Brand palette, icon set, service categories and groups, agency profiles, councils, shared filters, navigation. |
| `analysis.js` | All calculations: overlaps, gaps, the eight collaboration opportunity types and Hub Builder partner matching. |
| `collaborate.js` | Collaborate page and Community Hub Builder. |
| `app.js` | Explore Activities. |
| `insights.js` | Service Insights, and the collaboration diagrams. |
| `reports.js` | Council and agency reports, and the Community Hub Collaboration Proposal (preview and Word download). |
| `docx.js` | Small built-in Word document writer (no external library). |
| `sample-data.js` | The **fictional** data, including programs, intakes and collaboration profiles. |
| `Colour-Logo-TAG400px.png` | The supplied OnNow logo (unchanged). |
| `favicon.png` | Browser tab icon, cropped from the logo's speech-bubble "O". |
| `logo-data.js` | An exact embedded copy of the logo, used for Word documents when the browser blocks reading the PNG (for example when `index.html` is opened by double-clicking). |
| `README.md` | This guide. |

`index.html` loads each local file with a version number (for example `styles.css?v=4.0`), so browsers fetch the new files after an update instead of using old cached copies. Increase the number when you publish a new version.

## Service types

There are 29 service categories in five groups (Food and essentials; Health and wellbeing; Safety, housing and legal; Money, work and learning; Families and communities). Each has one permanent icon and colour, used everywhere. A service type (for example food relief) is separate from how it is delivered (fixed site or mobile).

**Selecting service types:** choose one or more, or search. **No selection means all service types**, on every page.

## How the data is structured

- **`organisations`**: one record per organisation, with fictional contact details (`02 5550` phone numbers and `.example` web addresses).
- **`sites`**: physical places. Fixed sites have a host organisation; mobile stops are public places a mobile service visits.
- **`programs`**: one service run by one organisation, marked `fixed` or `mobile`. Optional fields describe structure and participation: program type (drop-in, fixed-term, rolling enrolment, appointment-based, one-off), access method, entry requirement, duration, session length, attendance, eligibility, cost, capacity and **intakes**. Anything not recorded stays unknown.
- **`schedules`**: when a program runs at a site, either weekly days or a list of session dates for one intake.
- **`activities`**: one dated session, linked to its organisation, program, site and (for courses) intake.
- **`collaborationProfiles`**: what each demonstration agency can offer and who it wants to connect with. Missing answers show as "Not specified".

A six-week English course is **one program, one intake and six sessions**. Participants must commence in week 1, so later sessions are not separate enrolment opportunities.

## Collaboration

The Collaborate page offers three choices (**Create a community hub**, **Bring services to us**, **Take our services to others**) and more options (referral partnerships, coordinating delivery, collaborating on programs). These map onto eight opportunity types calculated in `analysis.js`, each labelled **Existing complementary delivery**, **Potential collaboration** or **Requires further investigation**. The full rules are on the Service Insights page under "How opportunities are identified".

- Declared profile interests strengthen a match, but distance alone never establishes a suitable collaboration.
- Only established community sites (a drop-in essentials service run by the host, or declared community attendance) are treated as hub hosts. Offices, car parks, mobile stops and clinic vans are not.
- "Nearby" means within 500 m in a straight line; referral pathways use 2.5 km. Both are illustrative.

**Agency profile edits** are a demonstration feature: they are saved only in your browser (local storage) and are never sent to any organisation.

## Word documents

Reports and Hub Builder proposals are genuine Office Open XML (.docx) documents built in the browser. They include real headings, bulleted lists, editable tables, page numbers and the embedded OnNow logo, icons and diagrams. No external library, server or account is used.

## Verification statuses

| Status | Meaning |
|---|---|
| **Provider confirmed** | The delivering organisation directly confirmed the session. |
| **Published only** | Seen in a public source, not confirmed by the provider. |
| **Unverified** | Reported by a partner or community member, not yet checked. |

Every status in this demo is fictional. The dashboard treats **24 November 2026** as "today" (`demoReferenceDate` in `sample-data.js`), so the demo looks the same whenever you open it.

## Not included (by design)

No online registration or sign-in, client records or case management, referrals of individuals, bookings or enrolments, messaging or invitations, payments, grant management, real agency data, database server or AI features.
