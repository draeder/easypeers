# Easypeers
> Easy *serverless* swarms of WebRTC peers over WebTorrent

Connect peers together based on a shared topic and send direct(<== work in progress) or broadcast messages using a gossip protocol.

- Partial mesh network
- Automatic peer rebalancing
- Self-healing
- Logically unlimited peers per mesh

Works in both node and the browser!

> Due to an unresolvble issue with the [node-wrtc](https://github.com/node-webrtc/node-webrtc) library (inexplicable segmentation faults), the node instances are now headless instances of puppeteer. Modifications to the API code are done in `examples\server\public\index.html`.

## Install
```
npm i easypeers
```
## Run the examples
### Node
Run a local server
```js
> npm run serve
```

Run a local peer instance on node.
```js
> npm run start
```
Use the terminal to send messages and recieve messages between peers.

### Browser
With your local server running, browse to `http://localhost:3000`.

Use the browser developer tools console to send messages: `easypeers.send('your message')`

## Partial Mesh
> A partial mesh helps minimize peer connections per peer. This reduces load.

Configuring the `opts.maxPeers` value limits the number of peer connections per peer instance. Depending on your usecase, `opts.maxPeers = 6` appears to keep the network in tact through automatic peer rebalancing and network self-healing.

## Gossip Protocol
> A gossip protocol is needed in partial mesh networks for peers to reach other peers they are not directly connected to.

Easypeers does this by having each peer route the message to all peers it knows about. It performs message deduplication by taking a sha1 hash of the message itself plus a random number which becomes the message ID. It further deduplicates messages by adding which peer IDs have already received the message to the message. In this way, peers gossip the message to their own known peers (except those that already recieved it), ultimately reaching full network saturation.

> Direct messaging is currently under development

Direct messaging should be relatively trivial now that broadcast messaging works as expected. The intent is to allow for sending messages from one peer to another, or a group of others.

## Security
> Easypeers is not secure in its current revision

As it is now, any peer can potentially both see and alter any message, including in ways that cause network flooding, effectively DDoS'ing the entire mesh. This is under review.

If you use this library, it is important to understand that it is experimental and currently designed for use as a raw protocol. You might consider applying your own security/encryption, or submitting a PR to help with Easypeers.

### Update
Easypeers now uses Zero Knowledge Proof for swarm identification, sender authenticity verification and message integrity. If proof fails at any state of message propagation on any peer, the peer will cease propagating the message.


# API Usage
## Node
### Example
```js
const Easypeers = require('easypeers')

const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 6
})

console.log('My address:', easypeers.address)

easypeers.on('message', data => {
  console.log(data.message.trim())
})

easypeers.on('connect', peer => {
  console.log('Peer connected!', peer, '\r\nWires:', easypeers.wireCount)
})

easypeers.on('disconnect', peer => {
  console.log('Peer disconnected!', peer)
})

// Send messages to peers from the terminal
process.stdin.on('data', data => {
  easypeers.send(data)
})
```

## Browser
> CDN script tag coming soon

# Methods
## `easypeers.send([string])`
Send messages to other peers

# Events
## `easypeers.on('connect', peer => callback)`
Returns the peer address of every newly connected peer

## `easypeers.once('connect', peer => callback)`
Returns the peer address of only the first connected peer, but peers will continue to connect/rebalance

## `easypeers.off('connect')`
Stops listening for new peer events, but peers will continue to connect/rebalance

## `easypeers.on('message', data => callback)`
Returns new messages from peers

## `easypeers.once('message', data => callback)`
Returns a message only once, then stops listening for new messages

## `easypeers.off('message')`
Stops listening for new messages

# Properties
## `easypeers.identifier` [[string]]
Set or return the configured swarm identifier. This must be a sha1 hash and is created by default from the passed in topic string.

## `easypeers.address`
Set or return the configured peer ID. This must be a sha1 hash and is created by default.

## `easypeers.maxPeers` [[integer]]
Set or return the configured maxPeers. The default is 6.

## `easypeers.timeout` [[integer]]
Set or return the reannouce timeout in milliseconds. The default is 30 * 1000 (30 seconds).

