
const https = require('https');

const url = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard";

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Status Code:", res.statusCode);
      console.log("Events found:", json.events ? json.events.length : 0);
      if (json.events && json.events.length > 0) {
          const event = json.events[0];
          console.log("Sample Event:", JSON.stringify({
              name: event.name,
              competitors: event.competitions[0].competitors.map(c => ({ 
                  team: c.team.displayName, 
                  homeAway: c.homeAway,
                  score: c.score 
              }))
          }, null, 2));
      }
    } catch (e) {
      console.error("Error parsing JSON:", e.message);
    }
  });

}).on("error", (err) => {
  console.error("Error: " + err.message);
});
