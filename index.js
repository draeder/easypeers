const crypto = require('crypto')
const { EventEmitter } = require('events')

const WebTorrent = require('webtorrent')
const Zerok = require('zerok')

EventEmitter.defaultMaxListeners = 25

const PREFIX = 'easypeers-'

const Easypeers = function(identifier, args){
  let easypeers = this

  let zerok = new Zerok(256)

  if(typeof identifier === 'object'){
    easypeers.opts = {...identifier}
  } else {
    easypeers.opts = {...args}
  }

  const events = new EventEmitter()
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  // easypeers.send = (to, data) => {easypeers.emit('_send', (to, data))}
  easypeers.off = events.off.bind(events)
  easypeers.removeAllListeners = events.removeAllListeners.bind(events)

  easypeers.maxPeers = easypeers.opts.maxPeers || 6
  if(easypeers.maxPeers < 2) easypeers.maxPeers = 2
  easypeers.timeout = easypeers.opts.timeout || 30 * 1000
  easypeers.identifier = easypeers.opts.identifer 
    || crypto.createHash('sha1').update(PREFIX+easypeers.opts.identifier).digest().toString('hex')
    || crypto.createHash('sha1').update(PREFIX+crypto.randomBytes(20).toString('hex')).digest().toString('hex')
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

  let client = new WebTorrent({dht:false, lsd:false, peerId:easypeers.address})
  
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
    })
    
    let closest
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

      if(torrent && torrent.numPeers <= 2 && torrent.numPeers < easypeers.maxPeers
        && easypeers.wireCount < 2 ){
        torrent.resume()
        torrent.announce[opts.announce]
      }
      easypeers.peerCount = torrent.numPeers
      if(wire._writableState.emitClose && seen[wire.peerId] && new Date().getTime() - seen[wire.peerId].when > new Date().getTime() - (2 * 60 * 1000))
      easypeers.emit('disconnect', wire.peerId)
      wire.removeAllListeners()
      wire = null
    })

    // Avoid duplicate connections to existing peers
    if(easypeers.wires.hasOwnProperty(wire.peerId)) {
      wire.destroy()
      return
    }
    
    // let closestPeerId = getClosestPeer(wire.peerId)
    // let furthestPeerId = getFurthestPeer(closestPeerId)
    
    if (easypeers.wireCount < easypeers.maxPeers) {
      easypeers.wires[wire.peerId] = wire
      easypeers.wires[wire.peerId].use(_easypeers(easypeers.wires[wire.peerId]))
      easypeers.wireCount++
      easypeers.peerCount = torrent.numPeers
    } else {
      wire.destroy()
      return
    }
  })

  function isValidJSON(json) {
    try {
        JSON.parse(json)
        return true
    } catch (e) {
        return false
    }
  }

  easypeers.send = (to, data) => {
    if(!data) data = to
    if(typeof data === 'number') data = data.toString()
    data = data.toString()
  
    let message = {}

    if(!isNaN(data)) {
      message = {
        id: crypto.createHash('sha1').update(data, 'binary').digest('hex')+Math.random(),
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
        has: Object.keys(easypeers.wires),
        message: data,
      }
    }

    message.from = easypeers.address

    message.certificate = {
      id: zerok.proof(message.id),
      from: zerok.proof([message.from]),
      message: zerok.proof(message.message),
      pubkey: zerok.keypair.publicKey
    }

    for(let wire in easypeers.wires){
      try{
        let w = easypeers.wires[wire]
        if(w)
        easypeers.wires[wire].extended('sw_easypeers', JSON.stringify(message))
      } catch (e) {
        // ignore for now
      }
    }
  }
  
  setInterval(()=>{
    torrent.announce[opts.announce]
  }, easypeers.timeout)

  let last
  let sentMessages = {}
  let seenMessages = {}
  let _easypeers = () => {
    let swEasypeers = function(wire) {
      easypeers.wires[wire.peerId].extendedHandshake.keys = 'SEA Pairs' // establish SEA pairs here
    
      this.onHandshake = (infoHash, peerId, extensions) => {
        seen[wire.peerId] = {when: new Date().getTime()}
      }

      this.onExtendedHandshake = (handshake) => {
        if(new Date().getTime() - seen[wire.peerId].when < new Date().getTime() - (5 * 60 * 1000))
        easypeers.emit('connect', wire.peerId)
      }

      
      this.onMessage = function(message) {
        message = message.toString()
        try {
          message = message.substring(message.indexOf(':') + 1)
          message = JSON.parse(message)
      
          if (
            !zerok.verify(message.id, message.certificate.id, message.certificate.pubkey)
            || !zerok.verify(message.from, message.certificate.from, message.certificate.pubkey)
            || !zerok.verify(message.message, message.certificate.message, message.certificate.pubkey)
          ) {
            return
          }
      
          if (!seenMessages[message.id]) {
            seenMessages[message.id] = true
            easypeers.emit('message', message)
          } else {
            if(easypeers.opts.debug) console.log(`Duplicate message ${message.id} received, ignoring`)
            return
          }
      
          message.has.push(easypeers.address) // immediately add self to "has" list of message
          let peers = Object.keys(easypeers.wires)
          for(let i = 0; i < peers.length; i++) {
            let peer = peers[i]
            if (peer === message.from || message.has.includes(peer)) {
              if(easypeers.opts.debug) console.log(`Skipping peer ${peer} for message ${message.id}`)
            } else {
              if(easypeers.opts.debug) console.log(`Sending message ${message.id} to peer ${peer}`)
              if (!sentMessages[message.id]) {
                sentMessages[message.id] = []
              }
              sentMessages[message.id].push(peer)
              easypeers.wires[peer].extended('sw_easypeers', JSON.stringify(message), () => {
                // Assuming 'messageAck' is the event for receiving an acknowledgment
                easypeers.wires[peer].on('messageAck', (ack) => {
                  if (ack === message.id) {
                    if(easypeers.opts.debug) console.log(`Received acknowledgment from peer ${peer} for message ${message.id}`)
                  }
                })
              })
            }
          }
        } catch (err) {
          // handle error
        }
      }   
    }

    swEasypeers.prototype.name = 'sw_easypeers'
    return swEasypeers
  }
}

module.exports = Easypeers