/**
 * SAATHI Frontend Demo Configuration
 *
 * Enforces explicit demo isolation for frontend conveniences and fictional portfolio data.
 * Disabled by default in both development and production.
 *
 * Configured via:
 *   VITE_DEMO_MODE=true
 */

/**
 * Check if demo mode is explicitly enabled.
 * Returns false by default if unset, empty, or not strictly 'true'.
 */
export function isDemoMode() {
  const envVal =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEMO_MODE) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_DEMO_MODE);

  return typeof envVal === 'string' && envVal.trim().toLowerCase() === 'true';
}

/**
 * Fictional portfolio personas for demo prefill.
 * Accessible ONLY when isDemoMode() is true.
 */
export const DEMO_PERSONAS = [
  {
    id: 1,
    name: 'Alice Xu',
    email: 'alice.demo@saathi.local',
    lotDisplay: 'Lot 1 (Resident)',
    role: 'resident',
    avatar: 'AX',
  },
  {
    id: 2,
    name: 'Bob Yang',
    email: 'bob.demo@saathi.local',
    lotDisplay: 'Lot 2 (Resident)',
    role: 'resident',
    avatar: 'BY',
  },
  {
    id: 4,
    name: 'Sarah Chen',
    email: 'sarah.demo@saathi.local',
    lotDisplay: 'Lot 4 (Resident)',
    role: 'resident',
    avatar: 'SC',
  },
  {
    id: 99,
    name: 'Kavita Sharma',
    email: 'coordinator@saathi.local',
    lotDisplay: 'Pilot Coordinator',
    role: 'coordinator',
    avatar: 'KS',
  },
];

/**
 * Fictional password used by the dedicated saathi_demo database.
 *
 * PUBLIC PORTFOLIO DEMO CREDENTIAL BOUNDARY:
 * 1. Intended Experience: Required for seamless portfolio evaluation so reviewers can click
 *    a demo persona and authenticate without manually guessing or typing credentials.
 * 2. Public Visibility: Client-exposed code is completely public; this string is NOT a secret.
 * 3. Server-Authoritative: The frontend never bypasses authentication or creates fake tokens;
 *    it sends standard POST /auth/login credentials to the backend.
 * 4. Strict Database Isolation: These fictional accounts (*.demo@saathi.local) and this password
 *    MUST exist ONLY within the isolated 'saathi_demo' database populated by scripts/seed_demo.js.
 *    They MUST NEVER be seeded, accepted, or allowed in any real-user production environment ('saathi').
 */
export const DEFAULT_DEMO_PASSWORD = 'DemoSecret123!';
