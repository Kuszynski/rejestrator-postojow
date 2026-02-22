const fs = require('fs');
const apiKey = 'jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=';
const systemId = 'nIwosVxCrK9RTctvb90X';
const targetSn = '21001730';

async function test() {
    const urls = [
        `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${targetSn}/samples?from=1771633540994&to=1771719940994`,
        `https://api.neuronsensors.app/v1/systems/${systemId}/devices/${targetSn}/samples?from=1771633540994&to=1771719940994`,
        `https://api.neuron.no/v2/systems/${systemId}/devices/${targetSn}/samples?from=1771633540994&to=1771719940994`,
    ];

    for (const url of urls) {
        console.log(`\nTEST URL: ${url}`);
        const sRes = await fetch(url, { headers: { "ApiKey": apiKey, "Authorization": `Bearer ${apiKey}` } });
        console.log(`Status: ${sRes.status}`);
        const text = await sRes.text();
        console.log(text.substring(0, 300));
    }
}
test();
