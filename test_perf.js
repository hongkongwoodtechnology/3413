const start = Date.now();
fetch('http://localhost:3000/api/matches?lang=zh-TW')
  .then(r => r.json())
  .then(d => {
    console.log(`Time: ${Date.now() - start} ms, Items: ${d.length}`);
  })
  .catch(console.error);