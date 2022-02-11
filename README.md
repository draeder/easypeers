# Easypeers
> Easy *serverless* swarms of WebRTC peers over WebTorrent

Connect peers together based on a shared topic and send direct or broadcast messages using a gossip protocol.

- Partial or full-mesh
- Self-healing swarms when peer count is unlimited
- Total peer count of the swarm can unlimited or limited
- Includes a partial mesh coverage ratio

Works in both node and the browser!

## Example
Don't mind the clutter here. 
### Node
```js
> node examples/example.js

const Easypeers = require('..')
```
Use the terminal to send messages: `> message`

### Browser
```js
> /path/to/repo/easypeers/examples/browser/index.html
```
Use the console to send messages: `easypeers.send('message')`

```js
const easypeers = new Easypeers('Testing 123454', {maxPeers: 3, coverage: -1})
console.log('My address:', easypeers.address)
easypeers.on('message', message => {
  console.log(message)
})
easypeers.on('connect', peer => {
  console.log('Peeer connected!', peer)
})
easypeers.on('disconnect', peer => {
  console.log('Peeer disconnected!', peer)
})
```

## Partial Mesh
Partial mesh connectivity is determined using the `opts.coverage` ratio and `opts.maxPeers` number passed into the Easypeers constructor. It uses a simple distance algorithm that checks seen peers for how 'close' those peers are, then takes a sample of those peers based on the passed in `opts.coverage` ratio. If the peers are 'close', they are kept. Even if the total number of peers exceeds the `opts.maxPeers` parameter. But only up to the number of peers found using the `opts.coverage` ratio.

## Gossip Protocol
