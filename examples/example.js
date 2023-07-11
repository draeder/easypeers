const Easypeers = require('../index.js')

const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 6,
  identifier: '', // used to pass in a static identifier (under development)
  address: '', // used to pass in a staic peer address, needs work
  tracker: 'ws://localhost:8000'
})

console.log("Swarm id:", easypeers.identifier)
console.log('My address:', easypeers.address)

easypeers.on('message', data => {
  console.log(data.message.toString().trim())
})

easypeers.once('connect', peer => {
  // Do something with connect events like:
  // console.log('Peer connected!', peer, '\r\nWires:', easypeers.wireCount)
  console.log('Connected to Easypeers')
})

easypeers.on('disconnect', peer => {
  // Do something with disconnect events like:
  // console.log('Peer disconnected!', peer)
})

// Send messages to peers from the terminal
process.stdin.on('data', data => {
  easypeers.send(data)
})