# Data model — the ten tables

**Answers:** what is stored, and how the records relate.

Derived from `src/app/core/models/*.ts` and `src/app/core/mock-api/mock-db.ts`. These are the tables Laravel will implement in R1, so the shapes are the contract rather than an implementation detail.

```mermaid
erDiagram
    FAIRS ||--o{ BOOTHS : "lays out"
    FAIRS ||--o{ FAIR_APPLICATIONS : "receives"
    FAIRS ||--o{ FAIR_REGISTRATIONS : "receives"
    FAIRS ||--o{ INTERVIEW_SLOTS : "schedules"
    FAIRS ||--o{ SHORTLISTS : "scopes"

    EMPLOYERS |o--o{ BOOTHS : "occupies"
    EMPLOYERS ||--o{ FAIR_APPLICATIONS : "applies through"
    EMPLOYERS ||--o{ SHORTLISTS : "builds"
    EMPLOYERS ||--o{ INTERVIEW_SLOTS : "owns"

    CANDIDATES ||--o{ FAIR_REGISTRATIONS : "registers through"
    CANDIDATES ||--o{ SHORTLISTS : "appears on"
    CANDIDATES |o--o{ INTERVIEW_SLOTS : "books"

    USERS |o--o| EMPLOYERS : "acts for"
    USERS |o--o| CANDIDATES : "owns record of"
    USERS ||--o{ AUDIT_ENTRIES : "is copied into"

    USERS {
        string id PK
        string name
        string role "staff|employer|job_seeker"
        string employerId FK "set for an employer"
        string candidateId FK "set for a job seeker"
    }

    FAIRS {
        string id PK
        string name
        string status "draft|open|live|completed"
        string startDate "ISO +08:00"
        string endDate "ISO +08:00"
        int boothTotal
        int boothAssigned "derived from BOOTHS"
    }

    BOOTHS {
        string id PK
        string fairId FK
        string code "A1..E8"
        string package "standard|premium|platinum"
        int priceMyr
        string employerId FK "null when free"
    }

    EMPLOYERS {
        string id PK
        string name "company, not personal data"
        string stage "lead|proposal|confirmed|paid|lost"
        string lostReason "required iff stage=lost"
        string contactEmail "personal data"
        string boothPackage "required before paid"
        int dealValueMyr "derived from package"
        string_array fairIds "pivot in Laravel"
    }

    CANDIDATES {
        string id PK
        string fullName "personal data"
        string university
        string fieldOfStudy
        int graduationYear
        float cgpa "nullable"
        string email "masked until shortlisted"
        string phone "masked until shortlisted"
        bool isContactVisible "set by the API, not stored"
        string_array fairIds "kept in step with registrations"
    }

    SHORTLISTS {
        string id PK
        string employerId FK
        string candidateId FK
        string fairId FK
        string note
    }

    INTERVIEW_SLOTS {
        string id PK
        string fairId FK
        string employerId FK
        string startTime "20 minutes"
        string candidateId FK "null when open"
    }

    FAIR_APPLICATIONS {
        string id PK
        string fairId FK
        string employerId FK
        string status "pending|approved|rejected"
        string rejectionReason "required iff rejected"
        string decidedAt "null while pending"
    }

    FAIR_REGISTRATIONS {
        string id PK
        string fairId FK
        string candidateId FK
        string consentedAt "PDPA: when, for this fair"
    }

    AUDIT_ENTRIES {
        string id PK
        string at "ISO +08:00"
        string actorId "copied, not a FK"
        string actorName "copied, not a FK"
        string entity
        string entityId
        json changes "values redacted for personal fields"
    }
```

## What this deliberately leaves out

- Presentation-only fields that the API computes per request rather than stores: `Booth.employerName`, `FairApplication.employerName`, `InterviewSlot.candidateName`, `Shortlist.candidate`. They are denormalised into responses so a list renders without a second call.
- `createdAt` / `updatedAt` on most tables.

## Things the diagram cannot show

- **`fairIds` is an array, and should not be.** `Employer.fairIds` and `Candidate.fairIds` are arrays because the mock has no join table. In PostgreSQL these become `employer_fair` and a derivation from `fair_registrations`. Anyone implementing R1 should treat them as pivots, not columns.
- **`Candidate.isContactVisible` is not stored anywhere.** The API sets it per request from who is asking — the owner, or an employer who has shortlisted them. A migration that creates it as a column has misread this.
- **`AUDIT_ENTRIES` deliberately has no foreign key to `USERS`.** The actor's id and name are copied in. A log that says "user u-emp-1" is useless once that user is gone, and a trail that changes when another record is edited is not a trail.
- **The masking rule is a relationship, not a column.** A candidate's email is visible only when a `SHORTLISTS` row exists for the asking employer — enforced in `candidates.handler.ts`, so an unmasked value never reaches the browser.
- **This diagram is invalidated by any schema change**, so it needs re-checking whenever a model in `src/app/core/models/` changes. It is the most volatile of the four.
