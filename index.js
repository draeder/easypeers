const crypto = require('crypto')
const { EventEmitter } = require('events')

const WebTorrent = require('webtorrent')

const Zerok = require('zerok')

EventEmitter.defaultMaxListeners = 25

function generateECDHKeys() {
  const ecdh = crypto.createECDH('secp256k1');
  const publicKey = ecdh.generateKeys();
  return { ecdh, publicKey };
}

function computeSharedSecret(theirPublicKey, myECDH) {
  const sharedSecret = myECDH.computeSecret(theirPublicKey);
  return sharedSecret;
}


let pubkey = generateECDHKeys().publicKey.toString('hex')
  
console.log('Public Key: ' + pubkey)


const PREFIX = 'easypeers-'

const Easypeers = function(identifier, args) {
  let easypeers = this
  
  
  if (typeof identifier === 'object') {
    easypeers.opts = { ...identifier }
  } else {
    easypeers.opts = { ...args, identifier }
  }
  
  let zerok = new Zerok(easypeers.opts.bitlength)
  const events = new EventEmitter()
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  // easypeers.send = (to, data) => {easypeers.emit('_send', (to, data))}
  easypeers.off = events.off.bind(events)
  easypeers.removeAllListeners = events.removeAllListeners.bind(events)

  easypeers.maxPeers = easypeers.opts.maxPeers || 6
  easypeers.coverage = easypeers.opts.coverage || 0.33
  if (easypeers.maxPeers < 2) easypeers.maxPeers = 2
  easypeers.timeout = easypeers.opts.timeout || 30 * 1000
  easypeers.webtorrentOpts = easypeers.opts.webtorrentOpts

  easypeers.identifier = crypto
    .createHash('sha1')
    .update(PREFIX + (typeof identifier === 'object' ? identifier.identifier : identifier))
    .digest('hex')
  easypeers.address = easypeers.opts.address || crypto.randomBytes(20).toString('hex')


  // Generate a SHA-256 hash of the swarmId
  const hash = crypto.createHash('sha256')
  hash.update(easypeers.identifier)
  const seed = hash.digest()

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

  // Function to calculate distance
  function calculateDistance(hash1, hash2) {
    const hexDigits = '0123456789abcdef'
  
    let distance = ''
    for (let i = 0; i < hash1.length; i++) {
      const digit1 = hexDigits.indexOf(hash1[i])
      const digit2 = hexDigits.indexOf(hash2[i])
      const diff = (digit1 - digit2 + 16) % 16
      distance += hexDigits[diff]
    }
  
    return distance
  }
  
  // Function to find closest peers
  function findClosestPeers(targetPeerHash, knownPeers, maxPeers, ratio) {
    const k = Math.round(maxPeers * ratio) // Calculate the number of closest peers based on the ratio
    // Calculate distances
    const distances = knownPeers.map(peer => ({ peer, distance: calculateDistance(targetPeerHash, peer) }))
    // Sort by distance
    distances.sort((a, b) => a.distance.localeCompare(b.distance, 'en', { numeric: true }))
    // Get k closest peers (or less if fewer peers available)
    const closestPeers = distances.slice(0, Math.min(k, knownPeers.length)).map(d => d.peer)
    // Return subset of closest peers based on maxPeers
    return closestPeers.slice(0, maxPeers)
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
    let message = {}
    let sendTo
    if (to && data) {
      sendTo = to
    }
    if (data === undefined) {
      data = to
    }
    if (typeof data === 'number') {
      data = data.toString()
    }
    data = data.toString()
    if (Buffer.isBuffer(data.message)) {
      if(easypeers.opts.debug) console.debug('Received buffer ' + data)
      message = Buffer.from(data.message).toString('utf8')
    }
    // if(Buffer.isBuffer(data)) Buffer.from(data).toString('utf-8')
    // data = JSON.stringify(data)
    message = {
      id: crypto.createHash('sha1').update(data, 'binary').digest('hex') + Math.random(),
      has: Object.keys(easypeers.wires),
      message: data,
    }
  
    message.from = easypeers.address
  
    message.certificate = {
      id: zerok.proof(message.id),
      from: zerok.proof([message.from]),
      message: zerok.proof(message.message),
      pubkey: zerok.keypair.publicKey,
    }
  
    if (easypeers.opts.debug) console.debug('sendTo: ' + sendTo)
    if (sendTo) {
      // Direct messaging to specific peer(s)
      message.to = [sendTo]

      let knownPeers = Object.keys(easypeers.wires)
      let closePeers = findClosestPeers(message.to, knownPeers, easypeers.maxPeers, easypeers.coverage)
      if (easypeers.debug) console.debug('Sending direct message to ' + message.to + ' via ' + closePeers)
      for (let wire of closePeers) {
        try {
          if (easypeers.wires[wire]) {
            easypeers.wires[wire].extended('sw_easypeers', JSON.stringify(message))
            if (easypeers.opts.debug) console.debug('Sent message to: ' + wire) // Added logging here
          }
        } catch (e) {
          if (easypeers.debug) console.error(e)
        }
      }
    } else {
      // Broadcast messaging to all peers
      let knownPeers = Object.keys(easypeers.wires)
      if (easypeers.debug) console.debug('Sending broadcast message to all peers')
      for (let wire of knownPeers) {
        try {
          if (easypeers.wires[wire]) {
            easypeers.wires[wire].extended('sw_easypeers', JSON.stringify(message))
            if (easypeers.opts.debug) console.debug('Sent message to: ' + wire) // Added logging here
          }
        } catch (e) {
          if (easypeers.debug) console.error(e)
        }
      }
    }
  }
  
  setInterval(()=>{
    torrent.announce[opts.announce]
  }, easypeers.timeout)

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
        if (easypeers.opts.debug) console.debug('Received raw message:', message);
        message = message.toString();
        if (easypeers.opts.debug) console.debug(message);
        try {
          message = message.substring(message.indexOf(':') + 1);
          if (easypeers.opts.debug) console.debug('Parsed message before conversion:', message);
          message = JSON.parse(message, (key, value) => {
            if (typeof value === 'string' && value.startsWith('`') && value.endsWith('`')) {
              const strippedValue = value.slice(1, -1);
              try {
                const parsedObject = JSON.parse(strippedValue);
                if (typeof parsedObject === 'object' && parsedObject !== null) {
                  return parsedObject; // Convert back to object
                }
              } catch {
                // Ignore the value if it's not a valid JSON object
              }
            }
            return value;
          });

          if (
            !zerok.verify(message.id, message.certificate.id, message.certificate.pubkey) ||
            !zerok.verify(message.from, message.certificate.from, message.certificate.pubkey) ||
            !zerok.verify(message.message, message.certificate.message, message.certificate.pubkey)
          ) {
            return
          }
      
          if (!seenMessages[message.id]) {
            seenMessages[message.id] = true
          } else {
            if (easypeers.opts.debug) console.debug(`Duplicate message ${message.id} received, ignoring`)
            return
          }
                  
          // Check if the message has a 'to' field containing the local peer's address
          if (message.to) {
            if(!Array.isArray(message.to)) message.to = [message.to]
            if (message.to.includes(easypeers.address)) {
              // Process direct message
              if (easypeers.opts.debug) console.debug(`Received direct message from ${message.from}:`, message.message)
              // Emit a 'directMessage' event with the direct message
              easypeers.emit('message', {
                from: message.from,
                message: Buffer.from(message.message).toString('utf-8')
              })
              return // Stop processing further for direct messages
            } else {
              // If the current peer is not the intended recipient, only forward the message without emitting it
              message.has.push(easypeers.address) // immediately add self to "has" list of message
              let peers = Object.keys(easypeers.wires)
              for (let i = 0; i < peers.length; i++) {
                let peer = peers[i]
                if (peer === message.from || message.has.includes(peer)) {
                  if (easypeers.opts.debug) console.debug(`Skipping peer ${peer} for message ${message.id}`)
                } else {
                  if (easypeers.opts.debug) console.debug(`Forwarding message ${message.id} to peer ${peer}`)
                  if (!sentMessages[message.id]) {
                    sentMessages[message.id] = []
                  }
                  sentMessages[message.id].push(peer)
                  easypeers.wires[peer].extended('sw_easypeers', JSON.stringify(message), () => {
                    // Assuming 'messageAck' is the event for receiving an acknowledgment
                    easypeers.wires[peer].on('messageAck', (ack) => {
                      if (ack === message.id) {
                        if (easypeers.opts.debug) console.debug(`Received acknowledgment from peer ${peer} for message ${message.id}`)
                      }
                    })
                  })
                }
              }
              return
            }
          }

          // If the message does not have a 'to' property or if it's not an array,
          // emit the message and forward it to other peers
          if (easypeers.opts.debug) console.debug(`Received message from ${message.from}:`, message.message)
          if (typeof message.message === 'string') {
            if (Buffer.isBuffer(message.mmessage)) message.message = message.message.toString('utf-8')
            easypeers.emit('message', message)
          }
          
      
          message.has.push(easypeers.address) // immediately add self to "has" list of message
          let peers = Object.keys(easypeers.wires)
          for (let i = 0; i < peers.length; i++) {
            let peer = peers[i]
            if (peer === message.from || message.has.includes(peer)) {
              if (easypeers.opts.debug) console.debug(`Skipping peer ${peer} for message ${message.id}`)
            } else {
              if (easypeers.opts.debug) console.debug(`Forwarding message ${message.id} to peer ${peer}`)
              if (!sentMessages[message.id]) {
                sentMessages[message.id] = []
              }
              sentMessages[message.id].push(peer)
              easypeers.wires[peer].extended('sw_easypeers', JSON.stringify(message), () => {
                // Assuming 'messageAck' is the event for receiving an acknowledgment
                easypeers.wires[peer].on('messageAck', (ack) => {
                  if (ack === message.id) {
                    if (easypeers.opts.debug) console.debug(`Received acknowledgment from peer ${peer} for message ${message.id}`)
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