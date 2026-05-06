
const fetch = require('node-fetch');

async function testEspnLang(lang) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?lang=${lang}`;
  console.log(`Fetching: ${url}`);
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.leagues && data.leagues.length > 0) {
      console.log(`League Name (${lang}):`, data.leagues[0].name);
    }
    
    if (data.events && data.events.length > 0) {
      const event = data.events[0];
      const competition = event.competitions[0];
      const home = competition.competitors.find(c => c.homeAway === 'home');
      const away = competition.competitors.find(c => c.homeAway === 'away');
      
      console.log(`Match: ${home.team.displayName} vs ${away.team.displayName}`);
    } else {
      console.log("No events found.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

(async () => {
  await testEspnLang('en');
  await testEspnLang('zh-Hant'); // Traditional Chinese
  await testEspnLang('zh-Hans'); // Simplified Chinese
  await testEspnLang('es');
})();
