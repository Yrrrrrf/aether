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
# Usage: just test-all            → runs both (prest=1, supabase=1)
#        just test-all 0          → skips prest, runs supabase
#        just test-all 0 0        → skips both
#        just test-all 1 0        → runs prest, skips supabase
[group('test')]
test-all prest="1" supabase="1":
    TEST_PREST={{prest}} TEST_SUPABASE={{supabase}} deno test --allow-net --allow-read --allow-write --allow-env tests/
# Format + lint + unit tests
[group('quality')]
ci:
    deno fmt
    deno lint
    deno test
