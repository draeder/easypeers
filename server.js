const puppeteer = require('puppeteer')

async function main() {
  const browser = await puppeteer.launch({headless: "new"})
  const page = await browser.newPage()

  // Expose a Node.js function to the browser
  await page.exposeFunction('nodeConsoleLog', message => {
    // console.log(message)
  })

  // Log any console messages from the page
  page.on('console', async msg => {
    if(msg.text().includes('WebSocket connection to')
    || msg.text().includes('Failed to load resource')) 
    return
    for (let arg of msg.args()) {
      let output = await arg.jsonValue()
      if(typeof output === 'object') return
      console.log(await arg.jsonValue())
    }
  })

  // Navigate to your page
  await page.goto('http://localhost:3000')

  // Wait until 'easypeers' is defined
  await page.waitForFunction('typeof easypeers !== "undefined"')
  // Handle input from the Node.js console
  process.stdin.on('data', async data => {
    // The `easypeers.send` function should be accessible if it's defined in the page's scripts
    await page.evaluate(data => {
      function isValidJSON(json) {
        try {
            JSON.parse(json)
            return true
        } catch (e) {
            return false
        }
      }
      
      if (typeof easypeers !== 'undefined' && typeof easypeers.send === 'function') {
        if(isValidJSON(data) && (data.length !== 0 || Object.keys(data).length !== 0)){
          try {
            message = JSON.parse(data)
            if(message.to){
              easypeers.send(message.to, message.message)
            }
          } catch(e) {
            easypeers.send(data)
          }
        } else {
          easypeers.send(data)
        }
      }
    }, data.toString())
  })

  process.stdin.on('error', (err) => {
    console.error('An error occurred:', err)
  })
}

main()
