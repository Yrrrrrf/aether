set dotenv-load := true

# Generate types from DB (reads DB_URL from .env)
[group('oracle')]
generate:
    deno run --allow-net --allow-read --allow-write --allow-env src/oracle/cli.ts --url=$DB_URL --out=./src/aether.d.ts
    @echo "✅ Types generated!"

# Run unit tests (no infra needed)
[group('test')]
test:
    deno test tests/unit/

# Run all tests (requires containers to be running)
[group('test')]
test-all prest="0" supabase="1":
    TEST_PREST={{ prest }} TEST_SUPABASE={{ supabase }} deno test --allow-net --allow-read --allow-write --allow-env tests/

# Format + lint + unit tests
[group('quality')]
ci:
    deno fmt
    deno lint
    deno test
    # just test-all  # defualt test all
