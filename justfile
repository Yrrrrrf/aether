set dotenv-load

# Generate types from DB (reads DB_URL from .env)
[group('oracle')]
generate:
    deno run --allow-net --allow-read --allow-write --allow-env src/oracle/cli.ts --url=$DB_URL --out=./src/aether.d.ts
    @echo "✅ Types generated!"

# Run unit tests (no infra needed)
[group('test')]
test:
    deno test tests/unit/

# Run all tests (requires Docker stack)
[group('test')]
test-all:
    deno test --allow-net --allow-read --allow-write --allow-env tests/

# Format + lint + unit tests
[group('quality')]
ci:
    deno fmt
    deno lint
    deno test
