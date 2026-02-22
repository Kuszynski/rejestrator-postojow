const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21009914';

async function test() {
    let log = "";
    const print = (m) => { console.log(m); log += m + "\n"; };

    // From 01 Oct 2025 to 22 Feb 2026
    const fromDate = new Date("2025-10-01T00:00:00.000Z");
    const toDate = new Date("2026-02-22T00:00:00.000Z");

    const urls = [
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=${fromDate.getTime()}&to=${toDate.getTime()}&limit=10000`,
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?startDate=${fromDate.toISOString()}&endDate=${toDate.toISOString()}&limit=10000`,
    ];

    for (const url of urls) {
        print(`\nTEST URL: ${url}`);
        const sRes = await fetch(url, { headers: { "ApiKey": apiKey } });
        print(`Status: ${sRes.status}`);
        if (sRes.ok) {
            const data = await sRes.json();
            const items = Array.isArray(data) ? data : (data.items || []);
            print(`Count: ${items.length}`);
            if (items.length > 0) {
                print(`Sample 0 time: ${items[0].timestamp || items[0].time}`);
                print(`Sample last time: ${items[items.length - 1].timestamp || items[items.length - 1].time}`);
            }
        }
    }
}
test();
