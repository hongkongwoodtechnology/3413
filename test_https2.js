const https = require('https');

https.get('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?lang=zh-Hant', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    let d = JSON.parse(data);
    if(d.events && d.events.length > 0) {
      console.log(d.events[0].date);
      console.log(d.events[0].name);
      console.log(d.events[0].status.type);
    }
  });
}).on("error", (err) => { console.log("Error: " + err.message); });