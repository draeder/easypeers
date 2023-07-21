# Easypeers
> Easy *serverless* swarms of WebRTC peers over WebTorrent

Connect peers together based on a shared topic and send direct or broadcast messages using a gossip protocol.

- Partial mesh network
- Automatic peer rebalancing
- Self-healing
- Logically unlimited peers per mesh

Works in both node and the browser!

> Due to an unresolvble issue with the [node-wrtc](https://github.com/node-webrtc/node-webrtc) library (inexplicable segmentation faults), the node instances are now headless instances of a browser. Modifications to the API code are done in `examples\server\public\index.html`.

> The current version has introduced a number of improvements as well as changes to usage. An update to API documentation is forthcoming.

## Install
```
npm i easypeers
```
## Usage
### Node
Run a local node peer

```js
> npm start
```

This creates a an express server which serves up the files in `examples/server/public`. The instance also acts as a peer on the network.

Use the terminal to send messages and recieve messages between peers.

### Browser
Once a node peer is running you may connect to it in the browser with `http://localhost:3000`. 

Alternatively, you may create a non-peer node instance that your browser can talk to on port 3000 by using `npm run serve`. 

Note, if you are running a node peer already, the instance will crash because port 3000 will already be in use on that node peer instance.

Then, use the browser developer tools console to send messages: `easypeers.send('your message')`

Alternatively, you may also add the CDN script tag to your html file, which works without the need to host on a server.

```html
<script src='https://cdn.jsdelivr.net/gh/draeder/easypeers/dist/easypeers.dist.js'></script>
```

## Partial Mesh
> A partial mesh helps minimize peer connections per peer. This reduces load.

Configuring the `opts.maxPeers` value limits the number of peer connections per peer instance. Depending on your usecase, `opts.maxPeers = 6` appears to keep the network in tact through automatic peer rebalancing and network self-healing.

## Gossip Protocol
> A gossip protocol is needed in partial mesh networks for peers to reach other peers they are not directly connected to.

Easypeers does this by having each peer route the message to all peers it knows about. It performs message deduplication by taking a sha1 hash of the message itself plus a random number which becomes the message ID. It further deduplicates messages by adding which peer IDs have already received the message to the message. In this way, peers gossip the message to their own known peers (except those that already recieved it), ultimately reaching full network saturation.

> Object ish messages are tricky because of using puppeteer

To send a message that you want to later be serialized as a parsable object, you will need to wrap the object with backticks like 
```js
`[]`
```
Then remove the backticks on the receiving peer(s). From there you may use `JSON.parse()`.

Direct messaging is now fully functional and uses peer ID hash "closeness" to create a shortest path through the partial mesh.

Broadcast messaging also now works with shortest path routing. By adjusting the coverage ratio, it is possible to have full mesh or partial mesh, and even what amounts to token ring networking.

## Security
> Easypeers is not secure in its current revision

As it is now, any peer can potentially both see and alter any message, including in ways that cause network flooding, effectively DDoS'ing the entire mesh. This is under review.

If you use this library, it is important to understand that it is experimental and currently designed for use as a raw protocol. You might consider applying your own security/encryption, or submitting a PR to help with Easypeers.

### Update
Easypeers now uses Zero Knowledge Proof for swarm identification, sender authenticity verification and message integrity. If proof fails at any state of message propagation on any peer, the peer will cease propagating the message.


# API Usage
## Node
### Example
> The native `node-webrtc` library used by webtorrent and simple-peer may cause segmentation fault errors. Check out the nodepeer.js example in `examples/nodepeer.js` for a workaround.

```js
const Easypeers = require('easypeers')

const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 6,
  coverage: 0.33,
  bitLength: 64,
  tracker: 'ws://localhost:8000',
  debug: false,
})

easypeers.on('message', data => {
  if(!data) return
  console.log(data.message.toString().trim())
  // console.log(JSON.stringify(data))
  // console.log(Object.keys(data.has).length)
  // if(easypeers.isValidJSON(data.message)) {
  //  let dataObj = JSON.parse(data.message)
  //  console.log(dataObj)
  // }
})

easypeers.once('connect', peer => {
  // Do something with connect events like:
  console.log('Peer connected!', peer, '\r\nWires:', easypeers.wireCount)
  console.log("Swarm id: " +  easypeers.identifier)
  console.log('My address: ' + easypeers.address)
  console.log('Connected to Easypeers')
})

easypeers.on('disconnect', peer => {
  // Do something with disconnect events like:
  // console.log('Peer disconnected!', peer)
})
```

## Browser
```html
<script src='https://cdn.jsdelivr.net/gh/draeder/easypeers/dist/easypeers.dist.js'></script>
<script>
const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 6,
  coverage: 0.33,
  bitLength: 64,
  tracker: 'ws://localhost:8000',
  debug: false,
})

easypeers.on('message', data => {
  if(!data) return
  console.log(data.message.toString().trim())
  // console.log(JSON.stringify(data))
  // console.log(Object.keys(data.has).length)
  // if(easypeers.isValidJSON(data.message)) {
  //  let dataObj = JSON.parse(data.message)
  //  console.log(dataObj)
  // }
})

easypeers.once('connect', peer => {
  // Do something with connect events like:
  console.log('Peer connected!', peer, '\r\nWires:', easypeers.wireCount)
  console.log("Swarm id: " +  easypeers.identifier)
  console.log('My address: ' + easypeers.address)
  console.log('Connected to Easypeers')
})

easypeers.on('disconnect', peer => {
  // Do something with disconnect events like:
  // console.log('Peer disconnected!', peer)
})
</script>
```

# Methods
## `easypeers.send(message[string])`
Send message to all peers in the mesh with hearest address routing

## `eeasypeers.send(address[string], message[string])`
Send direct message to destination address address with nearest address routing

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
Set or return the configured swarm identifier. This must be a sha1 hash and is created by default from the passed in topic string

## `easypeers.address`
Set or return the configured peer ID. This must be a sha1 hash and is created by default

## `easypeers.maxPeers` [[integer]]
Set or return the configured maxPeers. The default is 6.

## `easypeers.timeout` [[integer]]
Set or return the reannouce timeout in milliseconds. The default is 30 * 1000 (30 seconds).

