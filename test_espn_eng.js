fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard')
  .then(r => r.json())
  .then(d => {
    if(d.events && d.events.length > 0) {
      console.log(d.events[0].date);
      console.log(d.events[0].name);
      console.log(d.events[0].status.type);
    }
  })
  .catch(console.error);