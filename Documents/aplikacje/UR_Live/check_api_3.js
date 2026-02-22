const fs = require('fs');
const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21001730';

async function test() {
    // 01 Jan 2025 to 22 Feb 2026
    const from = new Date("2025-01-01T00:00:00Z").getTime();
    const to = new Date("2026-02-22T00:00:00Z").getTime();

    const url = `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=${from}&to=${to}`;

    console.log(`\nTEST URL: ${url}`);
    const sRes = await fetch(url, { headers: { "ApiKey": apiKey } });
    console.log(`Status: ${sRes.status}`);
    const text = await sRes.json();
    console.log("Count:", Array.isArray(text) ? text.length : text.items?.length, "Items in JSON");
    if (text && text.length > 0) {
        console.log("First timestamp:", text[0].timestamp || text[0].time);
        console.log("Last timestamp:", text[text.length - 1].timestamp || text[text.length - 1].time);
    }
}
test();
