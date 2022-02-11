const Easypeers = require('..')

// API testing
// opts.coverage = ratio of max peers to connect; 0 = full mesh, 1 = limit to maxPeers, default = 1
// opts.maxPeers can be exceeded if coverage is less than 1
// This is to ensure maximum connectivity.
// opts.coverage = -1 limits the total number of members of the swarm to maxPeers.
// In that case, the total number of members of the swarm will be n(n+1) where n = maxPeers
// Note: this is full mesh
// coverage = 0.3 with maxPeers = 6
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