const http = require('http')
const puppeteer = require('puppeteer')
const express = require('express')
const net = require('net')

let app = express()

app.use(express.static(__dirname + '/server/public'))

async function main() {
  const server = http.createServer(app)

  const findAvailablePort = (port, callback) => {
    const server = net.createServer()
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        callback(false)
      } else {
        callback(true, err)
      }
    })
    server.once('listening', () => {
      const actualPort = server.address().port
      server.close()
      callback(true, null, actualPort)
    })
    server.listen(port)
  }

  const startServer = async (port) => {
    await server.listen(port, () => {
      console.log('Server is listening on port ' + port)
      launchPuppeteer(port)
    })
  }

  const launchPuppeteer = async (port) => {
    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    // Expose a Node.js function to the browser
    await page.exposeFunction('nodeConsoleLog', message => {
      // console.log(message)
    })

    // Log any console messages from the page
    page.on('console', async msg => {
      if (
        msg.text().includes('WebSocket connection to') ||
        msg.text().includes('Failed to load resource') ||
        msg.text().includes('[NODE]')
      ) {
        return
      }
      for (let arg of msg.args()) {
        let output = await arg.jsonValue()
        if (typeof output === 'object') return
        let outputString = await arg.jsonValue()
        if (typeof outputString !== 'string') return // ensure outputString is a string
      }
      
      let message = msg.text()
      if (message instanceof Uint8Array) {
        const decoder = new TextDecoder('utf-8')
        message = decoder.decode(message)
      }
      if (Buffer.isBuffer(message)) {
        message = message.toString('utf-8')
      }
      console.log(message)
    })

    // Navigate to your page
    await page.goto('http://localhost:' + port)

    // Wait until 'easypeers' is defined
    await page.waitForFunction('typeof easypeers !== "undefined"')

    // Handle input from the Node.js console
    process.stdin.on('data', async (data) => {
      let input = data
      if(Buffer.isBuffer(input)) {
        input = input.toString('utf-8').trim() // Trim the string here
      }
      try {
        // Attempt to parse the stringified data as JSON
        let parsed = JSON.parse(input);
        input = JSON.stringify(parsed);
      } catch {
        // Don't stringify if it's already a string
      }
    
      // Set the value of the hidden input field in the browser
      await page.evaluate((input) => {
        const hiddenInput = document.getElementById('hiddenInput')
        hiddenInput.value = input
      }, input)
    
      // Trigger an event or execute a script in the browser to process the received value
      await page.evaluate(() => {
        const hiddenInput = document.getElementById('hiddenInput')
        const value = hiddenInput.value
    
        if (
          typeof easypeers !== 'undefined' &&
          typeof easypeers.send === 'function'
        ) {
          easypeers.send(value)
        }
      })
    })
  }

  const findAvailablePortAndStartServer = (port) => {
    findAvailablePort(port, (isAvailable, err, actualPort) => {
      if (err) {
        console.error('An error occurred:', err)
        return
      }

      if (isAvailable) {
        startServer(actualPort)
      } else {
        console.log(`Port ${port} is already in use. Trying a different port...`)
        findAvailablePortAndStartServer(0) // Let the OS assign an available port dynamically
      }
    })
  }

  findAvailablePortAndStartServer(3000)
}

main()
