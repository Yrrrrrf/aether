const BASE = "http://localhost:3000/chimera/public";

async function run() {
  console.log("🔍 Debugging pREST behavior...\n");

  // 1. Check Ordering Syntax
  console.log("1. Testing _order syntax...");
  const orderUrl = `${BASE}/users?_order=-age&_page_size=1`;
  const orderRes = await fetch(orderUrl);
  console.log(`   URL: ${orderUrl}`);
  console.log(`   Status: ${orderRes.status}`);
  console.log(`   Body: ${await orderRes.text()}\n`);

  // 2. Check findOne (Array vs Object)
  console.log("2. Testing Single Item Response...");
  const singleUrl = `${BASE}/users?_page_size=1`;
  const singleRes = await fetch(singleUrl, {
    headers: { "Accept": "application/vnd.pgrst.object+json" }, // Standard PostgREST header
  });
  console.log(`   URL: ${singleUrl}`);
  console.log(`   Status: ${singleRes.status}`);
  const text = await singleRes.text();
  console.log(`   Is Array? ${text.startsWith("[")}`);
  console.log(`   Body: ${text}\n`);
}

run();
