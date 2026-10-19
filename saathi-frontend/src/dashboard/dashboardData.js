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
      { id: 'res-1', name: 'Heavy-Duty 8ft Aluminum Step Ladder', category: 'tools', condition: 'Excellent', available: true },
      { id: 'res-2', name: 'Heavy-Duty Outdoor Extension Cord (50ft)', category: 'electrical', condition: 'Good', available: true },
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
      { id: 'res-3', name: 'DeWalt 20V Cordless Drill & Bit Set', category: 'tools', condition: 'Like New', available: true },
      { id: 'res-4', name: 'Philips HeartStart Home AED', category: 'medical', condition: 'Certified / Inspected', available: true },
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
      { id: 'res-5', name: 'Heavy-Duty Folding Utility Cargo Wagon', category: 'transport', condition: 'Good', available: true },
      { id: 'res-6', name: 'Fiskars Telescoping Pole Tree Pruner (14ft)', category: 'gardening', condition: 'Sharp / Clean', available: true },
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
        title: 'Neighborhood Lost-and-Found Point',
        category: 'community',
        window: '9:00 AM – 7:00 PM',
        detail: 'Main drop point for lost keys, pet collars, and parcels.',
        status: 'Open',
      },
    ],
    resources: [
      { id: 'res-7', name: 'Magliner Commercial Cargo Hand Truck (500 lb)', category: 'transport', condition: 'Heavy-Duty', available: true },
      { id: 'res-8', name: 'Flotec Submersible Sump Pump with 25ft Hose', category: 'emergency', condition: 'Tested last week', available: true },
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
      { id: 'res-9', name: 'Drive Medical Lightweight Folding Wheelchair', category: 'mobility', condition: 'Pristine', available: true },
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
      { id: 'res-10', name: 'EcoFlow Delta 2 Solar Generator (1024Wh)', category: 'energy', condition: '100% Charged', available: true },
      { id: 'res-11', name: '4K Aerial Inspection Drone (For Roof/Tree Checks)', category: 'inspection', condition: 'Ready for flight', available: true },
    ],
  },
];

// -----------------------------------------------------------------------------
// 1B. SHARED RESOURCES (Standalone community resources - decoupled from lots)
// Rule: DISCOVER THE RESOURCE, NOT THE PERSON.
// -----------------------------------------------------------------------------
export const SHARED_RESOURCES = [
  {
    id: 'res-1',
    name: 'Heavy-Duty 8ft Aluminum Step Ladder',
    category: 'tools',
    condition: 'Excellent',
    generalArea: 'Greenwood Commons · South Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-dev-01', name: 'Dev Sharma', lotId: 1 },
  },
  {
    id: 'res-2',
    name: 'Heavy-Duty Outdoor Extension Cord (50ft)',
    category: 'electrical',
    condition: 'Good',
    generalArea: 'Greenwood Commons · South Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-kavita-01', name: 'Kavita Sharma', lotId: 1 },
  },
  {
    id: 'res-3',
    name: 'DeWalt 20V Cordless Drill & Bit Set',
    category: 'tools',
    condition: 'Like New',
    generalArea: 'Greenwood Commons · West Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-aris-02', name: 'Dr. Aris Thorne', lotId: 2 },
  },
  {
    id: 'res-4',
    name: 'Philips HeartStart Home AED',
    category: 'medical',
    condition: 'Certified / Inspected',
    generalArea: 'Greenwood Commons · West Quadrant',
    handoffPolicy: 'Community pickup / Emergency Standby',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-aris-02', name: 'Dr. Aris Thorne', lotId: 2 },
  },
  {
    id: 'res-5',
    name: 'Heavy-Duty Folding Utility Cargo Wagon',
    category: 'transport',
    condition: 'Good',
    generalArea: 'Greenwood Commons · West Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-marcus-03', name: 'Marcus Vance', lotId: 3 },
  },
  {
    id: 'res-6',
    name: 'Fiskars Telescoping Pole Tree Pruner (14ft)',
    category: 'gardening',
    condition: 'Sharp / Clean',
    generalArea: 'Greenwood Commons · West Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: false, // in use by Sarah Chen
    _owner: { id: 'usr-marcus-03', name: 'Marcus Vance', lotId: 3 },
  },
  {
    id: 'res-7',
    name: 'Magliner Commercial Cargo Hand Truck (500 lb)',
    category: 'transport',
    condition: 'Heavy-Duty',
    generalArea: 'Greenwood Commons · North Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-sarah-04', name: 'Sarah Chen', lotId: 4 },
  },
  {
    id: 'res-8',
    name: 'Flotec Submersible Sump Pump with 25ft Hose',
    category: 'emergency',
    condition: 'Tested last week',
    generalArea: 'Greenwood Commons · North Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-sarah-04', name: 'Sarah Chen', lotId: 4 },
  },
  {
    id: 'res-9',
    name: 'Drive Medical Lightweight Folding Wheelchair',
    category: 'mobility',
    condition: 'Pristine',
    generalArea: 'Greenwood Commons · East Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-martha-05', name: 'Mrs. Martha Gable', lotId: 5 },
  },
  {
    id: 'res-10',
    name: 'EcoFlow Delta 2 Solar Generator (1024Wh)',
    category: 'energy',
    condition: '100% Charged',
    generalArea: 'Greenwood Commons · East Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-tariq-06', name: 'Tariq Chen', lotId: 6 },
  },
  {
    id: 'res-11',
    name: '4K Aerial Inspection Drone (For Roof/Tree Checks)',
    category: 'inspection',
    condition: 'Ready for flight',
    generalArea: 'Greenwood Commons · East Quadrant',
    handoffPolicy: 'Community pickup at Cafe Courtyard',
    allowedRequesters: 'Verified neighborhood members',
    requiresApproval: true,
    available: true,
    _owner: { id: 'usr-samira-06', name: 'Samira Chen', lotId: 6 },
  },
];

// -----------------------------------------------------------------------------
// 1C. BORROW REQUESTS (Awaiting owner approval or active in lifecycle)
// -----------------------------------------------------------------------------
export const BORROW_REQUESTS = [
  {
    id: 'req-incoming-1',
    resourceId: 'res-7',
    resourceName: 'Magliner Commercial Cargo Hand Truck (500 lb)',
    ownerId: 'usr-sarah-04',
    requesterId: 'usr-aris-02',
    requesterName: 'Dr. Aris Thorne',
    purpose: 'Moving medical care storage boxes to clinic corner',
    requestedTime: 'Today · 6:00 PM',
    duration: '~1 hour',
    handoffPreference: 'Community pickup at Cafe Courtyard',
    message: 'Can bring it right back by 7:15 PM.',
    status: 'REQUESTED', // 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'BLOCKED' | 'CANCELLED'
    createdAt: 'Today · 45m ago',
    requesterTrust: {
      verified: true,
      membershipAge: '14 months',
      completedCoordinations: 9,
      noOutstandingReturns: true,
    },
  },
  {
    id: 'req-outgoing-1',
    resourceId: 'res-3',
    resourceName: 'DeWalt 20V Cordless Drill & Bit Set',
    ownerId: 'usr-aris-02',
    requesterId: 'usr-sarah-04',
    requesterName: 'Sarah Chen',
    purpose: 'Mounting a small herb wall rack in kitchen',
    requestedTime: 'Tomorrow · 2:00 PM',
    duration: '~2 hours',
    handoffPreference: 'Community pickup at Cafe Courtyard',
    message: 'Happy to pick up at the cafe courtyard.',
    status: 'REQUESTED',
    createdAt: 'Today · 20m ago',
    requesterTrust: {
      verified: true,
      membershipAge: '8 months',
      completedCoordinations: 6,
      noOutstandingReturns: true,
    },
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
// 3. COORDINATION RECORDS (Canonical state machine implementation)
// States: REQUESTED -> APPROVED -> SCHEDULED -> HANDOFF_READY -> HANDED_OVER -> IN_USE -> RETURN_DUE -> RETURN_PENDING -> COMPLETED
// -----------------------------------------------------------------------------
export const COORDINATION_RECORDS = [
  {
    id: 'coord-2',
    requestId: 'req-fiskars-0',
    resourceId: 'res-6',
    resourceName: 'Fiskars Telescoping Pole Tree Pruner (14ft)',
    title: 'Borrowing Pole Pruner',
    role: 'borrowing', // 'borrowing' | 'lending' | 'helping'
    counterpartRole: 'Owner',
    counterpartDisplay: 'Marcus (Verified Neighbor)',
    ownerId: 'usr-marcus-03',
    requesterId: 'usr-sarah-04',
    state: 'IN_USE',
    status: 'in_use', // backward compatibility
    purpose: 'Trimming dried oak branches near garden walkway',
    handoffLocation: 'Cafe Courtyard',
    scheduledTime: 'Yesterday · 4:00 PM',
    dueTime: 'Tomorrow · 10:00 AM',
    time: 'Tomorrow · 10:00 AM',
    borrowerReturnInitiated: false,
    ownerReturnConfirmed: false,
    type: 'receiving',
    badge: 'Resource',
    actionText: 'View Details',
  },
  {
    id: 'coord-1',
    requestId: 'req-plants-0',
    resourceId: null,
    resourceName: 'Indoor Ferns & Plant Care',
    title: 'Watering Ferns for Dr. Thorne',
    role: 'helping',
    counterpartRole: 'Neighbor',
    counterpartDisplay: 'Dr. Thorne (Verified Neighbor)',
    ownerId: 'usr-aris-02',
    requesterId: 'usr-sarah-04',
    state: 'SCHEDULED',
    status: 'upcoming',
    purpose: 'Plant watering coverage during medical symposium',
    handoffLocation: 'Agreed arrangement',
    scheduledTime: 'Today · 6:00 PM',
    dueTime: 'Today · 6:00 PM',
    time: 'Today · 6:00 PM',
    borrowerReturnInitiated: false,
    ownerReturnConfirmed: false,
    type: 'giving',
    badge: 'Coverage',
    actionText: 'Mark Done',
  },
  {
    id: 'coord-completed-1',
    requestId: 'req-ladder-past',
    resourceId: 'res-1',
    resourceName: 'Heavy-Duty 8ft Aluminum Step Ladder',
    title: 'Borrowed Step Ladder',
    role: 'borrowing',
    counterpartRole: 'Neighbor',
    counterpartDisplay: 'Verified Neighbor',
    ownerId: 'usr-dev-01',
    requesterId: 'usr-sarah-04',
    state: 'COMPLETED',
    status: 'completed',
    purpose: 'Window cleaning',
    handoffLocation: 'Cafe Courtyard',
    scheduledTime: 'Oct 2 · 11:00 AM',
    dueTime: 'Oct 2 · 2:30 PM',
    time: 'Oct 2 · 2:30 PM',
    completedAt: 'Oct 2 · 2:30 PM',
    type: 'receiving',
    badge: 'Resource',
    actionText: 'View History',
  },
];

export const COORDINATION_EVENTS = [
  {
    id: 'ev-1',
    type: 'COORDINATION_CREATED',
    coordinationId: 'coord-2',
    timestamp: 'Yesterday · 4:00 PM',
    summary: 'Fiskars pole pruner handoff completed at Cafe Courtyard',
  },
];

export const BLOCKED_USERS = [];

export const SAFETY_REPORTS = [];

export const COORDINATION_MESSAGES = [
  {
    id: 'msg-1',
    coordinationId: 'coord-2',
    senderId: 'usr-marcus-03',
    senderName: 'Marcus',
    text: 'Pole is placed at the cafe courtyard hook. Pruner blade is freshly oiled.',
    timestamp: 'Yesterday · 3:55 PM',
  },
];

// Compatibility export
export const MY_COORDINATION = COORDINATION_RECORDS.filter(
  (c) => c.state !== 'COMPLETED' && c.status !== 'completed'
).map((c) => ({
  ...c,
  status: c.id === 'coord-2' ? 'confirmed' : c.status,
  counterpart: c.ownerId === 'usr-aris-02' ? 'Dr. Aris Thorne' : c.ownerId === 'usr-marcus-03' ? 'Marcus Vance' : (c.counterpart || ''),
  lotId: c.lotId || (c.ownerId === 'usr-aris-02' ? 2 : c.ownerId === 'usr-marcus-03' ? 3 : 1),
  lotName: c.lotName || (c.ownerId === 'usr-aris-02' ? 'Lot 2' : c.ownerId === 'usr-marcus-03' ? 'Lot 3' : 'Lot 1'),
}));

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
