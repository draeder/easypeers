const Easypeers = require('../index.js')

const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 1,
  identifier: '', // used to pass in a static identifier (under development)
  tracker: 'ws://localhost:8000'
})

console.log("Swarm id:", easypeers.identifier)
console.log('My address:', easypeers.address)

easypeers.on('message', data => {
  console.log(data.message.toString().trim())
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