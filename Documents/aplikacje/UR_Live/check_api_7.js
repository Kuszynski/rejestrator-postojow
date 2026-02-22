// Weryfikacja parametrów 'cursor' lub 'offset' lub 'page' lub zmiana kolejności sortowania dla API Neurona.
const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21009914';

async function test() {
    let log = "";
    const print = (m) => { console.log(m); log += m + "\n"; };

    // Szukajmy malutkiego okresu dawno temu - luty 11 do 12 2026.
    const fromDate = new Date("2026-02-11T09:58:00.000Z").getTime();
    const toDate = new Date("2026-02-12T09:58:00.000Z").getTime();

    // Sprawdźmy listę dostępnych dokumentacji - czy działa limit i skip, albo after
    const urls = [
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=${fromDate}&to=${toDate}&limit=10000`,
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?startDate=${fromDate}&endDate=${toDate}&limit=10000`,
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
