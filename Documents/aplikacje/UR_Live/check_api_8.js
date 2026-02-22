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
            console.log(`First: ${new Date(items[0].timestamp || items[0].time).toISOString()}`);
            console.log(`Last:  ${new Date(items[items.length - 1].timestamp || items[items.length - 1].time).toISOString()}`);
        }
    } catch (e) { console.log(e.message); }
}

async function run() {
    // We want data from Feb 11 to Feb 12
    const fromStr = "2026-02-11T00:00:00.000Z";
    const toStr = "2026-02-12T00:00:00.000Z";
    const fromMs = new Date(fromStr).getTime();
    const toMs = new Date(toStr).getTime();
    const fromSec = Math.floor(fromMs / 1000);
    const toSec = Math.floor(toMs / 1000);

    const base = `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples`;

    await testUrl("MS from/to", `${base}?from=${fromMs}&to=${toMs}`);
    await testUrl("SEC from/to", `${base}?from=${fromSec}&to=${toSec}`);
    await testUrl("MS start/end", `${base}?start=${fromMs}&end=${toMs}`);
    await testUrl("SEC start/end", `${base}?start=${fromSec}&end=${toSec}`);
    await testUrl("ISO startDate/endDate", `${base}?startDate=${fromStr}&endDate=${toStr}`);
    await testUrl("ISO fromDate/toDate", `${base}?fromDate=${fromStr}&toDate=${toStr}`);
    await testUrl("MS startTime/endTime", `${base}?startTime=${fromMs}&endTime=${toMs}`);
}

run();
