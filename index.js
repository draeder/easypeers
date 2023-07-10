const crypto = require('crypto')
const { EventEmitter } = require('events')
const WebTorrent = require('webtorrent-hybrid')
const Zerok = require('zerok')

EventEmitter.defaultMaxListeners = 25

const PREFIX = 'easypeers-'

const Easypeers = function(identifier, args){
  const easypeers = this

  zerok = new Zerok(256)

  if(typeof identifier === 'object'){
    easypeers.opts = {...identifier}
  } else {
    easypeers.opts = {...args}
  }

  const events = new EventEmitter()
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  easypeers.send = (data) => {easypeers.emit('_send', data)}
  easypeers.off = events.off.bind(events)

  easypeers.maxPeers = easypeers.opts.maxPeers || 6
  if(easypeers.maxPeers < 2) easypeers.maxPeers = 2
  easypeers.timeout = easypeers.opts.timeout || 30 * 1000
  easypeers.identifier = easypeers.opts.identifier
    || crypto.createHash('sha1').update(PREFIX+easypeers.opts.identifier).digest().toString('hex')
    || crypto.randomBytes(20).toString('hex')
  easypeers.address = easypeers.opts.address || crypto.randomBytes(20).toString('hex')


  // Generate a SHA-256 hash of the swarmId
  const hash = crypto.createHash('sha256')
  hash.update(easypeers.identifier)
  const seed = hash.digest()

  // // Generate a deterministic keypair based on the seed
  // const keyPair = ed25519.MakeKeypair(seed)

  // let publicKey = keyPair.publicKey.toString('hex')
  // let privateKey = keyPair.privateKey.toString('hex')

  easypeers.wires = {}
  let seen = {}

  let client = new WebTorrent({dht:true, lsd:false, peerId:easypeers.address})
  
  let opts = {
    infoHash: easypeers.identifier,
    peerId: easypeers.address,
    announce: [
      easypeers.opts.tracker ? easypeers.opts.tracker : '',
      'wss://tracker.peer.ooo',
      'wss://tracker.openwebtorrent.com',
    ],
    port: process ? easypeers.opts.port || 6881 : undefined
  }
  
  let torrent = client.add(opts)

  client.on('warning', err => {
    console.warning('Warning', err)
  })
  client.on('error', err => {
    console.error('Error', err)
  })

  // Unused functions to get the peerId of the furthest and closest connected peer
  // May use them at a later date
  function getFurthestPeer(peerId) {
    let diff = Object.keys(easypeers.wires).filter(x => {
      return x
    })
    
    let furthest
    if(diff.length > 0 && easypeers.address < diff[0]) {
      furthest = [diff[0]]
    } else {
      furthest = diff.filter(v => {
        return v > easypeers.address
      })
    }
    
    return furthest
  }
  
  function getClosestPeer(peerId){
    let diff = Object.keys(easypeers.wires).filter(x => {
      return x
    });
    
    let closest;
    if(diff.length > 0 && easypeers.address < diff[0]) {
      closest = [diff[0]]
    } else {
      closest = diff.filter(v => {
        return v < easypeers.address
      })
    }
    return closest
  }
  
  easypeers.wireCount = 0
  torrent.on("wire", function(wire) {
    wire.on('close', ()=>{
      easypeers.wireCount--
      if(easypeers.wireCount < 0) easypeers.wireCount = 0
      delete easypeers.wires[wire.peerId]

      if(torrent && torrent.numPeers <= 2 && torrent.numPeers < easypeers.maxPeers){
        torrent.resume()
        torrent.announce[opts.announce]
      }
      easypeers.peerCount = torrent.numPeers
      // if(wire._writableState.emitClose && seen[wire.peerId] && new Date().getTime() - seen[wire.peerId].when > new Date().getTime() - (2 * 60 * 1000))
      easypeers.emit('disconnect', wire.peerId)
    })

    // Avoid duplicate connections to existing peers
    if(easypeers.wires.hasOwnProperty(wire.peerId)) return
    
    // let closestPeerId = getClosestPeer(wire.peerId)
    // let furthestPeerId = getFurthestPeer(closestPeerId)
    
    if (easypeers.wireCount < easypeers.maxPeers) {
      easypeers.wires[wire.peerId] = wire
      easypeers.wires[wire.peerId].use(_easypeers(easypeers.wires[wire.peerId]))
      easypeers.wireCount++
      easypeers.peerCount = torrent.numPeers
    } else {
      wire.destroy()
    }
    console.log(easypeers.wireCount)

  })

  function isValidJSON(json) {
    try {
        JSON.parse(json);
        return true;
    } catch (e) {
        return false;
    }
  }

  easypeers.on('_send', data => {
    if(typeof data === 'number') data = data.toString()
    data = data.toString()//.trim()
  
    let message = {}
  
    if(!isNaN(data)) {
      message = {
        id: crypto.createHash('sha1').update(data, 'binary').digest('hex')+Math.random(),
        from: easypeers.address,
        has: Object.keys(easypeers.wires),
        message: data,
      }
    } else if(isValidJSON(data)) {
      try {
        message = JSON.parse(data)
        message.has = Object.keys(easypeers.wires)
        message.id = crypto.createHash('sha1').update(data, 'binary').digest('hex')+Math.random()
      }
      catch (err) {
        console.error(err)
      }
    } else {
      message = {
        id: crypto.createHash('sha1').update(data, 'binary').digest('hex')+Math.random(),
        from: easypeers.address,
        has: Object.keys(easypeers.wires),
        message: data,
      }
    }
    message.proof = zerok.proof(easypeers.identifier + message.id + message.from)
    // validate message
    // message.proof = zero(keyPair.publicKey.toString('hex'), keyPair.publicKey.toString('hex'))

    for(let wire in easypeers.wires){
      try{
        let w = easypeers.wires[wire]
        if(w)
        easypeers.wires[wire].extended('sw_easypeers', JSON.stringify(message))
      } catch (e) {
        // ignore for now
      }
    }
  })
  
  setInterval(()=>{
    torrent.announce[opts.announce]
  }, easypeers.timeout)

  let last
  let _easypeers = () => {
    let swEasypeers = function(wire) {
      easypeers.wires[wire.peerId].extendedHandshake.keys = 'SEA Pairs'; // establish SEA pairs here
    
      this.onHandshake = (infoHash, peerId, extensions) => {
        seen[wire.peerId] = {when: new Date().getTime()}
      }

      this.onExtendedHandshake = (handshake) => {
        if(new Date().getTime() - seen[wire.peerId].when < new Date().getTime() - (5 * 60 * 1000))
        easypeers.emit('connect', wire.peerId)
      }

      this.onMessage = function(message) {
        let proof
        message = message.toString()
        if(message.includes(last)) return
        try {
          message = message.substring(message.indexOf(':') + 1)
          message = JSON.parse(message)
          console.log(message)
          if(message) proof = zerok.proof(message.proof)
          if(!proof) return
          message.has = []
          peers = Object.keys(easypeers.wires)
          peers.forEach(peer => {
            if(!message.has.includes(peer)){
              message.has.push(peer)
              easypeers.wires[peer].extended('sw_easypeers', JSON.stringify(message));
            }
          })
        } catch (err){

        }
        // if(message) easypeers.emit('message', message)
        if(message.from !== easypeers.address) easypeers.emit('message', message)
        last = message.id
      }
    }

    swEasypeers.prototype.name = 'sw_easypeers'
    return swEasypeers
  }
}

module.exports = Easypeers
