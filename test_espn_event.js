fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=740896')
  .then(r => r.json())
  .then(d => {
    console.log(d.header.competitions[0].status.type);
  })
  .catch(console.error);