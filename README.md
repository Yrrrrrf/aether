<h1 align="center">
  <img src="https://raw.githubusercontent.com/Yrrrrrf/prism-py/main/resources/img/dodecahedron.png" alt="Aether Icon" width="128" height="128" description="A simple dodecahedron with a yellow glow!">
  <div align="center">AETHER</div>
</h1>

<div align="center">
  <strong>The Type-Safe Data Fabric</strong>
</div>

<div align="center">

[![Deno](https://img.shields.io/badge/Deno-2.x-000000?logo=deno&logoColor=white)](https://deno.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://choosealicense.com/licenses/mit/)
[![PostgREST](https://img.shields.io/badge/Backend-PostgREST-blue)](https://postgrest.org)

</div>

## Overview

**Aether** is a next-generation TypeScript library that projects your PostgreSQL database directly into your frontend code. It acts as a "Phantom" layer—intercepting property access and translating it into efficient [PostgREST](https://postgrest.org/) API calls.

Unlike traditional ORMs or API clients, Aether requires **zero boilerplate**. It introspects your database to generate strict TypeScript interfaces and Zod schemas, then provides a fluid, type-safe API to query your data as if it were local memory.

> **Note:** Aether is the spiritual successor to `prism-ts`, refactored for modern Deno/TypeScript environments and PostgREST backends.

## Key Features

- **🔮 The Oracle**: An intelligent CLI that introspects your PostgreSQL schema and generates strict TypeScript interfaces and Zod validation schemas.
- **👻 The Phantom**: A lightweight runtime (3KB) that uses ES6 Proxies to convert code like `db.users.findMany(...)` into optimized REST calls.
- **🗣️ The Dialect**: A powerful Query DSL that translates complex filters (`$or`, `$in`, `$cs`) into PostgREST URL syntax automatically.
- **🛡️ Type Fidelity**: Automatic handling of PostgreSQL-specific types:
  - `BigInt` → `string` (safe serialization to prevent JS number overflow).
  - `Date`/`Timestamp` → ISO 8601 strings.
  - `JSONB` → Typed interfaces.
- **⚡ Split-Brain Routing**: Seamlessly handles standard table operations and RPC stored procedure calls via the `_plugins` namespace.

## Architecture

Aether consists of two distinct parts:

1.  **Dev-Time (The Oracle):** Connects to Port `5432` (Postgres) to read the schema.
2.  **Runtime (The Fabric):** Connects to Port `3000` (PostgREST) to execute queries.

## Quick Start

### 1. Start the Backend

Use the provided Docker Compose setup to spin up a Postgres DB and a PostgREST server.

```bash
docker-compose up -d
```

### 2. Generate Types (The Oracle)

Introspect the database to generate your `schema.d.ts`.

```bash
deno task generate --url=postgres://aether_user:aether_password@localhost:5432/aether_test --out=./src/schema.d.ts
```

### 3. Initialize Client (The Fabric)

Use the generated types to create a type-safe client.

```typescript
import { createAether } from "@yrrrrrf/aether";
import type { DB } from "./src/schema.d.ts";

// Connect to PostgREST (default port 3000)
const db = createAether<DB>({ baseUrl: "http://localhost:3000" });

// 1. Find active users older than 21
const users = await db.public.users.findMany({
  where: { 
    age: { $gt: 21 }, 
    status: "active" 
  },
  select: ["id", "username"] 
});

// 2. Create a new post (BigInt safe!)
await db.public.posts.create({
  title: "Aether is Fast",
  views: "9007199254740995" // Safe BigInt handling
});
```

## The Dialect DSL

Aether uses a MongoDB-like syntax that maps to PostgREST operators:

| Aether DSL | PostgREST | SQL Equivalent |
| :--- | :--- | :--- |
| `{ age: { $gt: 10 } }` | `age=gt.10` | `WHERE age > 10` |
| `{ tags: { $cs: ["news"] } }` | `tags=cs.{news}` | `WHERE tags @> '{news}'` |
| `{ id: { $in: [1, 2] } }` | `id=in.(1,2)` | `WHERE id IN (1, 2)` |
| `{ $or: [{ a: 1 }, { b: 2 }] }` | `or=(a.eq.1,b.eq.2)` | `WHERE a = 1 OR b = 2` |

## Project Structure

```
└── aether/
    ├── src/
    │   ├── oracle/    # Introspection & Codegen (Dev-time)
    │   └── runtime/   # Client Fabric & Proxy (Runtime)
    └── tests/         # Integration & Unit tests
```

## License

This project is licensed under the [MIT License](LICENSE).