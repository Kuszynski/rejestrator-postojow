const fs = require('fs');
const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21009914';

async function test() {
    let log = "";
    const print = (m) => { console.log(m); log += m + "\n"; };

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Test Unix Milliseconds
    const fromMs = yesterday.getTime();
    const toMs = now.getTime();

    // Test Unix Seconds
    const fromSec = Math.floor(fromMs / 1000);
    const toSec = Math.floor(toMs / 1000);

    const urls = [
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=${fromMs}&to=${toMs}`,
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=${fromSec}&to=${toSec}`,
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?start=${fromMs}&end=${toMs}`,
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?startDate=${fromMs}&endDate=${toMs}`,
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
    fs.writeFileSync('api_debug.txt', log, 'utf8');
}

test();
