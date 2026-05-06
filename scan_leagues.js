const fs = require('fs');

async function scanLiveScore() {
    const today = new Date();
    const dateStrs = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10).replace(/-/g, '');
    });

    const uniqueStages = new Set();
    const allStages = [];

    console.log("Scanning LiveScore for the next 14 days...");

    for (const dateStr of dateStrs) {
        try {
            const res = await fetch(`https://prod-public-api.livescore.com/v1/api/app/date/soccer/${dateStr}/0`);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.Stages) {
                for (const stage of data.Stages) {
                    const key = `${stage.Cnm} - ${stage.Snm}`;
                    if (!uniqueStages.has(key)) {
                        uniqueStages.add(key);
                        allStages.push({ country: stage.Cnm, league: stage.Snm });
                    }
                }
            }
        } catch (e) {
            console.error(`Error fetching ${dateStr}:`, e.message);
        }
    }

    console.log(`Found ${allStages.length} unique leagues/cups in the next 14 days.`);
    
    // Check against target keywords
    const targets = [
        'Champions', 'Europa', 'Conference', 'Libertadores', 'Sudamericana',
        'CONCACAF', 'Saudi', 'Norway', 'Eliteserien', 'League One', 'League Two',
        'Russian Cup', 'U20', 'AFC', 'Australia Cup'
    ];

    const matches = allStages.filter(s => 
        targets.some(t => s.league.toLowerCase().includes(t.toLowerCase()) || s.country.toLowerCase().includes(t.toLowerCase()))
    );

    console.log("\n--- POTENTIAL MATCHES FOR MISSING LEAGUES ---");
    matches.forEach(m => console.log(`${m.country} | ${m.league}`));

    fs.writeFileSync('livescore_dump.json', JSON.stringify(allStages, null, 2));
    console.log("\nFull dump saved to livescore_dump.json");
}

scanLiveScore();