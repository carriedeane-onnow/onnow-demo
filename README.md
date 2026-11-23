# OnNow: demonstration dashboard

> **All data in this project is fictional.** Organisations, activities, locations, sources and verification statuses are made up for demonstration. No real provider has confirmed anything shown.

OnNow is a live activity mapping and intelligence platform for community sector organisations, councils and government. This folder contains an early **demonstration dashboard** for the Western Sydney pilot (Blacktown and Parramatta).

## How to open it

1. Open this folder (`Documents\OnNow`) in File Explorer.
2. Double-click **`index.html`**. It opens in your web browser.

You don't need to install anything. The map images come from OpenStreetMap, so the map needs an internet connection. Without one, the register, filters and details still work.

## What's in the folder

| File | What it does |
|---|---|
| `index.html` | The structure of the page: banner, header, filters, map, register and details panel. |
| `styles.css` | How it looks: colours, layout, and how it rearranges on tablets and phones. |
| `app.js` | How it behaves: filtering, searching, sorting, map pins and the details panel. |
| `sample-data.js` | The **fictional** data, structured like a future database. |
| `README.md` | This guide. |

## How the data is structured

The data mirrors the tables a future OnNow database is likely to have:

- **`organisations`**: one record per organisation (`organisationId`, name, type, description, areas served, `phone`, `email`, `website`). **Contact details are fictional.** Phone numbers use the `02 5550` range that Australia sets aside for fictional use, and emails and websites use the reserved `.example` domain.
- **`activities`**: one record per **individual occurrence** of an activity. Each one links to its organisation through `organisationId`. Fields:
  `activityId`, `organisationId`, `activityName`, `description`, `category`, `suburb`, `lga`,
  `location` (`latitude`, `longitude`, `description`), `date`, `startTime`, `finishTime`,
  `source`, `verificationStatus`, `lastConfirmedDate`, `isFictional`.
- **`lookups`**: reference lists for categories, verification statuses and source types.

To see a record exactly as it's stored, open any activity in the dashboard and expand **"View data record"**.

## Service categories

There are 11 categories: food relief, community meals, housing & homelessness, health clinics, mental health services, legal assistance, clothing assistance, laundry facilities, showers & hygiene, veterinary services and English language classes. Each map pin shows the category's colour and a short code (for example **L** for legal assistance or **EN** for English classes), so colour isn't the only cue.

## Evening filter

"Evening" is **not a category**. The dashboard works it out from each activity's start and finish times. An activity counts as evening if it operates **at any time between 6 pm and midnight**. For example, 5 pm–7 pm counts, but 4 pm–6 pm doesn't. To change the window, edit `eveningWindow` in `sample-data.js`. Evening activities show a dark **☾ Evening** tag in the register and in the details panel.

## Verification statuses

| Status | Meaning | `lastConfirmedDate` |
|---|---|---|
| **Provider confirmed** | The delivering organisation directly confirmed this specific activity. | The date the provider confirmed it |
| **Published only** | Seen in a public source (website, directory, social media) but **not** confirmed by the provider. | `null` |
| **Unverified** | Reported by a partner or community member and not yet checked. | `null` |

On the map, a **solid pin with a ✓** means provider confirmed, a **pale pin with a solid ring** means published only, and a **white pin with a dashed ring** means unverified. Every status in this demo is fictional.

## Changing the sample data

Open `sample-data.js` in a text editor (Notepad works). Copy an existing activity line, give it a new `activityId`, change the details and save the file. Then refresh the browser page.

The dashboard treats **24 November 2026** as "today" (`demoReferenceDate` in `sample-data.js`), so the demo looks the same whenever you open it.

## Not included yet (by design)

The demo has no online hosting, no user accounts, no real agency data, no database server and no AI features.
