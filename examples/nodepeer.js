const http = require('http');
const puppeteer = require('puppeteer');
const express = require('express');
const net = require('net');

let app = express();

app.use(express.static(__dirname + '/server/public'));

async function main() {
  const server = http.createServer(app);

  const findAvailablePort = (port, callback) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        callback(false);
      } else {
        callback(true, err);
      }
    });
    server.once('listening', () => {
      const actualPort = server.address().port;
      server.close();
      callback(true, null, actualPort);
    });
    server.listen(port);
  };

  const startServer = async (port) => {
    await server.listen(port, () => {
      console.log('Server is listening on port ' + port);
      launchPuppeteer(port);
    });
  };

  const launchPuppeteer = async (port) => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Expose a Node.js function to the browser
    await page.exposeFunction('nodeConsoleLog', message => {
      // console.log(message);
    });

    // Log any console messages from the page
    page.on('console', async msg => {
      if (
        msg.text().includes('WebSocket connection to') ||
        msg.text().includes('Failed to load resource') ||
        msg.text().includes('[NODE]')
      ) {
        return;
      }
      for (let arg of msg.args()) {
        let output = await arg.jsonValue();
        if (typeof output === 'object') return;
        let outputString = await arg.jsonValue();
        if (typeof outputString !== 'string') return; // ensure outputString is a string
      }
      console.log(msg.text());
    });

    // Navigate to your page
    await page.goto('http://localhost:' + port);

    // Wait until 'easypeers' is defined
    await page.waitForFunction('typeof easypeers !== "undefined"');

    // Handle input from the Node.js console
    process.stdin.on('data', async data => {
      // convert Buffer to string
      const input = data.toString().trim();
      //if(input === last) return

      // The `easypeers.send` function should be accessible if it's defined in the page's scripts
      await page.evaluate(input => {
        function isValidJSON(json) {
          try {
            JSON.parse(json);
            return true;
          } catch (e) {
            return false;
          }
        }

        if (
          typeof easypeers !== 'undefined' &&
          typeof easypeers.send === 'function'
        ) {
          if (isValidJSON(input) && (input.length !== 0 || Object.keys(input).length !== 0)) {
            try {
              message = JSON.parse(input);
              if (message.to) {
                easypeers.send(message.to, message.message);
              }
            } catch (e) {
              easypeers.send(input);
            }
          } else {
            easypeers.send(input);
          }
        }
      }, input); // pass the string input to the page function
    });
  };

  const findAvailablePortAndStartServer = (port) => {
    findAvailablePort(port, (isAvailable, err, actualPort) => {
      if (err) {
        console.error('An error occurred:', err);
        return;
      }

      if (isAvailable) {
        startServer(actualPort);
      } else {
        console.log(`Port ${port} is already in use. Trying a different port...`);
        findAvailablePortAndStartServer(0); // Let the OS assign an available port dynamically
      }
    });
  };

  findAvailablePortAndStartServer(3000);
}

main();
