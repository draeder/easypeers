const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();

  // Expose a Node.js function to the browser
  await page.exposeFunction('nodeConsoleLog', message => {
    console.log(message);
  });

  // Log any console messages from the page
  page.on('console', msg => {
    if(msg.text().includes('WebSocket connection to')
    || msg.text().includes('Failed to load resource')) 
    return
    console.log(msg.text())
  });

  // Navigate to your page
  await page.goto('http://localhost:3000');

  // Wait until 'easypeers' is defined
  await page.waitForFunction('typeof easypeers !== "undefined"');

  // Handle input from the Node.js console
  process.stdin.on('data', async data => {
    // The `easypeers.send` function should be accessible if it's defined in the page's scripts
    await page.evaluate(data => {
      if (typeof easypeers !== 'undefined' && typeof easypeers.send === 'function') {
        easypeers.send(data);
      }
    }, data.toString());
  });

  process.stdin.on('error', (err) => {
    console.error('An error occurred:', err);
  });
}

main();
