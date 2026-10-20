# Saathi — The Neighbourhood That Helps

**Borrow a ladder. Ask a neighbour. Help someone nearby.**

Saathi is a neighbourhood-sharing platform built around an interactive 3D environment. It brings resource borrowing, community requests, and an early emergency-coordination experience into one place.

[Source Code](https://github.com/ayushrajroshan123-code/Shaathi-)

![Saathi landing page](docs/screenshots/landing.png)

*Explore the neighbourhood and discover the experience.*

![Saathi 3D neighbourhood](docs/screenshots/neighborhood.png)

## Why Saathi?

In my housing society, someone always needed a ladder, a drill, or an iron for a festival or a quick repair. Often, someone nearby already had the same item sitting unused in a cupboard. People bought things they might use only once simply because they didn't know what was available around them.

That got me thinking: **what if the things we need most are already closer than we think?**

Saathi grew from that simple idea. I wanted to make it easier for neighbours to share what they have, ask for what they need, and build connections through everyday interactions.

## Features

- **Interactive 3D neighbourhood** — Explore a visual environment designed to make community resources and activity easier to understand.
- **Resource sharing** — Browse available items and request to borrow what you need.
- **Request tracking** — Follow borrowing requests through their supported workflow states.
- **Community requests** — Ask for help, look for resources, or report local issues.
- **Emergency-coordination concept** — Explore an early view of how neighbourhood coordination could extend beyond everyday sharing.

The goal is to connect the visual environment to meaningful actions, rather than build a 3D scene that looks impressive but does little.

## Engineering and design decisions

### Making the 3D experience useful

The 3D environment is a core part of the product, not just decoration. Its purpose is to give neighbourhood activity a visual context while keeping the experience understandable for first-time visitors.

### Using a structured backend

Saathi uses a Node.js backend and PostgreSQL database to support application workflows and persistent data. Keeping backend responsibilities separate from the React interface provides a clearer foundation for testing and future development.

### Treating security as part of development

Authentication controls, security headers, migration handling, and regression testing have been part of the engineering work. The implementation and its limits should be evaluated through the actual code and tests rather than assumed from the presence of a feature.

### Making changes deliberately

I have prioritised targeted changes, regression checks, and verification over broad rewrites without clear evidence that they are needed. This helps protect working functionality while the project evolves.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Vite |
| 3D environment | Three.js |
| Backend | Node.js |
| Database | PostgreSQL |
| Testing | Automated application, API, and security checks |

## Testing and verification

In a previously reviewed test run, the following results were reported:

| Test group | Result |
|---|---:|
| Frontend assertions | 107/107 passed |
| Boundary tests | 21/21 passed |
| CORS tests | 11/11 passed |
| Backend hardening tests | 23/23 passed |
| Frontend production build | Passed |

These are results from the earlier reviewed run, not a guarantee of the current branch's status. They do not establish that every user workflow works end to end.

Database integration testing, live deployment behaviour, and complete end-to-end workflows require separate verification.

## Run locally

Follow these steps to run Saathi locally using a development or test database:

### Prerequisites

- **Node.js** (v18.11+ or v20+)
- **PostgreSQL** (v14+)
- **npm** (v9+)

### 1. Database and backend setup

Ensure PostgreSQL is running, then initialize the database and API:

```bash
# Create local database
createdb saathi

# Navigate to backend directory and install dependencies
cd saathi-api-updated-003/saathi-api-updated
npm install

# Configure environment variables
cp .env.example .env

# Run database migrations and start development server
npm run migrate
npm run dev
```

The backend API will start on `http://localhost:3000`.

### 2. Frontend web application

In a separate terminal, start the frontend client:

```bash
# Navigate to frontend directory and install dependencies
cd saathi-frontend
npm install

# Configure environment variables
cp .env.example .env

# Start frontend development server
npm run dev
```

The frontend application will be accessible at `http://localhost:5173`.

Use a development or test database. Do not commit credentials, database URLs, tokens, or other secrets to the repository.

## Roadmap

- Complete and verify remaining borrowing-request transitions and edge cases.
- Improve interface feedback and loading, error, and empty states.
- Develop richer neighbour discovery with appropriate privacy protections.
- Expand notification and resource-matching capabilities.
- Complete and validate end-to-end emergency-coordination workflows.
- Strengthen automated integration testing and continuous integration.

## What I've learned

Building Saathi has taught me that getting an application to run is only the beginning. Features need to behave correctly across different states, interfaces need to make sense to new users, and tests need to verify meaningful behaviour.

It has also reinforced the importance of privacy, maintainable backend design, and making small changes that can be verified.

Saathi is still evolving. My aim is to keep improving it while being clear about what works, what needs attention, and what has yet to be built.
