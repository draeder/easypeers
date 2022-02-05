const Easypeers = require('.')

let easypeers = new Easypeers('Test identifierasdf')
console.log('Topic address:', easypeers.identifier)
console.log('Peer address:', easypeers.address)

easypeers.on('connection', peer => {
  console.log('\r\n', peer, 'connected!')
  console.log(easypeers.connections)
})

process.stdout.on('data', data => {
  data = data.toString().split('> ')
    if(data[0] && data[1]) easypeers.send(data[0], data[1].toString().trim())
    else easypeers.send(data.toString().trim())
})

easypeers.on('message', message => {
  console.log(message)
})

easypeers.once('noPeer', peer => {
  console.log('Peer not found', peer)
})

easypeers.on('disconnected', peer => {
  console.log(peer, 'disconnected')
  console.log(easypeers.connections)
})
