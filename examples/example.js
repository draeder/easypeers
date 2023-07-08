const Easypeers = require('../index.js')

const easypeers = new Easypeers('Some unique topic', {
  maxPeers: 6,
  identifier: 'd385a562d5ad561f7130e51cb3c65b9fa08ae96e',
  tracker: 'ws://localhost:8000'
})

console.log("Swarm id:", easypeers.identifier)
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
  if(data.toString().trim() == '_wires') return console.log(easypeers.wireCount)
  easypeers.send(data)
})