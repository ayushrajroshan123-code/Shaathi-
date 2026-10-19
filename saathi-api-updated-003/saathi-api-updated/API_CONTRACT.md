# SAATHI — Canonical Domain Model & API Contract
**Status:** Canonical Reference for Phase 2 Implementation (Frozen Product Specification)  
**Governing Standard:** SAATHI Phase 1 Approved Coordination UX & Privacy Model  
**Target Repository:** `saathi-api-updated`

---

## 1. Purpose & Process Rule

### 1.1 Purpose
This document is the canonical, binding contract for the SAATHI backend domain model, lifecycle state machines, authorization rules, privacy representation layers, and HTTP API endpoints. It aligns the existing backend with the approved, frozen **SAATHI Phase 1** product and coordination architecture.

### 1.2 Canonical Process Rule (Inherited from `schema.sql`)
> Every newly accepted architectural decision must appear in a canonical checked-in artifact before implementation proceeds.

This document is the authoritative specification for all backend behaviors that PostgreSQL constraints alone cannot enforce. Implementation phases (Phase 2C database migrations, Phase 2D/2E service and route implementation, Phase 2F test suites, and Phase 2G frontend integration) must strictly implement the contracts defined herein. Historical pilot decisions (Decisions 1 through 8.1) are preserved in Section 27 (Historical Decisions Archive) with explicit notes where Phase 2 decisions supersede them.

---

## 2. Canonical Product Principles

### 2.1 The Nature of SAATHI
SAATHI is:
> **A neighborhood coordination operating system.**  
> *"Everyday care meets real coordination."*

SAATHI is **NOT**:
* A social network (no social feeds, likes, followers, or status posts)
* A marketplace (no rentals, pricing, fees, deposits, or commercial transactions)
* A public resident directory (no unsolicited lists of neighbors, addresses, or phone numbers)
* A reputation platform (no public star ratings, scores, leaderboards, or suspicion badges)
* A social graph (no public connection webs or social popularity metrics)
* A gamified system (no XP, streaks, levels, or achievement points)

### 2.2 Core Operational Flow
Every interaction on SAATHI follows a disciplined, four-stage loop:
```text
ASK  ──►  FIND  ──►  COORDINATE  ──►  COMPLETE
```
1. **ASK:** A resident publishes an operational need (tool borrow, assistance coverage, neighborhood issue, or shared query).
2. **FIND:** The system matches the need against available community resources or volunteers.
3. **COORDINATE:** Two verified members schedule, hand off, and confirm custody through a safe, mutually agreed handoff arrangement (e.g., at a community coordination point such as the Community Exchange or another appropriate neutral public location).
4. **COMPLETE:** Physical custody is safely returned or task assistance is finished, updating factual audit records.

---

## 3. Canonical Terminology Alignment

To eliminate ambiguity across frontend components, backend services, and database tables, all Phase 2 implementations must use the following canonical vocabulary:

| Legacy Backend Term | Phase 1 Frontend Term | Phase 2 Canonical Term | Canonical Definition |
| :--- | :--- | :--- | :--- |
| `ACCEPTED` (Request) | `APPROVED` | **`APPROVED`** | The resource owner explicitly accepted an inbound borrow request. Legacy `ACCEPTED` is superseded. |
| Single-party `RETURNED` | Two-party return | **Two-Party Return** | Mutual confirmation: Borrower initiates (`RETURN_PENDING`), Owner confirms receipt (`COMPLETED`). |
| `resource_requests` (sole entity) | Request vs Coordination | **Resource Request** vs **Coordination** | A *Request* represents the request/approval decision; a *Coordination* is the operational commitment created upon approval. |
| *None* | Coordination History | **`Coordination Event`** | An immutable audit log entry recording operational state transitions after a Coordination exists. |
| *None* | Block Member | **`Blocked User Relationship`** | Mutual safety boundary preventing discovery, requests, and new messages. |
| `volunteer` | Neighbor / Counterpart | **`Counterpart` / `Assigned Helper`** | An operational participant role, NOT an account-level `users.role`. |
| `location` (on resource) | General Area / Quadrant | **`general_area`** | Public spatial zone (e.g., "West Quadrant"), strictly decoupled from residential lots. |
| Handoff method | Community Exchange / Handoff Policy | **`handoff_policy`** | Safe handoff policy or community coordination instructions (default: "Community pickup at Cafe Courtyard"). |

---

## 4. Authentication Contract

### 4.1 Credential & Session Model (Preserving Decision 7.1)
* **Identity:** Email address + password.
* **Password Security:** Salted `scrypt` hashing using Node's built-in `crypto` (16-byte cryptographically secure random salt, 64-byte derived key). Verification strictly uses `crypto.timingSafeEqual`.
* **Session Storage:** Opaque bearer tokens consisting of 32 cryptographically secure random bytes (`crypto.randomBytes(32)`).
* **Token Persistence:** Only the SHA-256 hash of the bearer token is stored in the `sessions` table (`token_hash`). The plaintext token is returned to the client exactly once upon successful login (`POST /auth/login`) and is never logged or stored.
* **Revocation:** Individual sessions can be immediately revoked (`POST /auth/logout`) or bulk-invalidated by setting `users.is_active = FALSE` or `users.account_status != 'active'`.

### 4.2 Account Provisioning Lifecycle
* **Self-Signup:** `POST /auth/signup` creates a user with `role = 'resident'` and `account_status = 'pending_approval'`.
* **Coordinator Approval:** Users in `pending_approval` cannot authenticate. A coordinator reviews the queue (`GET /users/pending`) and calls `PATCH /users/:userId/approve` or `PATCH /users/:userId/reject`.
* **Coordinator Direct Provisioning:** `POST /users` (coordinator only) creates accounts directly with `account_status = 'active'`.

### 4.3 Request Context Injection
Every authenticated request carries:
```http
Authorization: Bearer <token>
```
The authentication middleware (`loadActor`) validates the token and injects the canonical actor context into the request object:
```javascript
req.actor = {
  user_id: string,  // UUID of the authenticated resident
  role: string,     // 'resident' | 'verified_helper' | 'coordinator'
  hub_id: string    // UUID of the user's primary community hub
};
```

---

## 5. Authorization Model

Authorization in SAATHI is multi-layered and enforced independently of authentication.

```text
Authentication (Who are you?)
       ↓
Hub Isolation (Are you in this neighborhood?)
       ↓
Role RBAC (Are you a resident, helper, or coordinator?)
       ↓
Participant Authorization (Are you the owner, requester, or helper?)
       ↓
Blocker Check (Has either party blocked the other?)
       ↓
Operational Eligibility (Is your verification tier valid for this task?)
```

### 5.1 Distinct Concepts
1. **Authentication:** Proving caller identity via bearer session token.
2. **Authorization:** Determining if the authenticated caller has permission to view or mutate a specific resource or coordination.
3. **Verification:** A formal administrative record issued by a coordinator certifying identity or qualifications (`verification_records`).
4. **Eligibility:** An operational boolean check determining whether an actor's active verification tier meets the requirements for a specific task or resource.

### 5.2 Permission Boundaries
* **Public Discovery:** Any authenticated active member of the hub.
* **Request Creation:** Any authenticated active resident of the hub who is not blocked by the resource owner.
* **Request Decision (Approve/Decline):** Strictly the resource owner.
* **Return Initiation:** Strictly the borrower currently in custody of the resource.
* **Return Confirmation:** Strictly the resource owner upon verifying physical receipt.
* **Coordination Inspection:** Strictly the coordination participants (borrower and owner/helper) or an authorized coordinator.
* **Safety / Conduct Reports:** Any member may file; read access is strictly restricted to coordinators.
* **Cross-Hub Operations:** Strictly forbidden. A user cannot view or mutate records belonging to a different `hub_id`.

---

## 6. Hub Isolation Contract

SAATHI operates on strict **community hub boundaries**. A hub represents a physical neighborhood, apartment complex, or RWA:

1. **Scope Enforcement:** Every core entity (`User`, `Resource`, `Resource Request`, `Coordination`, `Coverage Request`, `Neighborhood Issue`, `Neighborhood Query`) belongs to a specific `hub_id`.
2. **Query Scoping:** All list and search queries must be filtered by the caller's authorized `req.actor.hub_id`.
3. **Cross-Hub Enumeration Defense:** Attempting to read an entity from another hub by UUID must return `404 NOT_FOUND` (identical to a nonexistent entity) to prevent cross-hub UUID probing and membership enumeration.

---

## 7. Canonical Privacy Model & Invariants

### 7.1 Foundational Rule
> **Public discovery is resource-first, not owner-first.**

A resident discovers that a resource exists in the neighborhood. They do **NOT** discover who owns it, where they live, or where it is stored.

```text
ALLOWED PUBLIC FACT:
"There is a 20V Cordless Drill available in the West Quadrant for pickup at Cafe Courtyard."

STRICTLY FORBIDDEN PUBLIC LEAKS:
- "Marcus Vance owns this drill."
- "The drill is stored in Lot 3."
- "Marcus's phone number is +1-555-..."
- "Marcus has 3 other tools stored at his house."
```

### 7.2 Non-Negotiable Privacy Invariants
1. **No Public Owner Exposure:** Public resource discovery endpoints must never return `owner_id`, `owner_name`, `owner_avatar`, or `owner_phone`.
2. **No Residential Storage Mapping:** Public endpoints must never return exact lot numbers, unit numbers, house addresses, or private storage locations.
3. **No 3D Ownership Coupling:** The 3D neighborhood diorama is an ambient spatial experience. Clicking or hovering a residential lot must never reveal tool counts, shared resources, or resource lists associated with that home.
4. **Safe Handoff & Community Exchange:** Community handoff is preferred through a safe, mutually agreed handoff arrangement (such as a Community Exchange coordination point or another appropriate neutral public location). The Community Exchange represents an optional public coordination point, NOT a warehouse, permanent storage facility, mandatory depot, or place where all resources physically reside.
5. **No Public Member Directories:** There is no endpoint that lists all residents of a neighborhood.
6. **No Social Graphs:** There is no endpoint returning friend lists, follower counts, or mutual connection graphs.
7. **No Gamified Scores or Ratings:** No endpoint may calculate, store, or return user ratings, star reviews, reputation percentages, danger levels, or risk scores.

---

## 8. Representation Layers (Serializers)

To guarantee that internal database fields never leak across privacy boundaries, the API enforces five distinct representation layers:

### Layer 1: Public Discovery View (`ResourcePublicSummary`)
Used for browsing available community tools (`GET /resources`):
```json
{
  "resource_id": "res-3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "DeWalt 20V Cordless Drill & Bit Set",
  "type": "tools",
  "condition": "Like New",
  "general_area": "Greenwood Commons · West Quadrant",
  "handoff_policy": "Community pickup at Cafe Courtyard",
  "available": true,
  "requires_approval": true
}
```
*Explicitly Excluded:* `owner_id`, `owner_name`, `location`, `created_at`, internal notes.

### Layer 2: Requester View (`ResourceRequestSummary`)
Returned to the borrower tracking their outgoing request (`GET /resources/requests/:id`):
```json
{
  "request_id": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "resource_id": "res-3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "resource_name": "DeWalt 20V Cordless Drill & Bit Set",
  "status": "REQUESTED",
  "requested_time": "Tomorrow · 2:00 PM",
  "duration": "~2 hours",
  "handoff_preference": "Community pickup at Cafe Courtyard",
  "purpose": "Mounting a small herb wall rack in kitchen",
  "counterpart_display": "Resource Owner (Verified Neighbor)"
}
```

### Layer 3: Owner Review View (`ResourceRequestOwnerDetail`)
Presented to the resource owner deciding whether to approve (`GET /resources/requests/inbound`):
```json
{
  "request_id": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "resource_id": "res-3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "resource_name": "DeWalt 20V Cordless Drill & Bit Set",
  "requester_id": "usr-4a2b9f11-...",
  "requester_name": "Sarah Chen",
  "purpose": "Mounting a small herb wall rack in kitchen",
  "requested_time": "Tomorrow · 2:00 PM",
  "duration": "~2 hours",
  "handoff_preference": "Community pickup at Cafe Courtyard",
  "message": "Happy to pick up at the cafe courtyard.",
  "status": "REQUESTED",
  "requester_trust": {
    "identity_verified": true,
    "neighborhood_verified": true,
    "membership_age": "8 months",
    "completed_coordinations": 6,
    "no_outstanding_returns": true,
    "eligible": true
  }
}
```
*Factual Trust Only:* Factual signals derived from database history. No scores, no ratings.

### Layer 4: Active Coordination View (`CoordinationDetail`)
Presented to participants during scheduled or active handoff:
```json
{
  "coordination_id": "coord-7c9e6679-...",
  "resource_name": "DeWalt 20V Cordless Drill & Bit Set",
  "role": "borrowing",
  "counterpart_role": "Owner",
  "counterpart_display": "Marcus (Verified Neighbor)",
  "state": "IN_USE",
  "purpose": "Mounting a small herb wall rack in kitchen",
  "handoff_location": "Cafe Courtyard (Community Exchange)",
  "scheduled_time": "Tomorrow · 2:00 PM",
  "due_time": "Tomorrow · 4:00 PM",
  "borrower_return_initiated": false,
  "owner_return_confirmed": false
}
```
*Operational Handoff Protection:* The Active Coordination representation contains the operational handoff information necessary for the participants to complete the coordination, but strictly excludes private residential/storage information (e.g., owner's home address, apartment/unit number, private storage location).

### Layer 5: Private Operational & Security View
Accessible only to coordinators for safety auditing (`GET /conduct-reports/:id`).

---

## 9. Canonical Domain Entities

### 9.1 User
Represents a neighborhood resident or coordinator.
* `user_id`: UUID (Primary Key)
* `hub_id`: UUID (Foreign Key $\rightarrow$ `hubs`)
* `name`: Text (Full resident name)
* `email`: Text (Unique, login identifier)
* `password_hash`: Text (`scrypt` salt + hash)
* `role`: Enum (`resident`, `verified_helper`, `coordinator`)
* `account_status`: Enum (`pending_approval`, `active`, `rejected`, `suspended`)
* `contact_preferences`: JSONB (Private notification preferences)
* `notification_endpoints`: JSONB (Private push/email endpoints)
* `is_active`: Boolean (Deactivation switch)
* `created_at`: Timestamptz

### 9.2 Resource
Represents a physical tool, medical device, or shared equipment item.
* `resource_id`: UUID (Primary Key)
* `owner_id`: UUID (Foreign Key $\rightarrow$ `users`, strictly internal)
* `hub_id`: UUID (Foreign Key $\rightarrow$ `hubs`)
* `name`: Text (e.g., "DeWalt 20V Cordless Drill & Bit Set")
* `type`: Enum (Canonical Taxonomy: `tools`, `electrical`, `medical`, `transport`, `gardening`, `emergency`, `mobility`, `energy`, `inspection`)
* `condition`: Text (e.g., "Like New", "Tested last week")
* `general_area`: Text (Public neighborhood quadrant, e.g., "West Quadrant")
* `handoff_policy`: Text (e.g., "Community pickup at Cafe Courtyard")
* `allowed_requesters`: Text (e.g., "Verified neighborhood members")
* `requires_approval`: Boolean (Default `TRUE`)
* `is_active`: Boolean (Listing status)
* `created_at`: Timestamptz

### 9.3 Resource Request
Represents an intent by a resident to borrow a resource.
* `request_id`: UUID (Primary Key)
* `resource_id`: UUID (Foreign Key $\rightarrow$ `resource_inventory`)
* `requester_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `purpose`: Text (Borrower's intended use)
* `duration`: Text (Expected usage duration)
* `time_window_start`: Timestamptz
* `time_window_end`: Timestamptz
* `handoff_preference`: Text (Preferred pickup point)
* `message`: Text (Optional note from borrower)
* `status`: Enum (`REQUESTED`, `APPROVED`, `DECLINED`, `BLOCKED`, `CANCELLED`, `EXPIRED`)
* `decline_reason`: Text (Optional note if declined)
* `created_at`: Timestamptz

### 9.4 Coordination (First-Class Entity)
Represents an active, mutual operational commitment between two residents. For the resource borrowing flow, it is created automatically upon owner approval of a Resource Request, beginning in the `APPROVED` state.
* `coordination_id`: UUID (Primary Key)
* `hub_id`: UUID (Foreign Key $\rightarrow$ `hubs`)
* `request_id`: UUID (Optional Foreign Key $\rightarrow$ `resource_requests`)
* `coverage_request_id`: UUID (Optional Foreign Key $\rightarrow$ `coverage_requests`)
* `resource_id`: UUID (Optional Foreign Key $\rightarrow$ `resource_inventory`)
* `requester_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `counterpart_id`: UUID (Foreign Key $\rightarrow$ `users`, owner or helper)
* `title`: Text (Descriptive coordination title)
* `type`: Enum (`resource`, `coverage`)
* `state`: Enum (`APPROVED`, `SCHEDULED`, `HANDOFF_READY`, `HANDED_OVER`, `IN_USE`, `RETURN_DUE`, `RETURN_PENDING`, `COMPLETED`, `BLOCKED`, `CANCELLED`, `EXPIRED`)
* `purpose`: Text
* `handoff_location`: Text (Agreed safe handoff arrangement / coordination point)
* `scheduled_time`: Timestamptz
* `due_time`: Timestamptz
* `borrower_return_initiated`: Boolean (Default `FALSE`)
* `owner_return_confirmed`: Boolean (Default `FALSE`)
* `created_at`: Timestamptz
* `completed_at`: Timestamptz

### 9.5 Coordination Event
An immutable audit log tracking operational microstate transitions occurring after a coordination exists.
* `event_id`: UUID (Primary Key)
* `coordination_id`: UUID (Foreign Key $\rightarrow$ `coordinations`)
* `event_type`: Enum (`COORDINATION_CREATED`, `SCHEDULED`, `HANDOFF_READY`, `HANDED_OVER`, `IN_USE`, `RETURN_DUE`, `RETURN_INITIATED`, `RETURN_CONFIRMED`, `COMPLETED`, `CANCELLED`, `MEMBER_BLOCKED`, `SAFETY_REPORT_CREATED`)
* `actor_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `summary`: Text (Human-readable event summary)
* `created_at`: Timestamptz

*Distinction Between Request History and Coordination Events:*
* **Resource Request History:** Tracks request-level lifecycle events and decisions prior to or resulting in coordination creation (`REQUEST_CREATED`, `REQUEST_APPROVED`, `REQUEST_DECLINED`, `REQUEST_BLOCKED`, `REQUEST_CANCELLED`, `REQUEST_EXPIRED`). These are recorded as request-level audit history and do not reference `coordination_id`.
* **Coordination Events:** Strictly track operational events after the `Coordination` entity exists (starting from its initial creation at `APPROVED` through scheduling, handoff, active use, two-party return, and completion). Pre-approval request activity is never recorded as a `Coordination Event`.

### 9.6 Coordination Message
Contextual coordination notes and inquiries.
* `message_id`: UUID (Primary Key)
* `coordination_id`: UUID (Foreign Key $\rightarrow$ `coordinations`)
* `sender_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `text`: Text (Message body)
* `message_type`: Enum (`pre_approval_inquiry`, `coordination_note`, `system_notice`)
* `created_at`: Timestamptz

### 9.7 Block (Blocked User Relationship)
Represents a mutual boundary between two residents.
* `blocker_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `blocked_user_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `created_at`: Timestamptz
* *Constraint:* Unique on `(blocker_id, blocked_user_id)`. Check `blocker_id != blocked_user_id`.

### 9.8 Conduct / Safety Report
A private, coordinator-reviewed report of a safety concern or dispute.
* `report_id`: UUID (Primary Key)
* `reported_by`: UUID (Foreign Key $\rightarrow$ `users`)
* `reported_against`: UUID (Foreign Key $\rightarrow$ `users`)
* `context_type`: Enum (`resource`, `coverage`, `general`)
* `context_id`: UUID (Reference to coordination or request)
* `category`: Text (e.g., `damaged_property`, `unreturned_item`, `harassment`, `safety_hazard`)
* `description`: Text
* `evidence`: JSONB (Attached notes/metadata)
* `status`: Enum (`reported`, `under_review`, `resolved`)
* `coordinator_id`: UUID (Foreign Key $\rightarrow$ `users`, assigned reviewer)
* `action_taken`: Enum (`no_action`, `warning`, `temporary_suspension`, `permanent_removal`)
* `repeat_pattern_flag`: Boolean (Automatically flagged if $\ge 3$ reports in 30 days)
* `created_at`: Timestamptz
* `resolved_at`: Timestamptz

### 9.9 Coverage Request (Reused from Pilot)
Task-based assistance that does not involve physical tool inventory (e.g., plant watering, package collection).
* `request_id`: UUID (Primary Key)
* `task_type`: Foreign Key $\rightarrow$ `task_taxonomy`
* `requested_by`: UUID (Foreign Key $\rightarrow$ `users`)
* `assigned_to`: UUID (Foreign Key $\rightarrow$ `users`, volunteer helper)
* `date`: Date
* `time_window_start`: Timestamptz
* `time_window_end`: Timestamptz
* `location`: Text
* `status`: Enum (`REQUESTED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`)
* `notes`: Text

### 9.10 Neighborhood Issue
Public infrastructure hazards or shared maintenance concerns.
* `issue_id`: UUID (Primary Key)
* `hub_id`: UUID (Foreign Key $\rightarrow$ `hubs`)
* `title`: Text (e.g., "North Sidewalk Streetlamp #3 Flickering")
* `category`: Enum (`infrastructure`, `safety`, `gardening`, `cleanliness`)
* `severity`: Enum (`low`, `medium`, `high`)
* `general_location`: Text (Public location description, e.g., "Near West Crosswalk")
* `reported_by`: UUID (Foreign Key $\rightarrow$ `users`)
* `status`: Enum (`reported`, `attention_needed`, `in_progress`, `parts_ordered`, `resolved`)
* `detail`: Text
* `position_3d`: JSONB (Optional 3D diorama coordinate `{x, y, z}` for public infrastructure display)
* `created_at`: Timestamptz

### 9.11 Neighborhood Query
Shared practical community demand to aggregate interest (NOT a poll, NOT a social thread).
* `query_id`: UUID (Primary Key)
* `hub_id`: UUID (Foreign Key $\rightarrow$ `hubs`)
* `creator_id`: UUID (Foreign Key $\rightarrow$ `users`)
* `title`: Text (e.g., "AC servicing")
* `description`: Text ("Several homes interested in joint service call this week")
* `category`: Text (`home_service`, `group_order`, `bulk_delivery`)
* `preferred_timing`: Text ("This week")
* `status`: Enum (`open`, `coordinating`, `completed`)
* `created_at`: Timestamptz

---

## 10. Lifecycle State Machines

### 10.1 Resource Request Lifecycle
```text
                  ┌───────────────────────────────┐
                  │           REQUESTED           │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┬──────────────────────┐
         ▼                        ▼                        ▼                      ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       ┌──────────────┐
  │   APPROVED   │         │   DECLINED   │         │   BLOCKED    │       │  CANCELLED   │
  └──────┬───────┘         └──────────────┘         └──────────────┘       └──────────────┘
         │ (spawns Coordination at APPROVED)
         ▼
     [Active]
```
* **REQUESTED:** Borrower submitted request. Awaiting owner review.
* **APPROVED:** Owner accepted. Automatically generates a corresponding resource `Coordination` record in `APPROVED` state.
* **DECLINED:** Owner declined. Request terminated cleanly.
* **BLOCKED:** Owner blocked borrower (or borrower blocked owner). Terminated.
* **CANCELLED:** Borrower retracted request prior to approval.
* **EXPIRED:** `time_window_end` elapsed without owner decision.

### 10.2 Coordination Lifecycle (Canonical State Machine)

A Resource Request represents the request/approval decision. A Coordination represents the operational commitment created after the request is approved. Therefore a resource Coordination does not begin in `REQUESTED`. The Resource Request begins in `REQUESTED`; once approved by the resource owner, the corresponding Coordination is created with state `APPROVED`.

```text
  APPROVED (Created upon Owner Approval of Resource Request)
      │
      ▼ (Handoff window set / operational details agreed)
  SCHEDULED
      │
      ▼ (Agreed safe handoff arrangement ready)
  HANDOFF_READY
      │
      ▼ (Item retrieved by borrower)
  HANDED_OVER
      │
      ▼ (In active possession)
   IN_USE
      │
      ▼ (Due time reached or window expiring)
  RETURN_DUE
      │
      ▼ (Borrower initiates return per agreed handoff arrangement)
RETURN_PENDING
      │
      ▼ (Owner confirms receipt per agreed handoff arrangement)
  COMPLETED ──► [Resource eligible for availability again]
```

#### Valid Coordination Transitions
1. `APPROVED` $\rightarrow$ `SCHEDULED` (Actor: Owner or Borrower — handoff window and location agreed)
2. `SCHEDULED` $\rightarrow$ `HANDOFF_READY` (Actor: Owner — the agreed safe handoff arrangement is ready for the participant to complete the handoff)
3. `HANDOFF_READY` $\rightarrow$ `HANDED_OVER` (Actor: Borrower or Owner — physical handoff completed)
4. `HANDED_OVER` $\rightarrow$ `IN_USE` (Actor: Borrower — borrower confirms active custody)
5. `IN_USE` $\rightarrow$ `RETURN_DUE` (Automatic on expiry, or manual by borrower/owner)
6. `IN_USE` or `RETURN_DUE` $\rightarrow$ `RETURN_PENDING` (Actor: **Borrower only** — the borrower has initiated the return according to the agreed handoff arrangement)
7. `RETURN_PENDING` $\rightarrow$ `COMPLETED` (Actor: **Owner only** — the owner has confirmed receipt/return according to the agreed handoff arrangement)
8. Any pre-handoff active state $\rightarrow$ `CANCELLED` (Subject to cancellation rules)
9. Any active state $\rightarrow$ `BLOCKED` (Underlying interaction boundary; active physical custody remains preserved for return)

#### Relationship Between the Two State Machines
* **Request Level:** Manages the proposal and approval decision (`REQUESTED` $\rightarrow$ `APPROVED` | `DECLINED` | `BLOCKED` | `CANCELLED` | `EXPIRED`). Legacy `ACCEPTED` terminology is superseded by `APPROVED`.
* **Coordination Level:** Manages operational fulfillment after approval (`APPROVED` $\rightarrow$ `SCHEDULED` $\rightarrow$ `HANDOFF_READY` $\rightarrow$ `HANDED_OVER` $\rightarrow$ `IN_USE` $\rightarrow$ `RETURN_DUE` $\rightarrow$ `RETURN_PENDING` $\rightarrow$ `COMPLETED`).
* **No Pre-Approval Coordination:** A resource Coordination is NOT created before owner approval. There is no concept of a "pending coordination", "provisional coordination", or "shadow coordination".

---

## 11. Resource Availability Semantics

A resource's listing status (`available: true | false`) is derived from its active coordinations:
1. **Available:** Resource is active and has zero coordinations in `APPROVED`, `SCHEDULED`, `HANDOFF_READY`, `HANDED_OVER`, `IN_USE`, `RETURN_DUE`, or `RETURN_PENDING`.
2. **In Use (Unavailable):** The moment an owner transitions a request to `APPROVED`, the underlying resource becomes unavailable for overlapping requests.
3. **Restored (Available):** After `COMPLETED`, the resource becomes eligible for availability again according to its resource availability and lifecycle rules. The resource remains physically with its owner or appropriate participant; this does NOT imply physical inventory pooling, depot inventory, or warehouse storage.

---

## 12. Two-Party Return Semantics

The return workflow enforces mutual two-party accountability according to the agreed safe handoff arrangement:

```text
Borrower initiates return per agreed handoff arrangement
         │
         ▼
Calls: POST /coordinations/:id/return/initiate
State becomes: RETURN_PENDING
         │
         ▼
Owner confirms physical receipt per agreed handoff arrangement
         │
         ▼
Calls: POST /coordinations/:id/return/confirm
State becomes: COMPLETED (Terminal)
Resource becomes: Eligible for availability again
```

* **Invariant 1:** A borrower **cannot** directly mark a coordination `COMPLETED`. Attempting to do so yields `403 FORBIDDEN`.
* **Invariant 2:** An owner **cannot** mark an item returned unless the borrower has initiated the return or the coordination has reached `RETURN_DUE`.
* **State Definitions:**
  * `RETURN_PENDING`: The borrower has initiated the return according to the agreed handoff arrangement.
  * `COMPLETED`: The owner has confirmed receipt/return according to the agreed handoff arrangement.

---

## 13. Blocking Semantics & Active Possession Survival

When User X blocks User Y (`POST /users/block`):

### 13.1 Future Interaction Restrictions
1. **Discovery:** Y can never discover X's resources in search (`GET /resources` filters X's inventory from Y's view).
2. **Requests:** Y cannot submit borrow requests to X (`POST /resources/requests` yields `404 NOT_FOUND`).
3. **Messaging:** Y cannot send messages to X.
4. **Pending Requests:** Any unapproved requests between X and Y immediately transition to `BLOCKED`.

### 13.2 Non-Destruction of Active Physical Possession
> **CRITICAL RULE:** Blocking must NEVER delete or cancel an active physical coordination.

If Y physically possesses X's resource (`IN_USE`, `RETURN_DUE`, or `RETURN_PENDING`) at the moment of the block:
1. The coordination remains visible in both users' dashboards under the **SAFETY** tab.
2. The active physical coordination is **preserved**.
3. Y retains the ability to initiate return (`POST /coordinations/:id/return/initiate`).
4. X retains the ability to confirm return (`POST /coordinations/:id/return/confirm`).
5. Upon confirmation, the coordination moves to `COMPLETED`, and all subsequent interactions between X and Y remain blocked.

---

## 14. Messaging Semantics

### 14.1 Lifecycle States
* **Pre-Approval Inquiry:** Borrower or owner can send a single "Ask a Question" note attached to a request. This does not create an open chat thread.
* **Active Coordination:** Once `APPROVED`, participants may exchange operational coordination notes (e.g., "Pruner placed at cafe courtyard hook").
* **Post-Completion:** When the coordination moves to `COMPLETED`, the message thread becomes read-only and is archived.
* **Post-Block:** If either user blocks the other, new messaging is prohibited immediately.

---

## 15. Trust and Eligibility Signals

### 15.1 Allowed Factual Signals
When an owner reviews a request, the API returns factual records:
* `identity_verified`: Boolean (Certified identity record on file)
* `neighborhood_verified`: Boolean (Verified resident of the hub)
* `account_active`: Text (Duration of active account, e.g., "8 months")
* `completed_coordinations`: Integer (Count of finished coordinations)
* `no_outstanding_returns`: Boolean (`TRUE` if user has 0 unreturned overdue items)
* `eligible`: Boolean (Meets verification tier requirement for this specific resource)

### 15.2 Explicitly Prohibited Gamification Metrics
The backend must **never** calculate, store, or serialize:
* Star ratings ($1.0 - 5.0$)
* Percentage scores (e.g., "100% on-time rate")
* Reliability scores or trustworthiness indexes
* Danger, risk, or suspicion scores
* Public negative strikes or disciplinary tallies
* Leaderboards, tiers, or member rankings

---

## 16. ASK Routing Contract

The ASK modal serves as a unified intake routing layer:

```text
                                  ┌─────────────┐
                                  │  ASK MODAL  │
                                  └──────┬──────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┬───────────────────────────────┐
         ▼                               ▼                               ▼                               ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│  RESOURCE NEED   │            │  HELP / COVERAGE │            │   ISSUE REPORT   │            │   SHARED QUERY   │
└────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
         │                               │                               │                               │
         ▼                               ▼                               ▼                               ▼
POST /resources/requests      POST /coverage-requests             POST /issues                    POST /queries
```

---

## 17. API Endpoint Contracts

### 17.1 Resources

#### `GET /resources`
* **Purpose:** Public discovery of available community tools in the hub.
* **Authentication:** Required (`Bearer <token>`).
* **Hub Scoped:** Yes (`req.actor.hub_id`).
* **Blocker Check:** Excludes items owned by users who blocked the caller or whom the caller blocked.
* **Response Schema:** Array of `ResourcePublicSummary` (Layer 1).
* **Privacy Guarantee:** Zero occurrences of `owner_id`, `owner_name`, `owner_phone`, or exact `location`.

#### `GET /resources/:resourceId`
* **Purpose:** Detailed view of a shared resource for borrowing.
* **Authentication:** Required.
* **Response Schema:** `ResourcePublicDetail` (Includes name, condition, general area, handoff policy, availability).

#### `POST /resources`
* **Purpose:** A resident lists a shared tool.
* **Authentication:** Required.
* **Request Body:** `{ name, type, condition, general_area, handoff_policy, requires_approval }`
* **Response:** Created resource row.

---

### 17.2 Resource Requests

#### `POST /resources/requests`
* **Purpose:** Borrower submits a borrow request.
* **Authentication:** Required.
* **Request Body:** `{ resource_id, purpose, duration, time_window_start, time_window_end, handoff_preference, message }`
* **Validation:** Caller cannot request their own resource. Caller must not be blocked by owner.
* **Response:** Created request in `REQUESTED` state.

#### `GET /resources/requests/inbound`
* **Purpose:** Owner views incoming borrow requests requiring review.
* **Authentication:** Required.
* **Response Schema:** Array of `ResourceRequestOwnerDetail` (Layer 3, includes factual trust signals).

#### `GET /resources/requests/outbound`
* **Purpose:** Borrower tracks outgoing borrow requests.
* **Authentication:** Required.
* **Response Schema:** Array of `ResourceRequestSummary` (Layer 2).

#### `POST /resources/requests/:requestId/approve`
* **Purpose:** Owner approves request.
* **Authorization:** Caller must be the resource owner.
* **Effect:** Request status $\rightarrow$ `APPROVED`. Spawns `Coordination` in `APPROVED` state. Marks resource unavailable. Emits request approval transition and creates initial `Coordination` record at `APPROVED`.
* **Response:** `{ request, coordination }`

#### `POST /resources/requests/:requestId/decline`
* **Purpose:** Owner declines request.
* **Authorization:** Caller must be the resource owner.
* **Request Body:** `{ reason }` (Optional).
* **Effect:** Request status $\rightarrow$ `DECLINED`. Request-level transition recorded in request history.

---

### 17.3 Coordinations & Two-Party Returns

#### `GET /coordinations`
* **Purpose:** Retrieves all coordinations for the authenticated user across personal roles.
* **Authentication:** Required.
* **Query Parameters:** `?tab=ACTIVE|UPCOMING|RETURNS|COMPLETED|SAFETY`
* **Response Schema:** Array of `CoordinationDetail` (Layer 4).

#### `GET /coordinations/:coordinationId`
* **Purpose:** Detailed management view of a coordination.
* **Authorization:** Caller must be a participant (requester or owner/helper) or coordinator.
* **Response Schema:** `CoordinationDetail` with embedded events and messages.

#### `POST /coordinations/:coordinationId/return/initiate`
* **Purpose:** Borrower initiates return according to the agreed safe handoff arrangement.
* **Authorization:** Strictly the borrower (`req.actor.user_id === coordination.requester_id`).
* **Precondition:** Coordination must be in `IN_USE` or `RETURN_DUE`.
* **Effect:** Coordination state $\rightarrow$ `RETURN_PENDING`. `borrower_return_initiated = TRUE`. Emits `RETURN_INITIATED` event.

#### `POST /coordinations/:coordinationId/return/confirm`
* **Purpose:** Owner confirms return receipt according to the agreed safe handoff arrangement.
* **Authorization:** Strictly the resource owner (`req.actor.user_id === coordination.counterpart_id`).
* **Precondition:** Coordination must be in `RETURN_PENDING` (or `RETURN_DUE`).
* **Effect:** Coordination state $\rightarrow$ `COMPLETED`. `owner_return_confirmed = TRUE`. Restores underlying resource availability (`available = TRUE`). Emits `RETURN_CONFIRMED` event.

---

### 17.4 Blocking

#### `POST /users/block`
* **Purpose:** Member blocks another user.
* **Request Body:** `{ target_user_id }`
* **Effect:** Inserts into `blocked_users`. Unapproved requests between users $\rightarrow$ `BLOCKED`. Active physical coordinations remain open for safe return.
* **Response:** `{ status: "BLOCKED", target_user_id }`

#### `GET /users/blocked`
* **Purpose:** Retrieves list of users blocked by caller.
* **Response:** `[{ blocked_user_id, created_at }]`

---

### 17.5 Messaging

#### `POST /coordinations/:coordinationId/messages`
* **Purpose:** Post an operational coordination note.
* **Authorization:** Caller must be a participant. Coordination must not be `COMPLETED` or `BLOCKED`.
* **Request Body:** `{ text }`

#### `GET /coordinations/:coordinationId/messages`
* **Purpose:** Retrieve message thread for a coordination.
* **Authorization:** Participants or coordinator.

---

### 17.6 Safety & Conduct Reports (Reusing `conduct_reports`)

#### `POST /conduct-reports`
* **Purpose:** File a private safety report with neighborhood coordinators.
* **Request Body:** `{ reported_against, context_type, context_id, category, description, evidence }`
* **Rate Limit:** Maximum 10 reports per rolling 24-hour period.

---

### 17.7 Neighborhood Issues & Queries

#### `GET /issues`
* **Purpose:** Retrieve public infrastructure & neighborhood condition issues in the authenticated actor's hub.
* **Authentication:** Required (`Authorization: Bearer <token>`).
* **Hub Isolation:** Scoped strictly to `req.actor.hub_id`. Client cannot supply or alter hub context.
* **Filter Semantics (`?status=`):**
  * Omitted / empty / `status=active`: Returns active issues (`status <> 'resolved'`). Default behavior.
  * `status=all`: Returns all issues in hub regardless of status.
  * `status=resolved`: Returns resolved issues only.
  * Exact status match (`reported`, `attention_needed`, `in_progress`, `parts_ordered`): Returns issues matching exact status.
  * Unsupported status filter value: Returns `400 VALIDATION_ERROR`.
* **Privacy Rules:** List items **NEVER** expose `reported_by` to any caller (residents or coordinators).
* **Response Schema:** Array of `NeighborhoodIssueList`:
  ```json
  [
    {
      "issue_id": "uuid",
      "hub_id": "uuid",
      "title": "Broken bench",
      "category": "infrastructure",
      "severity": "low",
      "general_location": "Central Courtyard",
      "status": "reported",
      "detail": "Slat loose",
      "position_3d": {},
      "created_at": "2026-10-09T10:00:00Z"
    }
  ]
  ```

#### `POST /issues`
* **Purpose:** Report a neighborhood infrastructure/cleanliness/safety/gardening issue.
* **Authentication:** Required (`Authorization: Bearer <token>`).
* **Request Body:** `{ title, category, severity, general_location, detail }`
  * `title`: Required string, 1–200 characters.
  * `category`: Required string, one of `['infrastructure', 'safety', 'gardening', 'cleanliness']`.
  * `severity`: Required string, one of `['low', 'medium', 'high']`.
  * `general_location`: Required string, 1–500 characters.
  * `detail`: Optional string up to 2000 characters.
* **Server Authority:** `hub_id` and `reported_by` are derived from `req.actor`. `status` is set to `reported`. Client-supplied `position_3d` is ignored; `{}` is stored.
* **Response:** `201 Created` returning `NeighborhoodIssueDetail` (includes `reported_by` for the creator).

#### `GET /issues/:id`
* **Purpose:** Retrieve detailed view of a specific neighborhood issue.
* **Authentication:** Required (`Authorization: Bearer <token>`).
* **Hub Isolation:** Returns `404 NOT_FOUND` if the issue does not exist or belongs to another hub.
* **Privacy Projection:** `reported_by` is included **ONLY** if the caller is the original reporter. It is omitted for all other residents and coordinators.

#### `PATCH /issues/:id`
* **Purpose:** Edit issue details.
* **Authentication:** Required (`Authorization: Bearer <token>`).
* **Eligibility & Authority:** Only the original reporter may edit an issue, and only while its status is `reported`.
  * If caller is not original reporter: `403 FORBIDDEN`.
  * If issue status is not `reported`: `409 INVALID_STATE_TRANSITION`.
  * If issue belongs to another hub or does not exist: `404 NOT_FOUND`.
  * Attempting to modify immutable fields (`issue_id`, `hub_id`, `reported_by`, `status`, `created_at`, `position_3d`): `400 VALIDATION_ERROR`.
* **Permitted Editable Fields:** `title`, `detail`, `general_location`, `category`, `severity`.

#### `PATCH /issues/:id/status`
* **Purpose:** Transition issue status.
* **Authentication:** Required (`Authorization: Bearer <token>`).
* **Request Body:** `{ status, reason }`
* **Approved Transition & Authority Matrix:**
  | Current Status | Target Status | Authorized Actor | Preconditions |
  | :--- | :--- | :--- | :--- |
  | `reported` | `attention_needed` | Any authenticated same-hub resident | None |
  | `reported` | `in_progress` | Any authenticated same-hub resident | Work undertaking flag |
  | `reported` | `resolved` | Original reporter OR same-hub coordinator | None |
  | `attention_needed` | `in_progress` | Any authenticated same-hub resident | Work undertaking flag |
  | `attention_needed` | `resolved` | Original reporter OR same-hub coordinator | None |
  | `in_progress` | `parts_ordered` | Same-hub coordinator ONLY | Coordinator operational status |
  | `in_progress` | `resolved` | Original reporter OR same-hub coordinator | None |
  | `parts_ordered` | `in_progress` | Same-hub coordinator ONLY | Coordinator operational status |
  | `parts_ordered` | `resolved` | Original reporter OR same-hub coordinator | None |
  | `resolved` | `attention_needed` | Original reporter OR same-hub coordinator | Non-empty `reason` string required |
* **Enforcement Rules:**
  * Disallowed transitions (e.g. `resolved → in_progress`, `parts_ordered → reported`): `409 INVALID_STATE_TRANSITION`.
  * Lacking authority for allowed transition: `403 FORBIDDEN`.
  * Unsupported status values (e.g. `withdrawn`): `400 VALIDATION_ERROR`.
  * Missing reopening reason on `resolved → attention_needed`: `400 VALIDATION_ERROR`.
  * Same-status request: Idempotent (returns `200` without database update or side effects).
  * Concurrent status modification: Atomic conditional update returns `409 CONFLICT`.

#### Explicit Contract Boundaries & Limitations:
* **No Assignment System:** Under zero migrations, `neighborhood_issues` has no `assigned_to` column; transition to `in_progress` indicates work undertaking at hub level without individual assignment tracking.
* **No Withdrawal Lifecycle:** `withdrawn` status is not supported by database constraint.
* **No Event Audit Trail:** No durable status history table exists.
* **No 3D Spatial Common-Area Verification:** Coordinates persist as `{}`.
* **Neighborhood Queries (`/queries`):** Unimplemented in Phase 2G-5B.3.

#### `GET /queries`
* **Purpose:** Browse shared community demand queries.
* **Response Schema:** Array of `NeighborhoodQuery` (aggregate interest only, no personal rosters).

#### `POST /queries`
* **Purpose:** Start a neighborhood demand query.
* **Request Body:** `{ title, description, category, preferred_timing }`

---

## 18. Error Semantics

All API error responses use a standard error envelope:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of error",
  "status": 400
}
```

### Canonical Error Codes
| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `UNAUTHENTICATED` | 401 | Missing or invalid bearer token. |
| `FORBIDDEN` | 403 | Caller lacks permission for this action or entity. |
| `NOT_FOUND` | 404 | Entity does not exist, or caller is not authorized to know it exists. |
| `VALIDATION_ERROR` | 400 | Invalid payload or missing required fields. |
| `CONFLICT` | 409 | State conflict (e.g., resource already in use). |
| `INVALID_STATE_TRANSITION` | 409 | Attempted transition violates the canonical state machine. |
| `BLOCKED` | 403 | Operation blocked due to a mutual blocking relationship. |
| `RESOURCE_UNAVAILABLE` | 409 | Resource is currently checked out by another neighbor. |
| `SUBMISSION_LIMIT_EXCEEDED` | 429 | Rate limit reached (e.g., 10 conduct reports/24h). |

*Privacy Rule for Errors:* Error messages must never leak private relationships. If a blocked user attempts to request an item, the API returns `404 NOT_FOUND` rather than "User X has blocked you."

---

## 19. Frontend $\leftrightarrow$ Backend Mapping Table

| Phase 1 Frontend Concept (`saathi-frontend`) | Canonical Backend Model | Future API Route | Database Persistence Target |
| :--- | :--- | :--- | :--- |
| `CURRENT_USER` | `User` / `ActorContext` | `GET /auth/me` | `users` + `sessions` |
| `SHARED_RESOURCES` | `Resource` | `GET /resources` | `resource_inventory` |
| `BORROW_REQUESTS` | `Resource Request` | `GET /resources/requests/inbound` | `resource_requests` |
| `COORDINATION_RECORDS` | `Coordination` | `GET /coordinations` | `coordinations` |
| `COORDINATION_EVENTS` | `Coordination Event` | `GET /coordinations/:id/events` | `coordination_events` |
| `COORDINATION_MESSAGES` | `Coordination Message` | `GET /coordinations/:id/messages` | `coordination_messages` |
| `BLOCKED_USERS` | `Block` | `GET /users/blocked` | `blocked_users` |
| `SAFETY_REPORTS` | `Conduct Report` | `POST /conduct-reports` | `conduct_reports` |
| `NEIGHBORHOOD_ISSUES` | `Neighborhood Issue` | `GET /issues` | `neighborhood_issues` |
| `NEIGHBORHOOD_QUERIES` | `Neighborhood Query` | `GET /queries` | `neighborhood_queries` |
| `coverageItems` | `Coverage Request` | `GET /coverage-requests` | `coverage_requests` |

---

## 20. Static / Demo Data Boundary

To prevent bloat and maintain architectural discipline, the following data boundaries are frozen:

### 20.1 Remains Static Frontend Configuration
* Resource category taxonomies (`tools`, `medical`, etc.) and UI iconography.
* Preset duration options (`~1 hour`, `~2-3 hours`, `Half day`, `Full day`).
* Preset handoff options ("Lot 1 Cafe Courtyard", "Greenwood Pavilion").
* Standard operational time window labels.

### 20.2 Remains 3D Diorama Presentation Data
* 3D spatial vectors (`position3D: { x, y, z }`) for residential buildings, props, and trees.
* Camera director scripts and animations (Drill story, Ladder story, Carry story).
* Diorama 3D character avatars and walking paths.
* Ambient lighting and diorama mesh assets.

---

## 21. 3D Spatial Privacy Contract

1. **Presentation Boundary:** The 3D neighborhood diorama is an architectural storytelling medium representing the neighborhood environment. It is **NOT** a spatial database of resident property.
2. **Lot Decoupling:** Selecting or hovering a residential building in 3D reveals only architectural presence ("Verified Proximity") and public community coverage items (e.g., "Package Holding"). It must **never** list personal tools owned by residents of that lot.
3. **Community Exchange Marker:** The "Community Exchange" diorama marker represents an optional community coordination point (e.g., Cafe Courtyard benches/lockers) for safe handoffs. It is not a warehouse, depot, or permanent storage facility, and does not reveal where resources are kept prior to exchange.

---

## 22. Non-Negotiable Privacy Invariants Checklist

Prior to approving any backend PR in Phase 2, the implementation must be validated against these invariants:
* [ ] Public resource discovery payload contains 0 occurrences of owner identity.
* [ ] Public resource discovery payload contains 0 occurrences of exact residential address/lot.
* [ ] Public resource discovery payload contains 0 occurrences of phone numbers or contact details.
* [ ] 3D diorama interactions do not display personal tool counts for residential lots.
* [ ] Users in Hub A cannot read, query, or enumerate records in Hub B.
* [ ] Blocking user Y prevents Y from discovering or requesting any resources owned by blocker X.
* [ ] Blocking user Y does NOT delete an active physical coordination where Y holds X's tool.
* [ ] Resource returns require explicit borrower initiation followed by owner confirmation.
* [ ] Trust signals presented to owners are purely factual (verified, age, completions, returns).
* [ ] The API exposes zero ratings, zero stars, zero reputation scores, and zero leaderboards.

---

## 23. State Transition Invariants

* **Invariant ST-1:** A borrow request cannot move to `APPROVED` unless the actor is the resource owner.
* **Invariant ST-2:** A borrow request cannot move to `DECLINED` unless the actor is the resource owner.
* **Invariant ST-3:** A coordination cannot move to `RETURN_PENDING` unless the borrower initiates it.
* **Invariant ST-4:** A coordination cannot move to `COMPLETED` unless the owner confirms receipt.
* **Invariant ST-5:** A resource cannot be approved if another active coordination already holds it.
* **Invariant ST-6:** Any transition outside the canonical state machine returns `409 INVALID_STATE_TRANSITION`.

---

## 24. Progressive Identity Disclosure Matrix

| Stage | Visibility to Public | Visibility to Borrower | Visibility to Owner |
| :--- | :--- | :--- | :--- |
| **Discovery** | Resource name, category, condition, general area, handoff policy. Zero owner data. | *Same as Public* | *Same as Public* |
| **Request Pending** | Unchanged | Outgoing request status, neutral handoff preference. | Requester name, purpose, duration, message, factual trust signals. |
| **Approved & In Use** | Resource marked unavailable. | Counterpart first name + "Verified Neighbor", agreed handoff arrangement. | Borrower first name + "Verified Neighbor", agreed handoff arrangement. |
| **Completed** | Resource returns to available. | Stored in private history tab. | Stored in private history tab. |

---

## 25. Open Contract Questions

These items are deliberately flagged as open design questions for future phases:
1. **OPEN QUESTION 1 (Issue Spatial Precision):** Whether public neighborhood issues should record exact GPS coordinates (`latitude`, `longitude`) or remain restricted to descriptive general text (`general_location`) will be finalized in Phase 3.
2. **OPEN QUESTION 2 (Helper Identity in Coverage):** In task coverage (e.g., plant watering), whether a volunteer helper's full name is revealed upon accepting or only upon starting the task will be resolved prior to task coverage UI expansion.
3. **OPEN QUESTION 3 (Coverage Coordination Lifecycle Mapping):** In Coverage requests (task/help assistance), whether accepting a volunteer directly creates an operational Coordination or uses the existing `coverage_requests` table lifecycle (`ACCEPTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`) without pre-approval Coordination creation is an implementation decision to be finalized before Coverage schema work in future phases. The resource-borrowing lifecycle (Resource Request: `REQUESTED` $\rightarrow$ `APPROVED`; Coordination: created at `APPROVED` $\rightarrow$ `SCHEDULED` $\rightarrow$ ... $\rightarrow$ `COMPLETED`) is fully defined and binding.

---

## 26. Phase 2 Implementation Boundary

```text
PHASE 2B: Canonical Domain Model + API Contract Alignment ──► [COMPLETE / FROZEN]

NEXT IMPLEMENTATION STEPS:
├── Phase 2C: Database Migrations (003_coordination.sql)
│   ├── Create coordinations, coordination_events, coordination_messages
│   ├── Create blocked_users, neighborhood_issues, neighborhood_queries
│   └── Alter resource_inventory & resource_requests with missing columns
│
├── Phase 2D: Service Layer Implementation
│   ├── Implement coordination service & two-party return gate
│   ├── Implement blocker service & query filtering
│   └── Implement factual trust signals calculation
│
├── Phase 2E: Routes & Sanitized Serializers
│   ├── Refactor GET /resources to eliminate privacy leaks
│   └── Implement /coordinations, /users/block, and /issues routes
│
├── Phase 2F: Backend Automated Security & Integration Tests
│   ├── Port Requirement #53 X/Y privacy attack test
│   └── Test two-party return enforcement & active possession blocking
│
└── Phase 2G: Frontend Client Integration
    └── Connect saathi-frontend to live API, removing mock state handlers
```

---

## 27. Historical Decisions Archive (Pilot Phase 1)

*This archive preserves original decisions 1 through 8.1 for auditable engineering history.*

### 1. Resource/coverage expiration
**Decision:** A `REQUESTED` or `ACCEPTED` coverage or resource request is treated as `EXPIRED` once its `time_window_end` has passed, computed at **read time**.  
*Phase 2 Status:* **Preserved.** Read-time expiry is retained for pre-approval requests.

### 2. Eligibility tier comparison
**Decision:** Eligibility requires an **exact match** between an active `verification_records.tier` and the task's `task_taxonomy.required_verification_tier`. No tier hierarchy is assumed.  
*Phase 2 Status:* **Preserved.**

### 3. Resource overlap
**Decision:** Not enforced in initial pilot.  
*Phase 2 Status:* **Superseded by Section 11.** An approved coordination now locks the resource (`available = FALSE`) to prevent double-booking.

### 4. "Volunteer" is a label, not a role
**Decision:** "Volunteer" refers to whichever resident or verified helper is assigned to a coverage request. It is not a fourth `users.role`.  
*Phase 2 Status:* **Preserved.**

### 5. Coverage cancellation authorization
**Decision:** Cancellation authorized per frozen status table.  
*Phase 2 Status:* **Preserved for coverage requests.**

### 6. Non-participant read access
**Decision:** Read endpoints return `404 NOT_FOUND` for non-participants to prevent UUID probing.  
*Phase 2 Status:* **Preserved and expanded across all coordination endpoints.**

### 7. Authentication and account provisioning
**Decision:** Phone + OTP and email + password.  
*Phase 2 Status:* **Superseded by Decision 7.1.**

### 7.1. Auth: phone+OTP path removed — email+password only
**Decision:** Email + password authentication with scrypt hashing and opaque bearer tokens.  
*Phase 2 Status:* **Preserved in full (Section 4).**

### 8. Phase 1 pilot hub bootstrap
**Decision:** Canonical pilot hub UUID `00000000-0000-0000-0000-000000000001` ("SAATHI Pilot Hub").  
*Phase 2 Status:* **Preserved.**

### 8.1. Phase 1 pilot coordinator bootstrap
**Decision:** Canonical coordinator UUID `00000000-0000-0000-0000-000000000002` ("SAATHI Pilot Coordinator").  
*Phase 2 Status:* **Preserved.**
