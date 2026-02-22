const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21001730';

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
            console.log(`First: ${new Date(items[0].timestamp || items[0].time).toISOString()}`);
            console.log(`Last:  ${new Date(items[items.length - 1].timestamp || items[items.length - 1].time).toISOString()}`);
        }
    } catch (e) { console.log(e.message); }
}

async function run() {
    // User requested Feb 15 to Feb 22 (from previous screenshot):
    const fromPReqStr = "2026-02-15T00:00:00.000Z";
    const toPReqStr = "2026-02-22T00:00:00.000Z";
    const fromPReqMs = new Date(fromPReqStr).getTime();
    const toPReqMs = new Date(toPReqStr).getTime();

    const base = `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples`;

    await testUrl("Feb 15 - Feb 22 2026", `${base}?from=${fromPReqMs}&to=${toPReqMs}`);
    await testUrl("NO LIMITS", `${base}?limit=100`);
}

run();
