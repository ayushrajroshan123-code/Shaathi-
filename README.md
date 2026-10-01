# SAATHI

### Everyday care meets real coordination.

SAATHI is a neighborhood coordination platform built around a simple idea:

**People in a neighborhood already have the ability to help each other. SAATHI gives that community a place to coordinate it.**

From everyday requests and shared resources to neighborhood-wide awareness, SAATHI brings local coordination into one structured, spatial experience.

---

## The Problem

Neighborhoods already contain everything needed for stronger communities:

* People willing to help
* Resources that could be shared
* Local knowledge
* Different needs and capabilities
* Existing relationships between neighbors

What is often missing is a **coordination layer**.

Important requests disappear in noisy group chats.
Useful resources remain invisible.
People who could help often don't know that help is needed.

SAATHI is being built to address that gap.

---

## The Product

SAATHI creates a dedicated digital layer for neighborhood coordination.

It combines community activity with a spatial representation of the neighborhood, allowing people to understand **what is happening, where it is happening, and where coordination is needed.**

### Core capabilities

| Capability         | What it enables                                |
| ------------------ | ---------------------------------------------- |
| **Requests**       | Surface needs within the neighborhood          |
| **Resources**      | Discover and coordinate useful local resources |
| **Coverage**       | Understand where support is available          |
| **Issues**         | Surface relevant neighborhood-level concerns   |
| **Spatial View**   | Explore neighborhood activity visually         |
| **Multiple Modes** | Adapt coordination to different situations     |

---

# Product Experience

## A Neighborhood, Not Just a Dashboard

SAATHI uses an interactive spatial environment to represent the community.

Instead of reducing a neighborhood to lists and notifications, the interface gives activity a **place**.

This creates a more intuitive way to understand local coordination at a glance.

---

# Visual Showcase

*(Placeholder: docs/screenshots/landing.png)*
*(Placeholder: docs/screenshots/neighborhood.png)*
*(Placeholder: docs/screenshots/dashboard.png)*
*(Placeholder: docs/screenshots/coordination.png)*

---

# How It Works

`	ext
                    SAATHI

                       ¦
                       ?
              +-----------------+
              ¦  Web Experience ¦
              +-----------------+
                       ¦
                       ?
              +-----------------+
              ¦    API Layer    ¦
              +-----------------+
                       ¦
                       ?
              +-----------------+
              ¦    PostgreSQL   ¦
              +-----------------+
`

---

# Technology

| Layer            | Technology        |
| ---------------- | ----------------- |
| Frontend         | React             |
| Build            | Vite              |
| 3D Visualization | Three.js          |
| Motion           | Framer Motion     |
| Backend          | Node.js / Express |
| Database         | PostgreSQL        |

---

# Project Structure

`	ext
SAATHI/
¦
+-- saathi-frontend/
¦   +-- Web application
¦
+-- saathi-api-updated-003/
¦   +-- saathi-api-updated/  # Backend API
¦
+-- .gitignore
+-- README.md
`

---

# Run Locally

## Requirements

* Node.js (v18+)
* npm
* PostgreSQL (v14+)

---

## Clone

`ash
git clone https://github.com/ayushrajroshan123-code/Shaathi-.git
cd Shaathi-
`

---

## Frontend

`ash
cd saathi-frontend
npm install
npm run dev
`

---

## Backend

`ash
cd saathi-api-updated-003/saathi-api-updated
npm install
npm run dev
`

---

## Environment

The backend requires an environment file to be located in its directory.

1. Navigate to the backend directory:
   `ash
   cd saathi-api-updated-003/saathi-api-updated
   `
2. Copy the environment template:
   - On Unix-based systems (Linux/macOS):
     `ash
     cp .env.example .env
     `
   - On Windows (PowerShell):
     `powershell
     Copy-Item .env.example .env
     `

Edit the newly created .env file to match your local database configuration. Do not commit your real .env file.

---

# Current Status

SAATHI is an actively developed product prototype.

The current build includes the implemented product experience, including:

* Interactive public landing experience
* Neighborhood dashboard
* Spatial neighborhood visualization
* Community requests
* Shared resources
* Coverage representation
* Neighborhood issues
* Multiple coordination contexts
* Backend API
* PostgreSQL persistence
* Authentication

---

# What's Next

SAATHI is being developed iteratively with the goal of validating the coordination experience in real-world neighborhood environments and improving the product around actual community needs.

---

# Philosophy

Technology should not replace the relationships that already exist in a neighborhood.

It should make those relationships **easier to activate when they matter.**

**Everyday care meets real coordination.**

---

# Development

This repository represents an actively evolving product.

The public codebase provides visibility into the project and its implementation while keeping certain product, business, and internal architectural details intentionally undisclosed.

---

# License

No open-source license has currently been granted for this repository.


