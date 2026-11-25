/*
 * ============================================================================
 *  OnNow — FICTIONAL SAMPLE DATA (demonstration only)
 * ============================================================================
 *  Every organisation, activity, description, location point, source and
 *  verification status in this file is MADE UP for demonstration purposes.
 *  None of it describes a real service, and no real provider has confirmed
 *  anything shown here.
 *
 *  The structure mirrors how a future OnNow database could be organised:
 *
 *    lookups        Reference lists (categories, verification statuses,
 *                   source types) — would become small "lookup" tables.
 *    organisations  One record per delivering organisation.
 *    activities     One record per individual activity occurrence
 *                   (e.g. "Tuesday pantry on 24 Nov" and "Tuesday pantry on
 *                   1 Dec" are two separate activity records). Each activity
 *                   points to its organisation through `organisationId`.
 *
 *  Verification rule used in this sample:
 *    - provider_confirmed : lastConfirmedDate holds the (fictional) date the
 *                           provider confirmed this occurrence.
 *    - published          : lastConfirmedDate is null — seen in a public
 *                           source, but never confirmed by the provider.
 *    - unverified         : lastConfirmedDate is null — reported or referred,
 *                           not yet checked against any source.
 *
 *  Locations are approximate points inside real suburbs so the map looks
 *  realistic. They are NOT real venues or addresses.
 *
 *  Organisation contact details (phone, email, website) are FICTIONAL:
 *    - phone numbers use the 02 5550 range set aside in Australia for
 *      fictional use;
 *    - emails and websites use the reserved ".example" domain, which cannot
 *      belong to anyone.
 * ============================================================================
 */
window.ONNOW_SAMPLE_DATA = {
  meta: {
    datasetName: 'OnNow Western Sydney pilot — fictional sample dataset',
    isFictional: true,
    schemaVersion: '0.1-demo',
    // The dashboard treats this date as "today" so the demo always looks the same.
    demoReferenceDate: '2026-11-24',
    coverage: 'Blacktown LGA and Parramatta LGA (fictional activities)',
    notice: 'All organisations, activities, locations, contact details, sources and verification statuses are fictional.',
    // "Evening" is worked out from each activity's start and finish times — it is not a category.
    // An activity counts as evening if it operates at any time between 6 pm and midnight.
    eveningWindow: { start: '18:00', end: '24:00', label: 'Operating at any time between 6 pm and midnight' }
  },

  lookups: {
    // glyph = short code shown inside each map pin (so colour is not the only cue).
    categories: {
      food_relief:          { label: 'Food relief',              glyph: 'F',  color: '#0f766e', description: 'Pantries, hampers, food rescue and low-cost groceries.' },
      community_meals:      { label: 'Community meals',          glyph: 'M',  color: '#b45309', description: 'Shared meals, lunches, dinners and breakfast programs.' },
      housing_homelessness: { label: 'Housing & homelessness',   glyph: 'H',  color: '#6d28d9', description: 'Street outreach, bedding and housing support.' },
      health_clinics:       { label: 'Health clinics',           glyph: '+',  color: '#be123c', description: 'GP, nurse, screening and vaccination clinics.' },
      mental_health:        { label: 'Mental health services',   glyph: 'MH', color: '#9d174d', description: 'Drop-ins, peer support and counselling.' },
      legal_assistance:     { label: 'Legal assistance',         glyph: 'L',  color: '#1e3a8a', description: 'Free legal advice on tenancy, fines, debt and family matters.' },
      clothing_assistance:  { label: 'Clothing assistance',      glyph: 'C',  color: '#4d7c0f', description: 'Free clothing, uniform and winter wear.' },
      laundry:              { label: 'Laundry facilities',       glyph: 'LF', color: '#0369a1', description: 'Free washing and drying facilities.' },
      showers_hygiene:      { label: 'Showers & hygiene',        glyph: 'S',  color: '#0e7490', description: 'Showers, toiletries and hygiene packs.' },
      veterinary:           { label: 'Vet care & pet support',   glyph: 'V',  color: '#7c2d12', description: 'Free or low-cost pet health checks, treatment and pet food.' },
      english_classes:      { label: 'English language classes', glyph: 'EN', color: '#334155', description: 'Conversation and English classes for adults.' },
      social_support:       { label: 'Community & social support', glyph: 'R',  color: '#a21caf', description: 'Drop-in social support, community connection, information and referrals.' },
      // ---- Phase 4: wider social and welfare sector (service types, not delivery methods) ----
      first_nations:         { label: 'First Nations services',            glyph: 'FN', description: 'Services delivered by or for Aboriginal and Torres Strait Islander communities.' },
      dfv_support:           { label: 'Domestic & family violence support', glyph: 'DV', description: 'Specialist support, safety planning and advocacy.' },
      financial_counselling: { label: 'Financial counselling',             glyph: '$',  description: 'Free, confidential help with debts, bills and budgeting.' },
      employment:            { label: 'Employment support',                glyph: 'J',  description: 'Job search, resumes, interview practice and work readiness.' },
      education:             { label: 'Education & training',              glyph: 'ED', description: 'Courses, workshops and pathways into further learning.' },
      life_skills:           { label: 'Life skills',                       glyph: 'LS', description: 'Practical skills such as cooking, budgeting and household management.' },
      digital_access:        { label: 'Digital access & computer help',    glyph: 'DA', description: 'Computer, phone and internet access with help to use them.' },
      disability_ndis:       { label: 'Disability & NDIS support',         glyph: 'ND', description: 'Disability support, NDIS information and access help.' },
      carer_support:         { label: 'Carer support',                     glyph: 'CS', description: 'Support, respite information and groups for unpaid carers.' },
      family_support:        { label: 'Childcare & family support',        glyph: 'FS', description: 'Playgroups, parenting support and family services.' },
      migrant_refugee:       { label: 'Migrant & refugee services',        glyph: 'MR', description: 'Settlement support for people from migrant and refugee backgrounds.' },
      visa_immigration:      { label: 'Visa & immigration support',        glyph: 'VI', description: 'Information and help with visa and immigration matters.' },
      personal_care:         { label: 'Haircuts & personal care',          glyph: 'PC', description: 'Free haircuts, grooming and personal care.' },
      dental:                { label: 'Dental services',                   glyph: 'DE', description: 'Dental checks, cleaning and treatment.' },
      aod_support:           { label: 'Drug & alcohol support',            glyph: 'AD', description: 'Counselling, harm reduction and recovery support.' },
      crisis_support:        { label: 'Crisis support',                    glyph: 'CR', description: 'Immediate help in a crisis, including emergency relief.' },
      wellness:              { label: 'Wellness & fitness',                glyph: 'WF', description: 'Exercise, walking groups and wellbeing activities.' }
    },

    // Program structure (how a program runs) is separate from access (how people join).
    programTypes: {
      drop_in:     { label: 'Drop-in service', help: 'Come along during opening hours.' },
      fixed_term:  { label: 'Fixed-term program', help: 'Runs for a set number of weeks with a start and finish date.' },
      rolling:     { label: 'Rolling enrolment program', help: 'Ongoing program that people can join at different times.' },
      appointment: { label: 'Appointment-based service', help: 'Seen by appointment.' },
      one_off:     { label: 'One-off event', help: 'A single event.' }
    },
    accessMethods: {
      drop_in: 'Drop in', registration: 'Registration required', appointment: 'Appointment required', referral: 'Referral required'
    },
    entryRequirements: {
      join_anytime: 'Join at any time', start_only: 'Must commence at the start', provider_approval: 'Late entry by provider approval'
    },
    enrolmentStatuses: {
      open: 'Enrolments open', closed: 'Enrolments closed', full: 'Full', not_yet_open: 'Enrolments not yet open'
    },

    // Order matters: strongest assurance first.
    verificationStatuses: {
      provider_confirmed: {
        label: 'Provider confirmed',
        shortLabel: 'Provider confirmed',
        description: 'The delivering organisation has directly confirmed that this specific activity will run as listed.'
      },
      published: {
        label: 'Published — not provider confirmed',
        shortLabel: 'Published only',
        description: 'Found in a public source (such as a website, directory or social media post). The provider has not confirmed this specific occurrence.'
      },
      unverified: {
        label: 'Unverified',
        shortLabel: 'Unverified',
        description: 'Reported by a partner or community member. Not yet checked against a published source or with the provider.'
      }
    },

    sourceTypes: {
      provider_submission:  { label: 'Provider submission' },
      organisation_website: { label: 'Organisation website' },
      council_directory:    { label: 'Council community directory' },
      social_media:         { label: 'Social media post' },
      partner_referral:     { label: 'Partner referral' },
      community_report:     { label: 'Community report' }
    }
  },

  organisations: [
    { organisationId: 'ORG-001', organisationName: 'Wattle Street Community Pantry',    organisationType: 'Charity',              description: 'Volunteer-run pantry offering low-cost groceries and emergency hampers.', areasServed: ['Blacktown', 'Mount Druitt'], phone: '02 5550 0101', email: 'hello@wattlestreetpantry.example', website: 'www.wattlestreetpantry.example', isFictional: true },
    { organisationId: 'ORG-002', organisationName: 'Greenway Neighbourhood Centre',     organisationType: 'Neighbourhood centre', description: 'Community centre running weekly lunches, seniors programs and a family pantry table.', areasServed: ['Lalor Park', 'Seven Hills'], phone: '02 5550 0102', email: 'info@greenwaync.example', website: 'www.greenwaync.example', isFictional: true },
    { organisationId: 'ORG-003', organisationName: 'Open Door Outreach Collective',     organisationType: 'Charity',              description: 'Evening street outreach teams providing food, bedding and referrals.', areasServed: ['Parramatta', 'Harris Park'], phone: '02 5550 0103', email: 'team@opendooroutreach.example', website: 'www.opendooroutreach.example', isFictional: true },
    { organisationId: 'ORG-004', organisationName: 'Westside Mobile Health Clinic',     organisationType: 'Health service',       description: 'Mobile clinic van offering bulk-billed GP appointments and vaccinations.', areasServed: ['Mount Druitt', 'Rooty Hill', 'Rosehill', 'Blacktown'], phone: '02 5550 0104', email: 'clinic@westsidemobilehealth.example', website: 'www.westsidemobilehealth.example', isFictional: true },
    { organisationId: 'ORG-005', organisationName: 'Riverbank Shared Table',            organisationType: 'Volunteer group',      description: 'Volunteer group hosting free shared dinners and a Sunday breakfast.', areasServed: ['Parramatta', 'North Parramatta'], phone: '02 5550 0105', email: 'volunteers@riverbanksharedtable.example', website: 'www.riverbanksharedtable.example', isFictional: true },
    { organisationId: 'ORG-006', organisationName: 'Harbourlight Youth & Family Services', organisationType: 'Charity',           description: 'Youth and family support service with hamper collections and youth drop-ins.', areasServed: ['Rooty Hill', 'Doonside'], phone: '02 5550 0106', email: 'families@harbourlightyfs.example', website: 'www.harbourlightyfs.example', isFictional: true },
    { organisationId: 'ORG-007', organisationName: 'Eastgate Faith Community Kitchen',  organisationType: 'Faith-based group',    description: 'Faith community running a weekly soup kitchen and Saturday lunch.', areasServed: ['Northmead', 'Westmead'], phone: '02 5550 0107', email: 'kitchen@eastgatefaith.example', website: 'www.eastgatefaith.example', isFictional: true },
    { organisationId: 'ORG-008', organisationName: 'Bluegum Volunteer Food Rescue',     organisationType: 'Volunteer group',      description: 'Rescues surplus produce and redistributes it through pop-up stalls.', areasServed: ['Quakers Hill', 'Plumpton', 'Rydalmere', 'Rosehill'], phone: '02 5550 0108', email: 'rescue@bluegumfood.example', website: 'www.bluegumfood.example', isFictional: true },
    { organisationId: 'ORG-009', organisationName: 'Parkside Wellbeing Hub',            organisationType: 'Health service',       description: 'Wellbeing service offering mental health drop-ins and health check days.', areasServed: ['Harris Park', 'Blacktown', 'Ermington', 'Rooty Hill'], phone: '02 5550 0109', email: 'hello@parksidewellbeing.example', website: 'www.parksidewellbeing.example', isFictional: true },
    { organisationId: 'ORG-010', organisationName: 'Northline Street Support',          organisationType: 'Charity',              description: 'Outreach van providing breakfast, showers, laundry and housing support.', areasServed: ['Blacktown', 'Mount Druitt', 'Whalan', 'Bidwill'], phone: '02 5550 0110', email: 'van@northlinesupport.example', website: 'www.northlinesupport.example', isFictional: true },
    { organisationId: 'ORG-011', organisationName: 'Saltbush Free Legal Help', organisationType: 'Community legal service', description: 'Volunteer lawyers offering free advice on tenancy, fines, debt and family matters.', areasServed: ['Parramatta', 'Blacktown', 'Mount Druitt'], phone: '02 5550 0111', email: 'advice@saltbushlegal.example', website: 'www.saltbushlegal.example', isFictional: true },
    { organisationId: 'ORG-012', organisationName: 'Second Stitch Clothing Exchange', organisationType: 'Volunteer group', description: 'Free clothing store and seasonal clothing and school uniform swaps.', areasServed: ['Doonside', 'Westmead'], phone: '02 5550 0112', email: 'swap@secondstitch.example', website: 'www.secondstitch.example', isFictional: true },
    { organisationId: 'ORG-013', organisationName: 'Paws Together Community Vet Van', organisationType: 'Veterinary charity', description: 'Mobile vet van offering free pet health checks for people on low incomes or experiencing homelessness.', areasServed: ['Bidwill', 'Rydalmere', 'Quakers Hill'], phone: '02 5550 0113', email: 'woof@pawstogether.example', website: 'www.pawstogether.example', isFictional: true },
    { organisationId: 'ORG-014', organisationName: 'Common Ground English Circle', organisationType: 'Adult education provider', description: 'Free English conversation and beginner classes for adults, with childcare at some sessions.', areasServed: ['Harris Park', 'Blacktown', 'Seven Hills', 'Mount Druitt'], phone: '02 5550 0114', email: 'classes@commongroundenglish.example', website: 'www.commongroundenglish.example', isFictional: true },
    { organisationId: 'ORG-015', organisationName: 'Fresh Start Hygiene Bus', organisationType: 'Charity', description: 'Converted bus providing free hot showers, hygiene packs and a mobile laundry.', areasServed: ['Parramatta', 'Mount Druitt', 'Harris Park'], phone: '02 5550 0115', email: 'bus@freshstarthygiene.example', website: 'www.freshstarthygiene.example', isFictional: true },

    // ---- Added for recurring-schedule demonstration (fixed sites and mobile providers) ----
    { organisationId: 'ORG-016', organisationName: 'Banksia Lane Community Hub Inc.', organisationType: 'Neighbourhood centre', description: 'Community hub running meals, showers, a clothing room, housing referrals and social support from one site.', areasServed: ['Mount Druitt', 'Whalan', 'Bidwill'], phone: '02 5550 0116', email: 'hello@banksialanehub.example', website: 'www.banksialanehub.example', isFictional: true },
    { organisationId: 'ORG-017', organisationName: 'Greenhaven Community Kitchen', organisationType: 'Charity', description: 'Volunteer kitchen serving a free community lunch every day of the week.', areasServed: ['Blacktown', 'Seven Hills'], phone: '02 5550 0117', email: 'lunch@greenhavenkitchen.example', website: 'www.greenhavenkitchen.example', isFictional: true },
    { organisationId: 'ORG-018', organisationName: 'Coolabah Community Centre', organisationType: 'Neighbourhood centre', description: 'Community centre offering a weekday lunch and shower facilities.', areasServed: ['Mount Druitt', 'Rooty Hill'], phone: '02 5550 0118', email: 'info@coolabahcc.example', website: 'www.coolabahcc.example', isFictional: true },
    { organisationId: 'ORG-019', organisationName: 'Harvest Wheels Mobile Pantry', organisationType: 'Charity', description: 'Mobile food van distributing groceries at several stops each week.', areasServed: ['Blacktown', 'Mount Druitt', 'Rooty Hill'], phone: '02 5550 0119', email: 'van@harvestwheels.example', website: 'www.harvestwheels.example', isFictional: true },
    { organisationId: 'ORG-020', organisationName: 'Open Hands Food Truck', organisationType: 'Volunteer group', description: 'Food truck handing out free grocery packs and hot food at weekly stops.', areasServed: ['Blacktown', 'Mount Druitt', 'Rooty Hill'], phone: '02 5550 0120', email: 'truck@openhandsfood.example', website: 'www.openhandsfood.example', isFictional: true },
    { organisationId: 'ORG-021', organisationName: 'Spin Cycle Mobile Laundry', organisationType: 'Charity', description: 'Mobile laundry van with washers and dryers, visiting five locations each week.', areasServed: ['Blacktown', 'Doonside', 'Mount Druitt', 'Rooty Hill'], phone: '02 5550 0121', email: 'wash@spincyclelaundry.example', website: 'www.spincyclelaundry.example', isFictional: true },
    { organisationId: 'ORG-022', organisationName: 'Threads on Wheels', organisationType: 'Volunteer group', description: 'Mobile clothing van offering free clothes and shoes at weekly stops.', areasServed: ['Blacktown', 'Plumpton', 'Mount Druitt'], phone: '02 5550 0122', email: 'racks@threadsonwheels.example', website: 'www.threadsonwheels.example', isFictional: true },

    // ---- Phase 4: a small number of organisations for the wider service categories ----
    { organisationId: 'ORG-023', organisationName: 'Wattle Money Help', organisationType: 'Financial counselling service', description: 'Free, confidential financial counselling by appointment.', areasServed: ['Blacktown', 'Seven Hills', 'Doonside', 'Mount Druitt'], phone: '02 5550 0123', email: 'help@wattlemoney.example', website: 'www.wattlemoney.example', isFictional: true },
    { organisationId: 'ORG-024', organisationName: 'Next Step Employment Connect', organisationType: 'Employment service', description: 'Job readiness workshops and a digital help desk.', areasServed: ['Mount Druitt', 'Rooty Hill', 'Whalan', 'Blacktown'], phone: '02 5550 0124', email: 'jobs@nextstepconnect.example', website: 'www.nextstepconnect.example', isFictional: true },
    { organisationId: 'ORG-025', organisationName: 'Smile Bus Community Dental', organisationType: 'Health service', description: 'Mobile dental bus offering free check-ups by appointment.', areasServed: ['Plumpton', 'Rooty Hill', 'Mount Druitt', 'Blacktown'], phone: '02 5550 0125', email: 'smile@smilebusdental.example', website: 'www.smilebusdental.example', isFictional: true },
    { organisationId: 'ORG-026', organisationName: 'Waratah First Nations Family Support', organisationType: 'Community-controlled organisation', description: 'Family yarning group and playgroup for Aboriginal and Torres Strait Islander families and community.', areasServed: ['Whalan', 'Mount Druitt', 'Bidwill'], phone: '02 5550 0126', email: 'yarn@waratahfamily.example', website: 'www.waratahfamily.example', isFictional: true },
    { organisationId: 'ORG-027', organisationName: 'Safe Harbour Family Violence Support', organisationType: 'Specialist support service', description: 'Specialist domestic and family violence support by appointment or referral. Office location not published.', areasServed: ['Blacktown', 'Mount Druitt', 'Parramatta'], phone: '02 5550 0127', email: 'support@safeharbour.example', website: 'www.safeharbour.example', isFictional: true },
    { organisationId: 'ORG-028', organisationName: 'Clean Cut Community Barbers', organisationType: 'Volunteer group', description: 'Volunteer barbers offering free haircuts at weekly mobile stops.', areasServed: ['Blacktown', 'Mount Druitt'], phone: '02 5550 0128', email: 'cuts@cleancutbarbers.example', website: 'www.cleancutbarbers.example', isFictional: true },
    { organisationId: 'ORG-029', organisationName: 'Riverside Settlement Services', organisationType: 'Settlement service', description: 'Settlement support and a visa information clinic for people from migrant and refugee backgrounds.', areasServed: ['Harris Park', 'Parramatta', 'Westmead', 'Blacktown'], phone: '02 5550 0129', email: 'welcome@riversidesettlement.example', website: 'www.riversidesettlement.example', isFictional: true }
  ],

  // ===========================================================================
  //  Sites, programs and weekly schedules (added)
  //  - A SITE is a physical place. Fixed sites are hosted by an organisation;
  //    mobile stops are public places a mobile service visits.
  //  - A PROGRAM is one service run by one organisation (fixed or mobile).
  //  - A SCHEDULE says when a program runs at a site. Dated occurrences are
  //    generated from schedules at the bottom of this file.
  //  All names, places and schedules are fictional.
  // ===========================================================================
  sites: [
    { siteId: 'SITE-001', siteName: 'Banksia Lane Community Hub', siteType: 'fixed', hostOrganisationId: 'ORG-016', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7712, longitude: 150.8152, description: 'Banksia Lane Community Hub (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-002', siteName: 'Greenhaven Community Kitchen', siteType: 'fixed', hostOrganisationId: 'ORG-017', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7742, longitude: 150.9015, description: 'Greenhaven Community Kitchen (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-003', siteName: 'Coolabah Community Centre', siteType: 'fixed', hostOrganisationId: 'ORG-018', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7638, longitude: 150.8262, description: 'Coolabah Community Centre (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-004', siteName: 'Blacktown civic plaza stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7700, longitude: 150.9070, description: 'Mobile stop: civic plaza, Blacktown (fictional)' }, isFictional: true },
    { siteId: 'SITE-005', siteName: 'Mount Druitt shopping precinct stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7703, longitude: 150.8170, description: 'Mobile stop: shopping precinct car park, Mount Druitt (fictional)' }, isFictional: true },
    { siteId: 'SITE-006', siteName: 'Rooty Hill station car park stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7705, longitude: 150.8445, description: 'Mobile stop: station car park, Rooty Hill (fictional)' }, isFictional: true },
    { siteId: 'SITE-007', siteName: 'Mount Druitt community park stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7672, longitude: 150.8235, description: 'Mobile stop: community park, Mount Druitt (fictional)' }, isFictional: true },
    { siteId: 'SITE-008', siteName: 'Blacktown showground car park stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7760, longitude: 150.9000, description: 'Mobile stop: showground car park, Blacktown (fictional)' }, isFictional: true },
    { siteId: 'SITE-009', siteName: 'Doonside library car park stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Doonside', lga: 'Blacktown', location: { latitude: -33.7660, longitude: 150.8700, description: 'Mobile stop: library car park, Doonside (fictional)' }, isFictional: true },
    { siteId: 'SITE-010', siteName: 'Mount Druitt reserve car park stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7655, longitude: 150.8280, description: 'Mobile stop: reserve car park, Mount Druitt (fictional)' }, isFictional: true },
    { siteId: 'SITE-011', siteName: 'Blacktown reserve stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7755, longitude: 150.9030, description: 'Mobile stop: reserve car park, Blacktown (fictional)' }, isFictional: true },
    { siteId: 'SITE-012', siteName: 'Plumpton shopping centre stop', siteType: 'mobile_stop', hostOrganisationId: null, suburb: 'Plumpton', lga: 'Blacktown', location: { latitude: -33.7520, longitude: 150.8380, description: 'Mobile stop: shopping centre car park, Plumpton (fictional)' }, isFictional: true },
    { siteId: 'SITE-013', siteName: 'Wattle Money Help office', siteType: 'fixed', hostOrganisationId: 'ORG-023', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7688, longitude: 150.9060, description: 'Wattle Money Help office (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-014', siteName: 'Next Step Mount Druitt office', siteType: 'fixed', hostOrganisationId: 'ORG-024', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7690, longitude: 150.8195, description: 'Next Step Mount Druitt office (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-015', siteName: 'Waratah Family Centre', siteType: 'fixed', hostOrganisationId: 'ORG-026', suburb: 'Whalan', lga: 'Blacktown', location: { latitude: -33.7570, longitude: 150.8090, description: 'Waratah Family Centre (fictional venue)' }, isFictional: true },
    { siteId: 'SITE-016', siteName: 'Riverside Settlement Centre', siteType: 'fixed', hostOrganisationId: 'ORG-029', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8225, longitude: 151.0080, description: 'Riverside Settlement Centre (fictional venue)' }, isFictional: true }
  ],

  programs: [
    // Banksia Lane Community Hub: five programs at one fixed site (Kitchen A runs the lunch)
    { programId: 'PRG-001', organisationId: 'ORG-016', programName: 'Community Lunch', category: 'community_meals', deliveryMode: 'fixed', description: 'Free hot two-course lunch. All welcome.', isFictional: true },
    { programId: 'PRG-002', organisationId: 'ORG-016', programName: 'Hot Showers', category: 'showers_hygiene', deliveryMode: 'fixed', description: 'Private showers with towels and toiletries provided.', isFictional: true },
    { programId: 'PRG-003', organisationId: 'ORG-016', programName: 'Clothing Room', category: 'clothing_assistance', deliveryMode: 'fixed', description: 'Free clothing, shoes and bedding from the hub clothing room.', isFictional: true },
    { programId: 'PRG-004', organisationId: 'ORG-016', programName: 'Housing Referral Desk', category: 'housing_homelessness', deliveryMode: 'fixed', description: 'Housing information, applications and referrals with a caseworker.', isFictional: true },
    { programId: 'PRG-005', organisationId: 'ORG-016', programName: 'Social Support Drop-in', category: 'social_support', deliveryMode: 'fixed', description: 'Drop-in with a support worker for a chat, information and referrals.', isFictional: true },
    // Kitchen B (seven days) and Coolabah (Kitchen C + showers)
    { programId: 'PRG-006', organisationId: 'ORG-017', programName: 'Community Lunch', category: 'community_meals', deliveryMode: 'fixed', description: 'Free cooked lunch every day of the week.', isFictional: true },
    { programId: 'PRG-007', organisationId: 'ORG-018', programName: 'Community Lunch', category: 'community_meals', deliveryMode: 'fixed', description: 'Free weekday lunch in the centre dining room.', isFictional: true },
    { programId: 'PRG-008', organisationId: 'ORG-018', programName: 'Shower Facilities', category: 'showers_hygiene', deliveryMode: 'fixed', description: 'Shower facilities with towels supplied.', isFictional: true },
    // Mobile providers: one program each, several stops
    { programId: 'PRG-009', organisationId: 'ORG-019', programName: 'Mobile Food Van', category: 'food_relief', deliveryMode: 'mobile', description: 'Free grocery packs and fresh produce from a mobile van.', isFictional: true },
    { programId: 'PRG-010', organisationId: 'ORG-020', programName: 'Food Truck Distribution', category: 'food_relief', deliveryMode: 'mobile', description: 'Free grocery packs and hot food from a food truck.', isFictional: true },
    { programId: 'PRG-011', organisationId: 'ORG-021', programName: 'Mobile Laundry', category: 'laundry', deliveryMode: 'mobile', description: 'Free washing and drying while you wait. Detergent supplied.', isFictional: true },
    { programId: 'PRG-012', organisationId: 'ORG-022', programName: 'Mobile Clothing Van', category: 'clothing_assistance', deliveryMode: 'mobile', description: 'Free clothes and shoes from a mobile clothing van.', isFictional: true },

    // ---- Phase 4 programs. Optional structure and participation fields are only
    //      recorded where relevant; anything not recorded stays unknown. ----
    { programId: 'PRG-013', organisationId: 'ORG-014', programName: 'English for Everyday Life (6-week course)', category: 'english_classes', deliveryMode: 'fixed', description: 'Six-week beginner English course covering shopping, appointments and transport. Childcare available.',
      programType: 'fixed_term', accessMethod: 'registration', entryRequirement: 'start_only', durationWeeks: 6, sessionDurationMinutes: 120,
      attendanceCommitment: 'Attend all six weekly sessions', eligibility: 'Adults learning English at beginner level', cost: 'Free', capacity: 16,
      intakes: [
        { intakeId: 'EEL-2026-1', commencementDate: '2026-11-26', completionDate: '2026-12-31', registrationDeadline: '2026-11-25', enrolmentStatus: 'open', capacity: 16 },
        { intakeId: 'EEL-2027-1', commencementDate: '2027-02-04', completionDate: '2027-03-11', registrationDeadline: '2027-02-01', enrolmentStatus: 'not_yet_open', capacity: 16 }
      ], isFictional: true },
    { programId: 'PRG-014', organisationId: 'ORG-016', programName: 'Cooking on a Budget (4-week course)', category: 'life_skills', deliveryMode: 'fixed', description: 'Hands-on course on cooking healthy meals on a small budget.',
      programType: 'fixed_term', accessMethod: 'registration', entryRequirement: 'provider_approval', durationWeeks: 4, sessionDurationMinutes: 120,
      attendanceCommitment: 'Four weekly sessions', eligibility: 'Adults', cost: 'Free', capacity: 10,
      intakes: [{ intakeId: 'COB-2026-4', commencementDate: '2026-11-26', completionDate: '2026-12-17', registrationDeadline: '2026-11-24', enrolmentStatus: 'open', capacity: 10 }], isFictional: true },
    { programId: 'PRG-015', organisationId: 'ORG-023', programName: 'Financial Counselling', category: 'financial_counselling', deliveryMode: 'fixed', description: 'Free one-to-one financial counselling.',
      programType: 'appointment', accessMethod: 'appointment', sessionDurationMinutes: 60, eligibility: 'People experiencing financial difficulty', cost: 'Free', isFictional: true },
    { programId: 'PRG-016', organisationId: 'ORG-024', programName: 'Job Ready Workshops', category: 'employment', deliveryMode: 'fixed', description: 'Weekly workshops on resumes, interviews and job search.',
      programType: 'rolling', accessMethod: 'registration', entryRequirement: 'join_anytime', sessionDurationMinutes: 120, eligibility: 'Job seekers aged 16 and over', cost: 'Free', capacity: 20, isFictional: true },
    { programId: 'PRG-017', organisationId: 'ORG-024', programName: 'Digital Help Desk', category: 'digital_access', deliveryMode: 'fixed', description: 'Free computer access and help with phones, email and online forms.',
      programType: 'drop_in', accessMethod: 'drop_in', cost: 'Free', isFictional: true },
    { programId: 'PRG-018', organisationId: 'ORG-025', programName: 'Smile Bus Dental Checks', category: 'dental', deliveryMode: 'mobile', description: 'Free dental check-ups and cleaning on a mobile dental bus.',
      programType: 'appointment', accessMethod: 'appointment', sessionDurationMinutes: 30, eligibility: 'Health care card holders', cost: 'Free', isFictional: true },
    { programId: 'PRG-019', organisationId: 'ORG-026', programName: 'Family Yarning Group', category: 'first_nations', deliveryMode: 'fixed', description: 'Weekly yarning group for Aboriginal and Torres Strait Islander families and community.',
      programType: 'drop_in', accessMethod: 'drop_in', cost: 'Free', isFictional: true },
    { programId: 'PRG-020', organisationId: 'ORG-026', programName: 'Little Steps Playgroup', category: 'family_support', deliveryMode: 'fixed', description: 'Playgroup for families with children aged 0 to 5.',
      programType: 'drop_in', accessMethod: 'drop_in', eligibility: 'Families with children aged 0 to 5', cost: 'Free', isFictional: true },
    { programId: 'PRG-021', organisationId: 'ORG-027', programName: 'Family Violence Support', category: 'dfv_support', deliveryMode: 'fixed', description: 'Confidential specialist support by appointment or referral.',
      programType: 'appointment', accessMethod: 'referral', cost: 'Free', publicSchedule: false, isFictional: true },
    { programId: 'PRG-022', organisationId: 'ORG-028', programName: 'Community Haircuts', category: 'personal_care', deliveryMode: 'mobile', description: 'Free haircuts from volunteer barbers.',
      programType: 'drop_in', accessMethod: 'drop_in', cost: 'Free', isFictional: true },
    { programId: 'PRG-023', organisationId: 'ORG-029', programName: 'Settlement Support Drop-in', category: 'migrant_refugee', deliveryMode: 'fixed', description: 'Settlement information, referrals and community connection.',
      programType: 'drop_in', accessMethod: 'drop_in', cost: 'Free', isFictional: true },
    { programId: 'PRG-024', organisationId: 'ORG-029', programName: 'Visa Information Clinic', category: 'visa_immigration', deliveryMode: 'fixed', description: 'Fortnightly visa and immigration information sessions.',
      programType: 'appointment', accessMethod: 'appointment', sessionDurationMinutes: 45, cost: 'Free', isFictional: true }
  ],

  // days: Mon, Tue, Wed, Thu, Fri, Sat, Sun. Each schedule runs for the 30-day demonstration period.
  schedules: [
    { scheduleId: 'SCH-001', programId: 'PRG-001', siteId: 'SITE-001', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], startTime: '12:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20' },
    { scheduleId: 'SCH-002', programId: 'PRG-002', siteId: 'SITE-001', days: ['Mon', 'Tue', 'Thu', 'Fri'], startTime: '09:00', finishTime: '12:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20' },
    { scheduleId: 'SCH-003', programId: 'PRG-003', siteId: 'SITE-001', days: ['Mon', 'Wed', 'Fri'], startTime: '10:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-004', programId: 'PRG-004', siteId: 'SITE-001', days: ['Tue', 'Thu'], startTime: '10:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20' },
    { scheduleId: 'SCH-005', programId: 'PRG-005', siteId: 'SITE-001', days: ['Mon', 'Wed'], startTime: '13:00', finishTime: '15:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-006', programId: 'PRG-006', siteId: 'SITE-002', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], startTime: '11:30', finishTime: '13:30', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-007', programId: 'PRG-007', siteId: 'SITE-003', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], startTime: '12:30', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18' },
    { scheduleId: 'SCH-008', programId: 'PRG-008', siteId: 'SITE-003', days: ['Tue', 'Thu'], startTime: '10:00', finishTime: '13:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null },
    { scheduleId: 'SCH-009', programId: 'PRG-009', siteId: 'SITE-004', days: ['Mon'], startTime: '11:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21' },
    { scheduleId: 'SCH-010', programId: 'PRG-009', siteId: 'SITE-005', days: ['Wed'], startTime: '12:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21' },
    { scheduleId: 'SCH-011', programId: 'PRG-009', siteId: 'SITE-006', days: ['Fri'], startTime: '14:00', finishTime: '16:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21' },
    { scheduleId: 'SCH-012', programId: 'PRG-010', siteId: 'SITE-007', days: ['Tue'], startTime: '12:00', finishTime: '13:30', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-013', programId: 'PRG-010', siteId: 'SITE-006', days: ['Thu'], startTime: '10:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-014', programId: 'PRG-010', siteId: 'SITE-008', days: ['Sat'], startTime: '11:00', finishTime: '13:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-015', programId: 'PRG-011', siteId: 'SITE-004', days: ['Mon'], startTime: '09:00', finishTime: '12:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-016', programId: 'PRG-011', siteId: 'SITE-009', days: ['Tue'], startTime: '10:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-017', programId: 'PRG-011', siteId: 'SITE-001', days: ['Wed'], startTime: '11:30', finishTime: '14:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-19' },
    { scheduleId: 'SCH-018', programId: 'PRG-011', siteId: 'SITE-010', days: ['Thu'], startTime: '11:00', finishTime: '14:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-019', programId: 'PRG-011', siteId: 'SITE-006', days: ['Fri'], startTime: '09:00', finishTime: '12:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-020', programId: 'PRG-012', siteId: 'SITE-011', days: ['Mon'], startTime: '12:00', finishTime: '14:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null },
    { scheduleId: 'SCH-021', programId: 'PRG-012', siteId: 'SITE-012', days: ['Wed'], startTime: '10:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-022', programId: 'PRG-012', siteId: 'SITE-007', days: ['Sat'], startTime: '10:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    // Phase 4. A schedule with "dates" lists each session of one intake (one program, one intake, six sessions).
    { scheduleId: 'SCH-023', programId: 'PRG-013', siteId: 'SITE-003', intakeId: 'EEL-2026-1', dates: ['2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31'], startTime: '10:00', finishTime: '12:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20' },
    { scheduleId: 'SCH-024', programId: 'PRG-014', siteId: 'SITE-001', intakeId: 'COB-2026-4', dates: ['2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17'], startTime: '14:00', finishTime: '16:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-025', programId: 'PRG-015', siteId: 'SITE-013', days: ['Tue', 'Thu'], startTime: '09:30', finishTime: '15:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-19' },
    { scheduleId: 'SCH-026', programId: 'PRG-016', siteId: 'SITE-014', days: ['Wed'], startTime: '10:00', finishTime: '12:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18' },
    { scheduleId: 'SCH-027', programId: 'PRG-017', siteId: 'SITE-014', days: ['Fri'], startTime: '10:00', finishTime: '12:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-028', programId: 'PRG-018', siteId: 'SITE-012', days: ['Mon'], startTime: '09:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-17' },
    { scheduleId: 'SCH-029', programId: 'PRG-018', siteId: 'SITE-006', days: ['Thu'], startTime: '13:00', finishTime: '16:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-17' },
    { scheduleId: 'SCH-030', programId: 'PRG-019', siteId: 'SITE-015', days: ['Wed'], startTime: '10:00', finishTime: '12:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-16' },
    { scheduleId: 'SCH-031', programId: 'PRG-020', siteId: 'SITE-015', days: ['Fri'], startTime: '09:30', finishTime: '11:30', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-032', programId: 'PRG-022', siteId: 'SITE-008', days: ['Sat'], startTime: '10:30', finishTime: '13:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null },
    { scheduleId: 'SCH-033', programId: 'PRG-022', siteId: 'SITE-005', days: ['Wed'], startTime: '11:00', finishTime: '13:30', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null },
    { scheduleId: 'SCH-034', programId: 'PRG-023', siteId: 'SITE-016', days: ['Tue'], startTime: '10:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20' },
    { scheduleId: 'SCH-035', programId: 'PRG-024', siteId: 'SITE-016', dates: ['2026-11-26', '2026-12-10'], startTime: '13:00', finishTime: '16:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null }
  ],

  // ===========================================================================
  //  Agency collaboration profiles (fictional, for demonstration)
  //  offers: true = yes, false = no, null = not specified (shown as "Not specified").
  //  wants.interests: hosts (find a host for our services), visiting (welcome
  //  visiting providers), mobile (shared mobile delivery), hub, referral, program.
  //  Organisations without a profile are treated as "not specified".
  // ===========================================================================
  collaborationProfiles: {
    'ORG-017': { offers: { indoorSpace: true, outdoorSpace: true, kitchen: true, mobileDelivery: false, visitingSpecialist: false, vehicleAccess: true, privateRoom: true,
        attendance: 'About 80 people attend the daily community lunch (fictional estimate)', hostingTimes: 'Weekdays 10am to 3pm, around the 11:30am lunch',
        amenities: ['Commercial kitchen', 'Dining hall for 60', 'Rear courtyard', 'Car park space for one van', 'Accessible toilets', 'Power and water connection (by arrangement)'] },
      wants: { categories: ['laundry', 'clothing_assistance', 'legal_assistance', 'health_clinics'], interests: ['visiting', 'hub', 'referral'] } },
    'ORG-016': { offers: { indoorSpace: true, outdoorSpace: null, kitchen: true, mobileDelivery: false, visitingSpecialist: false, vehicleAccess: true, privateRoom: true,
        attendance: 'Regular weekday attendance across meals, showers and the clothing room', hostingTimes: 'Wednesday and Friday afternoons',
        amenities: ['Showers', 'Interview room', 'Accessible toilets'] },
      wants: { categories: ['legal_assistance', 'health_clinics', 'financial_counselling', 'dental'], interests: ['visiting', 'hub', 'referral', 'program'] } },
    'ORG-018': { offers: { indoorSpace: true, outdoorSpace: true, kitchen: true, mobileDelivery: false, visitingSpecialist: false, vehicleAccess: true, privateRoom: true,
        attendance: 'Weekday lunch attendance', hostingTimes: 'Tuesday and Thursday mornings; Wednesday afternoons',
        amenities: ['Showers', 'Meeting room', 'Car park suitable for a van'] },
      wants: { categories: ['laundry', 'clothing_assistance', 'dental', 'employment'], interests: ['visiting', 'hub', 'program'] } },
    'ORG-026': { offers: { indoorSpace: true, outdoorSpace: true, kitchen: true, mobileDelivery: false, visitingSpecialist: false, vehicleAccess: null, privateRoom: true,
        attendance: 'Weekly families group and playgroup', hostingTimes: 'Wednesdays and Fridays',
        amenities: ['Family room', 'Outdoor play area', 'Kitchen'] },
      wants: { categories: ['health_clinics', 'dental', 'legal_assistance'], interests: ['visiting', 'hub', 'referral'] } },
    'ORG-024': { offers: { indoorSpace: true, outdoorSpace: false, kitchen: false, mobileDelivery: false, visitingSpecialist: true, vehicleAccess: null, privateRoom: true,
        attendance: null, hostingTimes: 'Monday, Tuesday and Thursday', amenities: ['Computer room', 'Training room'] },
      wants: { categories: ['english_classes', 'digital_access', 'life_skills'], interests: ['program', 'referral', 'hub'] } },
    'ORG-023': { offers: { indoorSpace: true, outdoorSpace: false, kitchen: false, mobileDelivery: false, visitingSpecialist: true, vehicleAccess: null, privateRoom: true,
        attendance: null, hostingTimes: null, amenities: ['Private interview rooms'] },
      wants: { categories: ['english_classes', 'employment', 'community_meals'], interests: ['program', 'hub', 'referral'] } },
    'ORG-021': { offers: { indoorSpace: false, outdoorSpace: null, kitchen: false, mobileDelivery: true, visitingSpecialist: false, vehicleAccess: null, privateRoom: false,
        attendance: null, hostingTimes: null, amenities: ['Van with washers and dryers', 'Needs a water connection or uses its own tank'] },
      wants: { categories: ['community_meals', 'showers_hygiene'], interests: ['hosts', 'mobile', 'hub'] } },
    'ORG-022': { offers: { indoorSpace: false, outdoorSpace: null, kitchen: false, mobileDelivery: true, visitingSpecialist: false, vehicleAccess: null, privateRoom: false,
        attendance: null, hostingTimes: null, amenities: ['Clothing van with fitting area'] },
      wants: { categories: ['community_meals', 'food_relief'], interests: ['hosts', 'mobile', 'hub'] } },
    'ORG-019': { offers: { mobileDelivery: true, visitingSpecialist: false, indoorSpace: false, kitchen: false },
      wants: { categories: ['laundry', 'clothing_assistance'], interests: ['mobile', 'hosts'] } },
    'ORG-004': { offers: { indoorSpace: false, outdoorSpace: null, kitchen: false, mobileDelivery: true, visitingSpecialist: true, vehicleAccess: null, privateRoom: true,
        attendance: null, hostingTimes: null, amenities: ['Clinic van with private consulting room'] },
      wants: { categories: ['community_meals', 'housing_homelessness'], interests: ['hosts', 'hub', 'referral'] } },
    'ORG-011': { offers: { indoorSpace: null, outdoorSpace: null, kitchen: false, mobileDelivery: false, visitingSpecialist: true, vehicleAccess: null, privateRoom: null,
        attendance: null, hostingTimes: null, amenities: ['Volunteer lawyers can attend partner sites by arrangement'] },
      wants: { categories: ['social_support', 'housing_homelessness'], interests: ['hosts', 'hub', 'referral'] } },
    'ORG-014': { offers: { indoorSpace: null, outdoorSpace: false, kitchen: false, mobileDelivery: false, visitingSpecialist: null, vehicleAccess: null, privateRoom: null,
        attendance: 'Classes of up to 16 adult learners', hostingTimes: null, amenities: ['Childcare at some sessions'] },
      wants: { categories: ['financial_counselling', 'employment', 'digital_access'], interests: ['program', 'referral', 'hosts'] } },
    'ORG-025': { offers: { mobileDelivery: true, visitingSpecialist: false, vehicleAccess: null, privateRoom: true, amenities: ['Dental bus needs a level parking area'] },
      wants: { categories: ['community_meals'], interests: ['hosts', 'hub'] } },
    'ORG-027': { offers: { mobileDelivery: false, visitingSpecialist: true, privateRoom: null, amenities: ['Needs a private room at partner sites'] },
      wants: { categories: ['housing_homelessness', 'legal_assistance'], interests: ['hosts', 'referral', 'hub'] } },
    'ORG-028': { offers: { mobileDelivery: true, visitingSpecialist: false, amenities: ['Portable barber chairs; needs shade and power'] },
      wants: { categories: ['showers_hygiene', 'community_meals'], interests: ['hosts', 'hub', 'mobile'] } }
  },
  scheduleWindow: { from: '2026-11-24', to: '2026-12-23' }, // 30 consecutive days

  activities: [
    // ---------------- ORG-001 Wattle Street Community Pantry ----------------
    { activityId: 'ACT-0001', organisationId: 'ORG-001', activityName: 'Low-cost Grocery Pantry', description: 'Shop for staples at reduced prices. Bring your own bags. No referral needed.', category: 'food_relief', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7695, longitude: 150.9080, description: 'Community hall near the town centre (fictional venue)' }, date: '2026-11-24', startTime: '10:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21', isFictional: true },
    { activityId: 'ACT-0002', organisationId: 'ORG-001', activityName: 'Low-cost Grocery Pantry', description: 'Shop for staples at reduced prices. Bring your own bags. No referral needed.', category: 'food_relief', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7695, longitude: 150.9080, description: 'Community hall near the town centre (fictional venue)' }, date: '2026-11-27', startTime: '10:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21', isFictional: true },
    { activityId: 'ACT-0003', organisationId: 'ORG-001', activityName: 'Low-cost Grocery Pantry', description: 'Shop for staples at reduced prices. Bring your own bags. No referral needed.', category: 'food_relief', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7695, longitude: 150.9080, description: 'Community hall near the town centre (fictional venue)' }, date: '2026-12-01', startTime: '10:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0004', organisationId: 'ORG-001', activityName: 'Low-cost Grocery Pantry', description: 'Shop for staples at reduced prices. Bring your own bags. No referral needed.', category: 'food_relief', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7695, longitude: 150.9080, description: 'Community hall near the town centre (fictional venue)' }, date: '2026-12-04', startTime: '10:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0005', organisationId: 'ORG-001', activityName: 'Emergency Food Hamper Pick-up', description: 'Pre-packed emergency hampers for households in immediate need. Limited numbers each session.', category: 'food_relief', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7672, longitude: 150.8215, description: 'Side room of a community centre (fictional venue)' }, date: '2026-11-26', startTime: '14:00', finishTime: '16:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-22', isFictional: true },
    { activityId: 'ACT-0006', organisationId: 'ORG-001', activityName: 'Emergency Food Hamper Pick-up', description: 'Pre-packed emergency hampers for households in immediate need. Limited numbers each session.', category: 'food_relief', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7672, longitude: 150.8215, description: 'Side room of a community centre (fictional venue)' }, date: '2026-12-03', startTime: '14:00', finishTime: '16:30', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-002 Greenway Neighbourhood Centre ----------------
    { activityId: 'ACT-0007', organisationId: 'ORG-002', activityName: 'Wednesday Community Lunch', description: 'Free two-course lunch in a relaxed setting. All welcome, including families.', category: 'community_meals', suburb: 'Lalor Park', lga: 'Blacktown', location: { latitude: -33.7618, longitude: 150.9325, description: 'Neighbourhood centre main hall (fictional venue)' }, date: '2026-11-25', startTime: '12:00', finishTime: '13:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0008', organisationId: 'ORG-002', activityName: 'Wednesday Community Lunch', description: 'Free two-course lunch in a relaxed setting. All welcome, including families.', category: 'community_meals', suburb: 'Lalor Park', lga: 'Blacktown', location: { latitude: -33.7618, longitude: 150.9325, description: 'Neighbourhood centre main hall (fictional venue)' }, date: '2026-12-02', startTime: '12:00', finishTime: '13:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0009', organisationId: 'ORG-002', activityName: "Seniors' Morning Tea & Pantry Table", description: 'Morning tea for older residents with a free pantry table of donated goods.', category: 'community_meals', suburb: 'Seven Hills', lga: 'Blacktown', location: { latitude: -33.7752, longitude: 150.9372, description: 'Library meeting room (fictional venue)' }, date: '2026-11-27', startTime: '10:00', finishTime: '11:30', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0010', organisationId: 'ORG-002', activityName: "Seniors' Morning Tea & Pantry Table", description: 'Morning tea for older residents with a free pantry table of donated goods.', category: 'community_meals', suburb: 'Seven Hills', lga: 'Blacktown', location: { latitude: -33.7752, longitude: 150.9372, description: 'Library meeting room (fictional venue)' }, date: '2026-12-04', startTime: '10:00', finishTime: '11:30', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0048', organisationId: 'ORG-002', activityName: 'After-school Snack & Pantry', description: 'Healthy after-school snacks for children and a small pantry for parents and carers.', category: 'food_relief', suburb: 'Seven Hills', lga: 'Blacktown', location: { latitude: -33.7740, longitude: 150.9345, description: 'Outdoor area beside a sports field (fictional venue)' }, date: '2026-11-24', startTime: '15:00', finishTime: '16:30', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-003 Open Door Outreach Collective ----------------
    { activityId: 'ACT-0011', organisationId: 'ORG-003', activityName: 'Evening Street Outreach — Parramatta', description: 'Outreach team providing hot food, drinks, blankets and referrals to people sleeping rough.', category: 'housing_homelessness', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8168, longitude: 151.0035, description: 'Meeting point near the river foreshore (fictional)' }, date: '2026-11-24', startTime: '19:00', finishTime: '22:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0012', organisationId: 'ORG-003', activityName: 'Evening Street Outreach — Parramatta', description: 'Outreach team providing hot food, drinks, blankets and referrals to people sleeping rough.', category: 'housing_homelessness', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8168, longitude: 151.0035, description: 'Meeting point near the river foreshore (fictional)' }, date: '2026-11-26', startTime: '19:00', finishTime: '22:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0013', organisationId: 'ORG-003', activityName: 'Evening Street Outreach — Parramatta', description: 'Outreach team providing hot food, drinks, blankets and referrals to people sleeping rough.', category: 'housing_homelessness', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8168, longitude: 151.0035, description: 'Meeting point near the river foreshore (fictional)' }, date: '2026-12-01', startTime: '19:00', finishTime: '22:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0014', organisationId: 'ORG-003', activityName: 'Evening Street Outreach — Parramatta', description: 'Outreach team providing hot food, drinks, blankets and referrals to people sleeping rough.', category: 'housing_homelessness', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8168, longitude: 151.0035, description: 'Meeting point near the river foreshore (fictional)' }, date: '2026-12-03', startTime: '19:00', finishTime: '22:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0015', organisationId: 'ORG-003', activityName: 'Swag & Bedding Distribution', description: 'Distribution of swags, sleeping bags and warm clothing while stocks last.', category: 'housing_homelessness', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8225, longitude: 151.0075, description: 'Car park beside a community building (fictional venue)' }, date: '2026-11-28', startTime: '08:00', finishTime: '10:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-004 Westside Mobile Health Clinic ----------------
    { activityId: 'ACT-0016', organisationId: 'ORG-004', activityName: 'Mobile GP Clinic (bulk-billed)', description: 'Walk-in GP consultations from a mobile clinic van. Medicare card helpful but not required.', category: 'health_clinics', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7700, longitude: 150.8180, description: 'Clinic van parked near the shopping precinct (fictional)' }, date: '2026-11-25', startTime: '09:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },
    { activityId: 'ACT-0017', organisationId: 'ORG-004', activityName: 'Mobile GP Clinic (bulk-billed)', description: 'Walk-in GP consultations from a mobile clinic van. Medicare card helpful but not required.', category: 'health_clinics', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7700, longitude: 150.8180, description: 'Clinic van parked near the shopping precinct (fictional)' }, date: '2026-12-02', startTime: '09:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },
    { activityId: 'ACT-0018', organisationId: 'ORG-004', activityName: 'Mobile GP Clinic (bulk-billed)', description: 'Walk-in GP consultations from a mobile clinic van. Medicare card helpful but not required.', category: 'health_clinics', suburb: 'Rosehill', lga: 'Parramatta', location: { latitude: -33.8215, longitude: 151.0240, description: 'Clinic van beside a community park (fictional)' }, date: '2026-11-27', startTime: '09:00', finishTime: '13:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },
    { activityId: 'ACT-0019', organisationId: 'ORG-004', activityName: 'Mobile GP Clinic (bulk-billed)', description: 'Walk-in GP consultations from a mobile clinic van. Medicare card helpful but not required.', category: 'health_clinics', suburb: 'Rosehill', lga: 'Parramatta', location: { latitude: -33.8215, longitude: 151.0240, description: 'Clinic van beside a community park (fictional)' }, date: '2026-12-04', startTime: '09:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0020', organisationId: 'ORG-004', activityName: 'Flu & COVID Vaccination Pop-up', description: 'Free walk-in vaccinations for eligible adults and children over five.', category: 'health_clinics', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7720, longitude: 150.9050, description: 'Plaza near the library (fictional)' }, date: '2026-11-29', startTime: '10:00', finishTime: '14:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0047', organisationId: 'ORG-004', activityName: 'Mobile GP Clinic (bulk-billed)', description: 'Walk-in GP consultations from a mobile clinic van. Medicare card helpful but not required.', category: 'health_clinics', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7690, longitude: 150.8430, description: 'Clinic van in a community centre car park (fictional)' }, date: '2026-11-24', startTime: '14:00', finishTime: '17:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },

    // ---------------- ORG-005 Riverbank Shared Table ----------------
    { activityId: 'ACT-0021', organisationId: 'ORG-005', activityName: 'Thursday Night Shared Dinner', description: 'Free sit-down dinner cooked by volunteers. Vegetarian option available.', category: 'community_meals', suburb: 'North Parramatta', lga: 'Parramatta', location: { latitude: -33.8005, longitude: 151.0040, description: 'Church hall dining room (fictional venue)' }, date: '2026-11-26', startTime: '17:30', finishTime: '19:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-24', isFictional: true },
    { activityId: 'ACT-0022', organisationId: 'ORG-005', activityName: 'Thursday Night Shared Dinner', description: 'Free sit-down dinner cooked by volunteers. Vegetarian option available.', category: 'community_meals', suburb: 'North Parramatta', lga: 'Parramatta', location: { latitude: -33.8005, longitude: 151.0040, description: 'Church hall dining room (fictional venue)' }, date: '2026-12-03', startTime: '17:30', finishTime: '19:30', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0023', organisationId: 'ORG-005', activityName: 'Sunday Breakfast Club', description: 'Hot breakfast, tea and coffee. Showers available on request.', category: 'community_meals', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8135, longitude: 150.9990, description: 'Community room near the park (fictional venue)' }, date: '2026-11-29', startTime: '08:00', finishTime: '10:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-22', isFictional: true },
    { activityId: 'ACT-0024', organisationId: 'ORG-005', activityName: 'Sunday Breakfast Club', description: 'Hot breakfast, tea and coffee. Showers available on request.', category: 'community_meals', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8135, longitude: 150.9990, description: 'Community room near the park (fictional venue)' }, date: '2026-12-06', startTime: '08:00', finishTime: '10:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-006 Harbourlight Youth & Family Services ----------------
    { activityId: 'ACT-0025', organisationId: 'ORG-006', activityName: 'Family Food Hamper Collection', description: 'Hampers for families with children. Registration on arrival.', category: 'food_relief', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7712, longitude: 150.8455, description: 'Family services office (fictional venue)' }, date: '2026-11-24', startTime: '15:00', finishTime: '17:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0026', organisationId: 'ORG-006', activityName: 'Family Food Hamper Collection', description: 'Hampers for families with children. Registration on arrival.', category: 'food_relief', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7712, longitude: 150.8455, description: 'Family services office (fictional venue)' }, date: '2026-12-01', startTime: '15:00', finishTime: '17:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0027', organisationId: 'ORG-006', activityName: 'Youth Drop-in & Free Dinner', description: 'Drop-in space for young people aged 12–24 with games, support workers and a free dinner.', category: 'community_meals', suburb: 'Doonside', lga: 'Blacktown', location: { latitude: -33.7655, longitude: 150.8705, description: 'Youth centre (fictional venue)' }, date: '2026-11-27', startTime: '16:00', finishTime: '19:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-19', isFictional: true },
    { activityId: 'ACT-0028', organisationId: 'ORG-006', activityName: 'Youth Drop-in & Free Dinner', description: 'Drop-in space for young people aged 12–24 with games, support workers and a free dinner.', category: 'community_meals', suburb: 'Doonside', lga: 'Blacktown', location: { latitude: -33.7655, longitude: 150.8705, description: 'Youth centre (fictional venue)' }, date: '2026-12-04', startTime: '16:00', finishTime: '19:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-19', isFictional: true },

    // ---------------- ORG-007 Eastgate Faith Community Kitchen ----------------
    { activityId: 'ACT-0029', organisationId: 'ORG-007', activityName: 'Community Soup Kitchen', description: 'Soup, bread and dessert served at the door. No questions asked.', category: 'community_meals', suburb: 'Northmead', lga: 'Parramatta', location: { latitude: -33.7845, longitude: 150.9930, description: 'Church kitchen side entrance (fictional venue)' }, date: '2026-11-25', startTime: '18:00', finishTime: '19:30', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0030', organisationId: 'ORG-007', activityName: 'Community Soup Kitchen', description: 'Soup, bread and dessert served at the door. No questions asked.', category: 'community_meals', suburb: 'Northmead', lga: 'Parramatta', location: { latitude: -33.7845, longitude: 150.9930, description: 'Church kitchen side entrance (fictional venue)' }, date: '2026-12-02', startTime: '18:00', finishTime: '19:30', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0031', organisationId: 'ORG-007', activityName: 'Saturday Community Lunch', description: 'Free cooked lunch followed by a clothing swap table.', category: 'community_meals', suburb: 'Westmead', lga: 'Parramatta', location: { latitude: -33.8085, longitude: 150.9880, description: 'Parish hall (fictional venue)' }, date: '2026-11-28', startTime: '12:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18', isFictional: true },
    { activityId: 'ACT-0032', organisationId: 'ORG-007', activityName: 'Saturday Community Lunch', description: 'Free cooked lunch followed by a clothing swap table.', category: 'community_meals', suburb: 'Westmead', lga: 'Parramatta', location: { latitude: -33.8085, longitude: 150.9880, description: 'Parish hall (fictional venue)' }, date: '2026-12-05', startTime: '12:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18', isFictional: true },

    // ---------------- ORG-008 Bluegum Volunteer Food Rescue ----------------
    { activityId: 'ACT-0033', organisationId: 'ORG-008', activityName: 'Rescued Produce Market', description: 'Pay-what-you-can market of rescued fruit, vegetables and bread.', category: 'food_relief', suburb: 'Quakers Hill', lga: 'Blacktown', location: { latitude: -33.7345, longitude: 150.8875, description: 'Community garden shed (fictional venue)' }, date: '2026-11-28', startTime: '09:00', finishTime: '11:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21', isFictional: true },
    { activityId: 'ACT-0034', organisationId: 'ORG-008', activityName: 'Rescued Produce Market', description: 'Pay-what-you-can market of rescued fruit, vegetables and bread.', category: 'food_relief', suburb: 'Quakers Hill', lga: 'Blacktown', location: { latitude: -33.7345, longitude: 150.8875, description: 'Community garden shed (fictional venue)' }, date: '2026-12-05', startTime: '09:00', finishTime: '11:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0035', organisationId: 'ORG-008', activityName: 'Pop-up Food Rescue Stall', description: 'Free rescued groceries from a pop-up trailer while stocks last.', category: 'food_relief', suburb: 'Plumpton', lga: 'Blacktown', location: { latitude: -33.7515, longitude: 150.8395, description: 'Shopping centre forecourt (fictional)' }, date: '2026-11-30', startTime: '13:00', finishTime: '15:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0036', organisationId: 'ORG-008', activityName: 'Pop-up Food Rescue Stall', description: 'Free rescued groceries from a pop-up trailer while stocks last.', category: 'food_relief', suburb: 'Rydalmere', lga: 'Parramatta', location: { latitude: -33.8125, longitude: 151.0345, description: 'Reserve car park (fictional)' }, date: '2026-12-02', startTime: '10:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0046', organisationId: 'ORG-008', activityName: 'Pop-up Food Rescue Stall', description: 'Free rescued groceries from a pop-up trailer while stocks last.', category: 'food_relief', suburb: 'Rosehill', lga: 'Parramatta', location: { latitude: -33.8200, longitude: 151.0255, description: 'Corner of a local park (fictional)' }, date: '2026-11-24', startTime: '11:00', finishTime: '13:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-009 Parkside Wellbeing Hub ----------------
    { activityId: 'ACT-0037', organisationId: 'ORG-009', activityName: 'Mental Health Drop-in', description: 'Talk with a peer worker or counsellor. No appointment or referral needed.', category: 'mental_health', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8240, longitude: 151.0090, description: 'Wellbeing hub shopfront (fictional venue)' }, date: '2026-11-24', startTime: '13:00', finishTime: '16:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-17', isFictional: true },
    { activityId: 'ACT-0038', organisationId: 'ORG-009', activityName: 'Mental Health Drop-in', description: 'Talk with a peer worker or counsellor. No appointment or referral needed.', category: 'mental_health', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8240, longitude: 151.0090, description: 'Wellbeing hub shopfront (fictional venue)' }, date: '2026-12-01', startTime: '13:00', finishTime: '16:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-17', isFictional: true },
    { activityId: 'ACT-0039', organisationId: 'ORG-009', activityName: "Women's Health Check Day", description: 'Health checks, screening information and a nurse for questions. Women-only space.', category: 'health_clinics', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7700, longitude: 150.9100, description: 'Community health room (fictional venue)' }, date: '2026-12-03', startTime: '10:00', finishTime: '15:00', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0040', organisationId: 'ORG-009', activityName: 'Dental Screening Pop-up', description: 'Free dental check and referral pathway for adults without private cover.', category: 'health_clinics', suburb: 'Ermington', lga: 'Parramatta', location: { latitude: -33.8125, longitude: 151.0560, description: 'Community centre meeting room (fictional venue)' }, date: '2026-12-06', startTime: '10:00', finishTime: '13:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-010 Northline Street Support ----------------
    { activityId: 'ACT-0041', organisationId: 'ORG-010', activityName: 'Morning Outreach Van', description: 'Breakfast, coffee and a caseworker from an outreach van.', category: 'housing_homelessness', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7680, longitude: 150.9045, description: 'Near the station bus interchange (fictional)' }, date: '2026-11-25', startTime: '07:00', finishTime: '09:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0042', organisationId: 'ORG-010', activityName: 'Morning Outreach Van', description: 'Breakfast, coffee and a caseworker from an outreach van.', category: 'housing_homelessness', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7680, longitude: 150.9045, description: 'Near the station bus interchange (fictional)' }, date: '2026-11-30', startTime: '07:00', finishTime: '09:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },
    { activityId: 'ACT-0043', organisationId: 'ORG-010', activityName: 'Outreach Showers & Lunch', description: 'Mobile showers, toiletries and a packed lunch.', category: 'showers_hygiene', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7660, longitude: 150.8230, description: 'Reserve beside the community centre (fictional)' }, date: '2026-11-28', startTime: '10:00', finishTime: '13:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0044', organisationId: 'ORG-010', activityName: 'Housing Support Pop-up', description: 'Caseworkers help with housing applications, Centrelink and ID documents.', category: 'housing_homelessness', suburb: 'Whalan', lga: 'Blacktown', location: { latitude: -33.7575, longitude: 150.8060, description: 'Neighbourhood hub (fictional venue)' }, date: '2026-12-07', startTime: '11:00', finishTime: '14:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0045', organisationId: 'ORG-010', activityName: 'Laundry & Lunch', description: 'Free laundry machines and a hot lunch while you wait.', category: 'laundry', suburb: 'Bidwill', lga: 'Blacktown', location: { latitude: -33.7305, longitude: 150.8240, description: 'Community laundry room (fictional venue)' }, date: '2026-12-06', startTime: '11:00', finishTime: '14:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0062', organisationId: 'ORG-010', activityName: 'Late Night Outreach Van', description: 'Late outreach run with hot drinks, blankets and a caseworker for people sleeping rough.', category: 'housing_homelessness', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7665, longitude: 150.8200, description: 'Meeting point near the station (fictional)' }, date: '2026-11-27', startTime: '21:00', finishTime: '23:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-23', isFictional: true },

    // ---------------- ORG-004 (additional) ----------------
    { activityId: 'ACT-0071', organisationId: 'ORG-004', activityName: 'Evening Walk-in Nurse Clinic', description: 'Nurse-led clinic for wound care, blood pressure checks and health advice. No appointment needed.', category: 'health_clinics', suburb: 'Rosehill', lga: 'Parramatta', location: { latitude: -33.8215, longitude: 151.0240, description: 'Clinic van beside a community park (fictional)' }, date: '2026-12-01', startTime: '18:00', finishTime: '21:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-009 (additional mental health) ----------------
    { activityId: 'ACT-0060', organisationId: 'ORG-009', activityName: 'Evening Peer Support Group', description: 'Facilitated peer support group for adults managing anxiety, depression or stress.', category: 'mental_health', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7710, longitude: 150.9095, description: 'Community health room (fictional venue)' }, date: '2026-11-26', startTime: '18:30', finishTime: '20:00', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0061', organisationId: 'ORG-009', activityName: "Men's Wellbeing Yarn Circle", description: 'Informal yarn circle for men, with a counsellor available. Light dinner provided.', category: 'mental_health', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7700, longitude: 150.8470, description: 'Sports club meeting room (fictional venue)' }, date: '2026-12-02', startTime: '17:00', finishTime: '19:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-011 Saltbush Free Legal Help ----------------
    { activityId: 'ACT-0049', organisationId: 'ORG-011', activityName: 'Free Legal Advice Night', description: 'Free 20-minute appointments with a volunteer lawyer on tenancy, fines, debt and family law. Walk-ins welcome.', category: 'legal_assistance', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8150, longitude: 151.0050, description: 'Meeting rooms above a community building (fictional venue)' }, date: '2026-11-25', startTime: '18:00', finishTime: '20:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },
    { activityId: 'ACT-0050', organisationId: 'ORG-011', activityName: 'Free Legal Advice Night', description: 'Free 20-minute appointments with a volunteer lawyer on tenancy, fines, debt and family law. Walk-ins welcome.', category: 'legal_assistance', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8150, longitude: 151.0050, description: 'Meeting rooms above a community building (fictional venue)' }, date: '2026-12-02', startTime: '18:00', finishTime: '20:30', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0051', organisationId: 'ORG-011', activityName: 'Fines & Debt Legal Help Pop-up', description: 'Help with unpaid fines, debt letters and payment plans.', category: 'legal_assistance', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7680, longitude: 150.8200, description: 'Community centre interview room (fictional venue)' }, date: '2027-01-08', startTime: '10:00', finishTime: '13:00', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0052', organisationId: 'ORG-011', activityName: 'Tenancy Rights Clinic', description: 'Advice for renters on repairs, rent increases, bonds and eviction notices.', category: 'legal_assistance', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7705, longitude: 150.9070, description: 'Library study room (fictional venue)' }, date: '2027-01-12', startTime: '13:00', finishTime: '16:00', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-012 Second Stitch Clothing Exchange ----------------
    { activityId: 'ACT-0053', organisationId: 'ORG-012', activityName: 'Free Clothing Store', description: 'Choose up to ten free items of clothing and shoes per visit. Adult and children sizes.', category: 'clothing_assistance', suburb: 'Doonside', lga: 'Blacktown', location: { latitude: -33.7665, longitude: 150.8690, description: 'Shopfront in a small retail strip (fictional venue)' }, date: '2026-11-26', startTime: '10:00', finishTime: '14:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-22', isFictional: true },
    { activityId: 'ACT-0054', organisationId: 'ORG-012', activityName: 'Winter & School Uniform Swap', description: 'Swap or collect free school uniforms, jackets and winter wear.', category: 'clothing_assistance', suburb: 'Westmead', lga: 'Parramatta', location: { latitude: -33.8075, longitude: 150.9870, description: 'School hall (fictional venue)' }, date: '2026-11-29', startTime: '09:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0055', organisationId: 'ORG-012', activityName: 'Free Clothing Store', description: 'Choose up to ten free items of clothing and shoes per visit. Adult and children sizes.', category: 'clothing_assistance', suburb: 'Doonside', lga: 'Blacktown', location: { latitude: -33.7665, longitude: 150.8690, description: 'Shopfront in a small retail strip (fictional venue)' }, date: '2026-12-03', startTime: '10:00', finishTime: '14:00', source: 'organisation_website', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-015 Fresh Start Hygiene Bus ----------------
    { activityId: 'ACT-0056', organisationId: 'ORG-015', activityName: 'Mobile Laundry Van', description: 'Free washing and drying while you wait. Detergent supplied.', category: 'laundry', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8125, longitude: 151.0020, description: 'Car park near the park entrance (fictional)' }, date: '2026-11-24', startTime: '18:30', finishTime: '21:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21', isFictional: true },
    { activityId: 'ACT-0057', organisationId: 'ORG-015', activityName: 'Mobile Laundry Van', description: 'Free washing and drying while you wait. Detergent supplied.', category: 'laundry', suburb: 'Parramatta', lga: 'Parramatta', location: { latitude: -33.8125, longitude: 151.0020, description: 'Car park near the park entrance (fictional)' }, date: '2026-12-01', startTime: '18:30', finishTime: '21:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0058', organisationId: 'ORG-015', activityName: 'Hot Showers & Hygiene Packs', description: 'Private hot showers, towels and free hygiene packs.', category: 'showers_hygiene', suburb: 'Mount Druitt', lga: 'Blacktown', location: { latitude: -33.7690, longitude: 150.8245, description: 'Hygiene bus parked beside a reserve (fictional)' }, date: '2026-11-25', startTime: '07:30', finishTime: '10:30', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-21', isFictional: true },
    { activityId: 'ACT-0059', organisationId: 'ORG-015', activityName: 'Hot Showers & Hygiene Packs', description: 'Private hot showers, towels and free hygiene packs.', category: 'showers_hygiene', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8232, longitude: 151.0068, description: 'Hygiene bus in a side street car park (fictional)' }, date: '2026-11-28', startTime: '08:00', finishTime: '11:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-013 Paws Together Community Vet Van ----------------
    { activityId: 'ACT-0063', organisationId: 'ORG-013', activityName: 'Free Pet Health Check', description: 'Free checks, vaccinations and flea treatment for pets of people on low incomes or experiencing homelessness.', category: 'veterinary', suburb: 'Bidwill', lga: 'Blacktown', location: { latitude: -33.7310, longitude: 150.8255, description: 'Vet van in a community centre car park (fictional)' }, date: '2026-11-28', startTime: '09:00', finishTime: '12:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-20', isFictional: true },
    { activityId: 'ACT-0064', organisationId: 'ORG-013', activityName: 'Free Pet Health Check', description: 'Free checks, vaccinations and flea treatment for pets of people on low incomes or experiencing homelessness.', category: 'veterinary', suburb: 'Rydalmere', lga: 'Parramatta', location: { latitude: -33.8135, longitude: 151.0330, description: 'Vet van at a reserve car park (fictional)' }, date: '2026-12-05', startTime: '09:00', finishTime: '12:00', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0065', organisationId: 'ORG-013', activityName: 'Pet Microchipping Day', description: 'Free microchipping and pet registration help.', category: 'veterinary', suburb: 'Quakers Hill', lga: 'Blacktown', location: { latitude: -33.7355, longitude: 150.8860, description: 'Community garden car park (fictional)' }, date: '2026-12-06', startTime: '10:00', finishTime: '14:00', source: 'community_report', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- ORG-014 Common Ground English Circle ----------------
    { activityId: 'ACT-0066', organisationId: 'ORG-014', activityName: 'Evening English Conversation Class', description: 'Relaxed conversation practice for adults at all levels. Free, no enrolment needed.', category: 'english_classes', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8236, longitude: 151.0102, description: 'Community classroom (fictional venue)' }, date: '2026-11-24', startTime: '18:00', finishTime: '20:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18', isFictional: true },
    { activityId: 'ACT-0067', organisationId: 'ORG-014', activityName: 'Evening English Conversation Class', description: 'Relaxed conversation practice for adults at all levels. Free, no enrolment needed.', category: 'english_classes', suburb: 'Harris Park', lga: 'Parramatta', location: { latitude: -33.8236, longitude: 151.0102, description: 'Community classroom (fictional venue)' }, date: '2026-12-01', startTime: '18:00', finishTime: '20:00', source: 'provider_submission', verificationStatus: 'provider_confirmed', lastConfirmedDate: '2026-11-18', isFictional: true },
    { activityId: 'ACT-0068', organisationId: 'ORG-014', activityName: 'Beginner English for Parents', description: 'Beginner English for parents and carers, with free childcare during class.', category: 'english_classes', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7688, longitude: 150.9112, description: 'Library meeting room (fictional venue)' }, date: '2026-11-26', startTime: '09:30', finishTime: '11:30', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0069', organisationId: 'ORG-014', activityName: 'Beginner English for Parents', description: 'Beginner English for parents and carers, with free childcare during class.', category: 'english_classes', suburb: 'Blacktown', lga: 'Blacktown', location: { latitude: -33.7688, longitude: 150.9112, description: 'Library meeting room (fictional venue)' }, date: '2026-12-03', startTime: '09:30', finishTime: '11:30', source: 'council_directory', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0070', organisationId: 'ORG-014', activityName: 'Job-ready English Workshop', description: 'English for job applications, interviews and workplace conversations.', category: 'english_classes', suburb: 'Seven Hills', lga: 'Blacktown', location: { latitude: -33.7760, longitude: 150.9360, description: 'Community centre classroom (fictional venue)' }, date: '2026-12-07', startTime: '18:30', finishTime: '20:30', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true },

    // ---------------- Service Analysis demonstration (added) ----------------
    // Two extra fictional occurrences so that three food relief activities are
    // scheduled at the same time in Rooty Hill (with ACT-0025) on 24 Nov.
    { activityId: 'ACT-0072', organisationId: 'ORG-008', activityName: 'Pop-up Food Rescue Stall', description: 'Free rescued groceries from a pop-up trailer while stocks last.', category: 'food_relief', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7698, longitude: 150.8442, description: 'Car park beside a community centre (fictional)' }, date: '2026-11-24', startTime: '14:30', finishTime: '16:30', source: 'social_media', verificationStatus: 'published', lastConfirmedDate: null, isFictional: true },
    { activityId: 'ACT-0073', organisationId: 'ORG-001', activityName: 'Emergency Food Hamper Pick-up', description: 'Pre-packed emergency hampers for households in immediate need. Limited numbers each session.', category: 'food_relief', suburb: 'Rooty Hill', lga: 'Blacktown', location: { latitude: -33.7718, longitude: 150.8470, description: 'Meeting room at a sports club (fictional venue)' }, date: '2026-11-24', startTime: '15:30', finishTime: '17:30', source: 'partner_referral', verificationStatus: 'unverified', lastConfirmedDate: null, isFictional: true }
  ]
};

/*
 * ---------------------------------------------------------------------------
 *  Build the full set of dated occurrences
 * ---------------------------------------------------------------------------
 *  1. Every weekly schedule above is expanded into one activity record per
 *     scheduled date inside `scheduleWindow` (24 Nov – 23 Dec 2026). Totals are
 *     never hardcoded; they come from these generated records.
 *  2. The original one-off records (ACT-xxxx) are linked to a program and a
 *     site without editing them: records from the same organisation with the
 *     same activity name form one program; records at the same coordinates
 *     share one site. These sites have no host organisation recorded.
 *  3. Each program and site gets a short summary used by the dashboard.
 *
 *  Note: the two Blacktown legal assistance sessions (ACT-0051, ACT-0052)
 *  were moved to January 2027 so that the 30-day demonstration period has
 *  no recorded legal assistance in Blacktown LGA (Story 3).
 */
(function buildOccurrences(D) {
  const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const fmtTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
  };
  const fmtD = (iso) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(parse(iso));
  const daysText = (days) => {
    const sorted = DAY_ORDER.filter((d) => days.includes(d));
    if (sorted.length === 7) return 'Every day';
    if (sorted.join() === 'Mon,Tue,Wed,Thu,Fri') return 'Monday to Friday';
    return sorted.join(', ');
  };

  const siteById = new Map(D.sites.map((s) => [s.siteId, s]));
  const programById = new Map(D.programs.map((p) => [p.programId, p]));
  const orgName = (id) => ((D.organisations.find((o) => o.organisationId === id) || {}).organisationName || '');

  // 1. Expand weekly schedules into dated occurrences.
  D.schedules.forEach((sc) => {
    const p = programById.get(sc.programId);
    const s = siteById.get(sc.siteId);
    // Either listed session dates (one intake of a course) or weekly days within the window.
    const dates = [];
    if (sc.dates) dates.push(...sc.dates);
    else {
      const wanted = sc.days.map((d) => DAY_INDEX[d]);
      for (let d = parse(D.scheduleWindow.from); d <= parse(D.scheduleWindow.to); d.setDate(d.getDate() + 1)) {
        if (wanted.includes(d.getDay())) dates.push(toISO(d));
      }
    }
    dates.forEach((date, i) => {
      D.activities.push({
        activityId: `OCC-${sc.scheduleId.slice(4)}-${date.replace(/-/g, '')}`,
        organisationId: p.organisationId,
        programId: p.programId,
        siteId: s.siteId,
        scheduleId: sc.scheduleId,
        deliveryMode: p.deliveryMode,
        activityName: p.programName,
        description: p.description,
        category: p.category,
        suburb: s.suburb,
        lga: s.lga,
        location: { latitude: s.location.latitude, longitude: s.location.longitude, description: s.location.description },
        date,
        startTime: sc.startTime,
        finishTime: sc.finishTime,
        source: sc.source,
        verificationStatus: sc.verificationStatus,
        lastConfirmedDate: sc.lastConfirmedDate,
        intakeId: sc.intakeId || null,
        sessionNumber: sc.dates ? i + 1 : null,
        sessionsInIntake: sc.dates ? sc.dates.length : null,
        isFictional: true
      });
    });
  });

  // 2. Link original one-off records to programs and sites.
  const programKey = new Map();
  const siteKey = new Map();
  D.activities.forEach((a) => {
    if (a.programId) return;
    const pk = `${a.organisationId}|${a.activityName}`;
    if (!programKey.has(pk)) {
      const id = `PRG-R${String(programKey.size + 1).padStart(2, '0')}`;
      const mobile = /mobile|van\b|pop-up|bus\b/i.test(`${a.activityName} ${orgName(a.organisationId)}`);
      programKey.set(pk, id);
      D.programs.push({ programId: id, organisationId: a.organisationId, programName: a.activityName, category: a.category, deliveryMode: mobile ? 'mobile' : 'fixed', description: a.description, recordedAsOneOff: true, isFictional: true });
    }
    const sk = `${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}`;
    if (!siteKey.has(sk)) {
      const id = `SITE-R${String(siteKey.size + 1).padStart(2, '0')}`;
      siteKey.set(sk, id);
      D.sites.push({ siteId: id, siteName: a.location.description, siteType: 'recorded_location', hostOrganisationId: null, suburb: a.suburb, lga: a.lga, location: Object.assign({}, a.location), isFictional: true });
    }
    a.programId = programKey.get(pk);
    a.siteId = siteKey.get(sk);
  });
  D.programs.forEach((p) => programById.set(p.programId, p));
  D.sites.forEach((s) => siteById.set(s.siteId, s));
  D.activities.forEach((a) => { a.deliveryMode = programById.get(a.programId).deliveryMode; });

  // 3. Summaries for programs and sites.
  D.programs.forEach((p) => {
    const occ = D.activities.filter((a) => a.programId === p.programId);
    p.siteIds = [...new Set(occ.map((a) => a.siteId))];
    p.sessionCount = occ.length;
    const sch = D.schedules.filter((sc) => sc.programId === p.programId);
    const dated = sch.filter((sc) => sc.dates);
    if (p.publicSchedule === false) {
      p.scheduleText = 'By appointment or referral. Times and locations are not published.';
    } else if (dated.length && dated.length === sch.length) {
      const first = dated[0];
      const wd = DAY_ORDER[(parse(first.dates[0]).getDay() + 6) % 7];
      const intake = (p.intakes || []).find((x) => x.intakeId === first.intakeId);
      p.scheduleText = intake && p.programType === 'fixed_term'
        ? `${first.dates.length} weekly sessions, ${wd} ${fmtTime(first.startTime)} – ${fmtTime(first.finishTime)}, from ${fmtD(first.dates[0])} to ${fmtD(first.dates[first.dates.length - 1])} at ${siteById.get(first.siteId).siteName} (intake ${intake.intakeId})`
        : `${first.dates.length} listed sessions, ${fmtTime(first.startTime)} – ${fmtTime(first.finishTime)} at ${siteById.get(first.siteId).siteName}`;
    } else if (!sch.length) {
      p.scheduleText = `Recorded as ${occ.length} individual dated session${occ.length === 1 ? '' : 's'} (no weekly schedule recorded)`;
    } else if (sch.length === 1) {
      p.scheduleText = `${daysText(sch[0].days)}, ${fmtTime(sch[0].startTime)} – ${fmtTime(sch[0].finishTime)} at ${siteById.get(sch[0].siteId).siteName}`;
    } else {
      const stops = sch.slice().sort((x, y) => DAY_ORDER.indexOf(x.days[0]) - DAY_ORDER.indexOf(y.days[0]))
        .map((sc) => `${daysText(sc.days)} ${fmtTime(sc.startTime)} – ${fmtTime(sc.finishTime)}: ${siteById.get(sc.siteId).siteName}`);
      p.scheduleText = `Visits ${new Set(sch.map((sc) => sc.siteId)).size} locations weekly. ${stops.join('; ')}`;
    }
  });
  D.sites.forEach((s) => {
    s.programIds = [...new Set(D.activities.filter((a) => a.siteId === s.siteId).map((a) => a.programId))];
  });
})(window.ONNOW_SAMPLE_DATA);
