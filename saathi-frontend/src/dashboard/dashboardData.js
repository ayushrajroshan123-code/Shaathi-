/**
 * dashboardData.js
 * Canonical mock data for the SAATHI Greenwood Commons Pilot Hub (Oakridge Circle)
 * 24 Connected Neighbors across 6 primary lots.
 * 
 * Flow: ASK → FIND → COORDINATE → COMPLETE
 * Modes: NORMAL (warm, lively, architectural) & EMERGENCY (ALERT → RESPOND → COORDINATE → RESOLVE)
 */

export const PILOT_HUB_INFO = {
  hubId: '00000000-0000-0000-0000-000000000001',
  name: 'Greenwood Commons',
  subName: 'Oakridge Circle Pilot Hub',
  connectedCount: 24,
  activeCoordinationCount: 3,
  address: 'Oakridge Circle, Ward 4',
  coordinator: 'Kavita Sharma (Lot 1)',
};

export const CURRENT_USER = {
  id: 'usr-sarah-04',
  name: 'Sarah Chen',
  role: 'Resident (Lot 4)',
  lotId: 4,
  address: '16 Oakridge Circle (Lot 4)',
  avatar: 'SC',
  verificationTier: 'standard', // verified resident
};

// -----------------------------------------------------------------------------
// 1. LOTS & RESIDENTS (Contextual connections, NO follower counts or star ratings)
// -----------------------------------------------------------------------------
export const RESIDENTIAL_LOTS = [
  {
    id: 1,
    name: 'Lot 1 · The Corner Bakery & House',
    residentName: 'Kavita & Dev Sharma',
    avatar: 'KS',
    archetype: 'Foreground South Building with Cat Roof & Cafe',
    description: 'Ground floor community kitchen, pantry, and corner courtyard.',
    relation: 'Your Residence · Verified resident 5 yrs · Neighborhood keyholder',
    position3D: { x: 11.8, y: 3.8, z: 11.6 },
    coverageItems: [
      {
        id: 'cov-1',
        title: 'Package & Delivery Holding',
        category: 'package',
        window: 'Daily 8:00 AM – 8:00 PM',
        detail: 'Covered front vestibule with secure delivery drop box.',
        status: 'Available today',
      },
      {
        id: 'cov-2',
        title: 'Community Dry-Pantry Access',
        category: 'supplies',
        window: 'Always available upon ping',
        detail: 'Emergency dry food rations, drinking water jugs, and thermal flasks.',
        status: 'Available',
      },
    ],
    resources: [
      {
        id: 'res-1',
        name: 'Heavy-Duty 8ft Aluminum Step Ladder',
        category: 'tools',
        condition: 'Excellent',
        location: 'Garden shed behind cafe patio',
        available: true,
        sharedBy: 'Dev Sharma',
      },
      {
        id: 'res-2',
        name: 'Heavy-Duty Outdoor Extension Cord (50ft)',
        category: 'electrical',
        condition: 'Good',
        location: 'Hallway storage trunk',
        available: true,
        sharedBy: 'Kavita Sharma',
      },
    ],
  },
  {
    id: 2,
    name: 'Lot 2 · Brick Corner Residence',
    residentName: 'Dr. Aris Thorne',
    avatar: 'AT',
    archetype: 'West 3-Story Slender Building with Red Awnings',
    description: 'Pediatric specialist, first responder certified, active neighborhood helper.',
    relation: 'Medical responder verified · 3 houses down · Keyholder for Lot 5',
    position3D: { x: -8.8, y: 5.2, z: 8.8 },
    coverageItems: [
      {
        id: 'cov-3',
        title: 'Medical & First Aid Assessment',
        category: 'medical',
        window: 'Evenings & Emergency Standby',
        detail: 'Trained in pediatric triage, CPR, burns, and home wound management.',
        status: 'On standby',
      },
      {
        id: 'cov-4',
        title: 'Indoor Ferns & Plant Care',
        category: 'gardening',
        window: 'Weekend mornings & weekday evenings',
        detail: 'Helps water sensitive house plants when neighbors travel.',
        status: 'Available',
      },
    ],
    resources: [
      {
        id: 'res-3',
        name: 'DeWalt 20V Cordless Drill & Bit Set',
        category: 'tools',
        condition: 'Like New',
        location: 'Ground floor workshop bench',
        available: true,
        sharedBy: 'Dr. Aris Thorne',
      },
      {
        id: 'res-4',
        name: 'Philips HeartStart Home AED',
        category: 'medical',
        condition: 'Certified / Inspected',
        location: 'Front entry hall mount',
        available: true,
        sharedBy: 'Dr. Aris Thorne',
      },
    ],
  },
  {
    id: 3,
    name: 'Lot 3 · The Peach Cottage',
    residentName: 'Marcus & Priya Vance',
    avatar: 'MV',
    archetype: 'West 2-Story Cottage with Green Awning & Vegetable Garden',
    description: 'Permaculture gardener, animal lover, carpentry enthusiast.',
    relation: 'Lives opposite · Pet care certified · Mutual key holder',
    position3D: { x: -14.4, y: 3.8, z: 13.0 },
    coverageItems: [
      {
        id: 'cov-5',
        title: 'Dog Walking & Pet Feeding',
        category: 'pets',
        window: 'Morning 7:00–8:30 AM · Evening 5:30–7:00 PM',
        detail: 'Fenced backyard for supervised pet visits; experienced with senior dogs.',
        status: 'Available',
      },
      {
        id: 'cov-6',
        title: 'Garden Care & Seedling Share',
        category: 'gardening',
        window: 'Tuesday & Saturday mornings',
        detail: 'Organic pest control advice, seedling distribution, rain barrel access.',
        status: 'Available',
      },
    ],
    resources: [
      {
        id: 'res-5',
        name: 'Heavy-Duty Folding Utility Cargo Wagon',
        category: 'transport',
        condition: 'Good',
        location: 'Side garden gate',
        available: true,
        sharedBy: 'Marcus Vance',
      },
      {
        id: 'res-6',
        name: 'Fiskars Telescoping Pole Tree Pruner (14ft)',
        category: 'gardening',
        condition: 'Sharp / Clean',
        location: 'Backyard lean-to shed',
        available: true,
        sharedBy: 'Marcus Vance',
      },
    ],
  },
  {
    id: 4,
    name: 'Lot 4 · Central Landmark Market',
    residentName: 'Elena Rostova',
    avatar: 'ER',
    archetype: 'North 3-Story Central Anchor Market with Brick Chimney',
    description: 'Neighborhood market proprietor, bread baker, bulk food distributor.',
    relation: 'Hub logistics lead · Community anchor · 8 yrs on Oakridge',
    position3D: { x: -9.2, y: 6.8, z: -9.2 },
    coverageItems: [
      {
        id: 'cov-7',
        title: 'Emergency Cold Storage & Ice Rations',
        category: 'food',
        window: 'During store hours + after-hours doorbell',
        detail: 'Commercial freezer space available for medicine or perishables during outages.',
        status: 'Active',
      },
      {
        id: 'cov-8',
        title: 'Neighborhood Lost-and-Found Depot',
        category: 'community',
        window: '9:00 AM – 7:00 PM',
        detail: 'Main drop point for lost keys, pet collars, and parcels.',
        status: 'Open',
      },
    ],
    resources: [
      {
        id: 'res-7',
        name: 'Magliner Commercial Cargo Hand Truck (500 lb)',
        category: 'transport',
        condition: 'Heavy-Duty',
        location: 'Rear loading dock bay',
        available: true,
        sharedBy: 'Elena Rostova',
      },
      {
        id: 'res-8',
        name: 'Flotec Submersible Sump Pump with 25ft Hose',
        category: 'emergency',
        condition: 'Tested last week',
        location: 'Basement utility closet',
        available: true,
        sharedBy: 'Elena Rostova',
      },
    ],
  },
  {
    id: 5,
    name: 'Lot 5 · East Gable Residence',
    residentName: 'Mrs. Martha Gable',
    avatar: 'MG',
    archetype: 'East 3-Story Corner House with Exhaust Duct & Flower Boxes',
    description: 'Longest standing resident on Oakridge Circle (42 years). Avid knitter and archivist.',
    relation: 'Elder resident · Neighbor on North-East block · Daily wellness check enrolled',
    position3D: { x: 9.0, y: 5.2, z: -9.0 },
    coverageItems: [
      {
        id: 'cov-9',
        title: 'Morning Wellness & Conversation Check',
        category: 'wellness',
        window: 'Daily 9:00 AM – 10:00 AM',
        detail: 'Welcomes neighbor check-ins; has spare front porch keys with Lot 2 & Lot 1.',
        status: 'Active daily',
      },
    ],
    resources: [
      {
        id: 'res-9',
        name: 'Drive Medical Lightweight Folding Wheelchair',
        category: 'mobility',
        condition: 'Pristine',
        location: 'Ground floor vestibule',
        available: true,
        sharedBy: 'Mrs. Martha Gable',
      },
    ],
  },
  {
    id: 6,
    name: 'Lot 6 · Rooftop Garden House',
    residentName: 'Samira & Tariq Chen',
    avatar: 'TC',
    archetype: 'East 2-Story Rooftop Planter Garden with Penthouse Deck',
    description: 'Renewable energy engineers, urban horticulturists, drone hobbyists.',
    relation: 'Solar backup host · Garden committee · 4 yrs on Oakridge',
    position3D: { x: 14.4, y: 4.2, z: -12.8 },
    coverageItems: [
      {
        id: 'cov-10',
        title: 'Solar Microgrid Backup Charging',
        category: 'energy',
        window: 'Daylight hours + 2.4kWh battery reserve',
        detail: 'Emergency phone and battery charging station powered by rooftop panels.',
        status: 'Available',
      },
      {
        id: 'cov-11',
        title: 'Seed & Tool Library Access',
        category: 'gardening',
        window: 'Saturdays 10:00 AM – 2:00 PM',
        detail: 'Hand trowels, soil tester, pruning shears, heirloom tomato seeds.',
        status: 'Available',
      },
    ],
    resources: [
      {
        id: 'res-10',
        name: 'EcoFlow Delta 2 Solar Generator (1024Wh)',
        category: 'energy',
        condition: '100% Charged',
        location: 'Rooftop workshop entry',
        available: true,
        sharedBy: 'Tariq Chen',
      },
      {
        id: 'res-11',
        name: '4K Aerial Inspection Drone (For Roof/Tree Checks)',
        category: 'inspection',
        condition: 'Ready for flight',
        location: 'Penthouse office cabinet',
        available: true,
        sharedBy: 'Samira Chen',
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// 2. ACTIVE NEIGHBORHOOD ISSUES (Spatial, non-ticket based)
// -----------------------------------------------------------------------------
export const NEIGHBORHOOD_ISSUES = [
  {
    id: 'iss-1',
    lotId: 6,
    title: 'North Sidewalk Streetlamp #3 Flickering',
    category: 'infrastructure',
    severity: 'low',
    locationDesc: 'Directly in front of Lot 6 North garden curb',
    reportedBy: 'Samira Chen (Lot 6)',
    timeAgo: 'Reported yesterday',
    status: 'Parts Ordered',
    detail: 'Photocell sensor is intermittent after twilight. Replacement LED bulb ready for weekend swap.',
    position3D: { x: 8.0, y: 3.5, z: -5.3 },
    action: 'Offer Ladder / Help Swap',
  },
  {
    id: 'iss-2',
    lotId: 3,
    title: 'Loose Paving Stone Near West Crosswalk',
    category: 'safety',
    severity: 'medium',
    locationDesc: 'Pedestrian curb ramp between Lot 2 and Lot 3',
    reportedBy: 'Dr. Aris Thorne (Lot 2)',
    timeAgo: 'Reported 3 hours ago',
    status: 'Temporary Cone Placed',
    detail: 'Curbstone wobbles underfoot; trip hazard for evening strollers and wheelchair access.',
    position3D: { x: -6.0, y: 0.6, z: 5.5 },
    action: 'Help Reset Stone & Sand',
  },
  {
    id: 'iss-3',
    lotId: 5,
    title: 'Overhanging elm branch',
    category: 'gardening',
    severity: 'low',
    locationDesc: 'Front pathway access between Lot 5 entry ramp & sidewalk',
    reportedBy: 'Martha Gable (Lot 5)',
    timeAgo: 'Reported this morning',
    status: 'Needs attention',
    detail: 'Branch dipped below 2.0m clearance. Pruning coordination requested.',
    position3D: { x: 7.8, y: 2.2, z: -8.0 },
    action: 'Help Trim Branch',
  },
];

// -----------------------------------------------------------------------------
// 3. MY COORDINATION (Compact, non-intrusive)
// -----------------------------------------------------------------------------
export const MY_COORDINATION = [
  {
    id: 'coord-1',
    type: 'giving',
    title: 'Watering Ferns for Dr. Thorne',
    counterpart: 'Dr. Aris Thorne',
    lotName: 'Lot 2',
    time: 'Today · 6:00 PM',
    dueTime: 'Today · 6:00 PM',
    status: 'upcoming',
    badge: 'Coverage',
    actionText: 'Mark Done',
  },
  {
    id: 'coord-2',
    type: 'receiving',
    title: 'Borrowing Pole Pruner from Marcus',
    resourceName: 'Fiskars Telescoping Pole Tree Pruner (14ft)',
    counterpart: 'Marcus Vance',
    lotName: 'Lot 3',
    time: 'Tomorrow · 10:00 AM',
    dueTime: 'Tomorrow · 10:00 AM',
    status: 'confirmed',
    badge: 'Resource',
    actionText: 'View Details',
  },
];

// -----------------------------------------------------------------------------
// 3B. NEIGHBORHOOD QUERIES (Shared practical need coordination, NOT polls)
// -----------------------------------------------------------------------------
export const NEIGHBORHOOD_QUERIES = [
  {
    id: 'query-1',
    neighborhoodId: '00000000-0000-0000-0000-000000000001',
    creatorId: 'usr-dev-01',
    title: 'AC servicing',
    description: 'Several homes in Greenwood Commons are interested in AC servicing this week.',
    category: 'home_service',
    preferredTiming: 'This week',
    interestedCount: 3,
    currentUserIncluded: false,
    status: 'open', // 'open' | 'coordinating' | 'completed'
    createdAt: 'Today · 12 min ago',
    updatedAt: '12 min ago',
  },
];

// -----------------------------------------------------------------------------
// 4. NEIGHBORHOOD PULSE (Operational activity summary, NOT a social feed)
// -----------------------------------------------------------------------------
export const NEIGHBORHOOD_PULSE = [
  {
    id: 'pulse-iss-elm',
    type: 'issue',
    title: 'Overhanging elm branch',
    subtitle: 'Lot 5 · Needs attention',
    time: 'Needs attention',
    status: 'attention',
    issueId: 'iss-3',
    relatedId: 'iss-3',
    lotId: 5,
    actionLabel: 'View issue →',
    text: 'Overhanging elm branch at Lot 5 requires attention.',
  },
  {
    id: 'pulse-query-ac',
    type: 'query',
    title: 'AC servicing',
    subtitle: '3 homes interested · Query active',
    time: 'Query active',
    status: 'active',
    queryId: 'query-1',
    relatedId: 'query-1',
    actionLabel: 'Coordinate service →',
    text: 'AC servicing: 3 homes interested in joint service call this week.',
  },
  {
    id: 'pulse-cov-pkg',
    type: 'coverage',
    title: 'Package receiving',
    subtitle: '2 neighbors currently covering · Today',
    time: 'Today',
    status: 'active',
    coverageId: 'cov-1',
    relatedId: 'cov-1',
    lotId: 1,
    actionLabel: 'View coverage →',
    text: 'Package receiving coverage active today across 2 neighbor hubs.',
  },
  {
    id: 'pulse-res-mower',
    type: 'resource',
    title: 'Heavy Duty Lawn Mower',
    subtitle: 'Borrowed by Lot 4 · Due tomorrow 10:00 AM',
    time: 'Due tomorrow',
    status: 'borrowed',
    resourceId: 'res-5',
    relatedId: 'res-5',
    lotId: 3,
    actionLabel: 'View resource →',
    text: 'Heavy Duty Lawn Mower borrowed by Lot 4 · Due tomorrow 10:00 AM.',
  },
  {
    id: 'pulse-coord-pickup',
    type: 'coordination',
    title: 'Package pickup',
    subtitle: 'Completed · Lot 2 → Lot 4',
    time: 'Completed',
    status: 'completed',
    relatedId: 'coord-1',
    lotId: 2,
    actionLabel: 'View coordination →',
    text: 'Package pickup completed between Lot 2 and Lot 4.',
  },
  {
    id: 'pulse-cov-plants',
    type: 'coverage',
    title: 'Plant watering',
    subtitle: 'Coverage active · Through Friday',
    time: 'Through Friday',
    status: 'active',
    coverageId: 'cov-4',
    relatedId: 'cov-4',
    lotId: 2,
    actionLabel: 'View coverage →',
    text: 'Plant watering coverage active through Friday for Dr. Thorne.',
  },
];

// -----------------------------------------------------------------------------
// 5. EMERGENCY SCENARIO DATA (For Operational State: ALERT → RESPOND → COORDINATE → RESOLVE)
// -----------------------------------------------------------------------------
export const EMERGENCY_INCIDENT = {
  id: 'inc-2026-09-01',
  title: 'LOCAL GRID SURGE & BRANCH IMPACT — NORTH-EAST BLOCK',
  severity: 'HIGH PRIORITY',
  status: 'COORDINATING RESPONSE',
  timestamp: '17:34 (42m ago)',
  affectedLocation: 'Oakridge Circle East (Lot 5 & Lot 6)',
  impactSummary: 'Localized transformer trip severed mains power to 4 homes; high wind dropped dry oak limb across Lot 5 access path.',
  affectedPeople: [
    {
      name: 'Mrs. Martha Gable',
      lot: 'Lot 5',
      need: 'Critical home oxygen concentrator running on internal reserve battery (~90m remaining).',
      urgency: 'Immediate',
      status: 'Responder Dispatched',
    },
  ],
  responders: [
    {
      id: 'resp-1',
      name: 'Dr. Aris Thorne',
      role: 'Medical Lead',
      lotId: 2,
      action: 'Carrying medical battery inverter & vital monitor to Lot 5',
      eta: 'En route · Arriving now',
      position3D: { x: 4.5, y: 1.5, z: -4.0 },
    },
    {
      id: 'resp-2',
      name: 'Marcus Vance',
      role: 'Access & Clearance',
      lotId: 3,
      action: 'Chainsaw & hand truck deployed to clear oak limb blocking Lot 5 ramp',
      eta: 'On site at Lot 5 entry',
      position3D: { x: 7.2, y: 1.2, z: -7.5 },
    },
  ],
  emergencyResources: [
    {
      id: 'em-res-1',
      name: 'EcoFlow 1024Wh Solar Battery',
      owner: 'Samira Chen (Lot 6)',
      status: 'Connected to Mrs. Gable unit',
      location: 'Lot 5 Living Room',
      position3D: { x: 10.5, y: 1.8, z: -8.0 },
    },
    {
      id: 'em-res-2',
      name: 'First Aid & Burn Station',
      owner: 'Dr. Thorne (Lot 2)',
      status: 'Staged at Lot 1 Cafe',
      location: 'South Patio Base',
      position3D: { x: 10.0, y: 1.2, z: 9.0 },
    },
  ],
  warnings: [
    {
      id: 'warn-1',
      title: 'Low Hanging Service Wire',
      location: 'Between Lot 5 roof eave & streetlamp #4',
      position3D: { x: 8.5, y: 3.2, z: -7.0 },
      severity: 'Do Not Touch · Utility Notified',
    },
  ],
  timeline: [
    { time: '17:34', text: 'Power trip detected on East feeder; Martha Gable concentrator alert logged.' },
    { time: '17:37', text: 'Dr. Thorne acknowledged medical priority. Samira Chen dispatched solar pack.' },
    { time: '17:41', text: 'Backup battery arrived at Lot 5; concentrator sustained.' },
    { time: '17:48', text: 'Marcus began branch sectioning along front walkway.' },
  ],
};
