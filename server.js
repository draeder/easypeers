const puppeteer = require('puppeteer')
const readline = require('readline')

async function main() {
  const browser = await puppeteer.launch({ headless: "new" })
  const page = await browser.newPage()

  // Expose a Node.js function to the browser
  await page.exposeFunction('nodeConsoleLog', message => {
    // console.log(message)
  })

  // Log any console messages from the page
  page.on('console', async msg => {
    if (
      msg.text().includes('WebSocket connection to')
      || msg.text().includes('Failed to load resource')
      || msg.text().includes('[NODE]')
    ) {
      return
    }
    for (let arg of msg.args()) {
      let output = await arg.jsonValue()
      if (typeof output === 'object') return
      let outputString = await arg.jsonValue()
      if (typeof outputString !== 'string') return // ensure outputString is a string
    }
    console.log(msg.text())
  })

  // Navigate to your page
  await page.goto('http://localhost:3000')

  // Wait until 'easypeers' is defined
  await page.waitForFunction('typeof easypeers !== "undefined"')

  // Handle input from the Node.js console
  process.stdin.on('data', async data => {
    // convert Buffer to string
    const input = data.toString().trim()
    //if(input === last) return
  
    // The `easypeers.send` function should be accessible if it's defined in the page's scripts
    await page.evaluate(input => {
      function isValidJSON(json) {
        try {
          JSON.parse(json)
          return true
        } catch (e) {
          return false
        }
      }
  
      if (typeof easypeers !== 'undefined' && typeof easypeers.send === 'function') {
        if (isValidJSON(input) && (input.length !== 0 || Object.keys(input).length !== 0)) {
          try {
            message = JSON.parse(input)
            if (message.to) {
              easypeers.send(message.to, message.message)
            }
          } catch (e) {
            easypeers.send(input)
          }
        } else {
          easypeers.send(input)
        }
      }
    }, input) // pass the string input to the page function
  })
}

main()

