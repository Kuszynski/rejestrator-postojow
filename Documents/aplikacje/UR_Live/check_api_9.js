const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21009914';

async function testUrl(name, url) {
    console.log(`\n--- [${name}] ---`);
    console.log(url);
    try {
        const res = await fetch(url, { headers: { "ApiKey": apiKey } });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        console.log(`Count: ${items.length}`);
        if (items.length > 0) {
            console.log(`First: ${items[0].timestamp || items[0].time}`);
            console.log(`Last:  ${items[items.length - 1].timestamp || items[items.length - 1].time}`);
        }
    } catch (e) { console.log(e.message); }
}

async function run() {
    // 01 Oct 2025 to 18 Feb 2026
    const fromStr = "2025-10-01T00:00:00.000Z";
    const toStr = "2026-02-18T00:00:00.000Z";
    const fromMs = new Date(fromStr).getTime();
    const toMs = new Date(toStr).getTime();

    // User requested Feb 11 to Feb 12:
    const fromReqStr = "2026-02-11T00:00:00.000Z";
    const toReqStr = "2026-02-12T00:00:00.000Z";
    const fromReqMs = new Date(fromReqStr).getTime();
    const toReqMs = new Date(toReqStr).getTime();

    // User requested Feb 15 to Feb 22 (from previous screenshot):
    const fromPReqStr = "2026-02-15T00:00:00.000Z";
    const toPReqStr = "2026-02-22T00:00:00.000Z";
    const fromPReqMs = new Date(fromPReqStr).getTime();
    const toPReqMs = new Date(toPReqStr).getTime();

    const base = `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples`;

    await testUrl("Oct 2025 - Feb 18 2026", `${base}?from=${fromMs}&to=${toMs}`);
    await testUrl("Feb 11 - Feb 12 2026", `${base}?from=${fromReqMs}&to=${toReqMs}`);
    await testUrl("Feb 15 - Feb 22 2026", `${base}?from=${fromPReqMs}&to=${toPReqMs}`);
    await testUrl("NO LIMITS", `${base}?limit=100`);

    // Let's check exactly what's failing in the exact same format
}

run();
