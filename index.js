const crypto = require('crypto')
const { EventEmitter } = require('events')
const WebTorrent = require('webtorrent-hybrid')
const wrtc = require('wrtc')

EventEmitter.defaultMaxListeners = 100

const PREFIX = 'easypeers-'

let keyPair

function generateKeys() {
    keyPair = crypto.createECDH('prime256v1')
    keyPair.generateKeys()
    return keyPair
}

function exportKey(publicKey) {
    return publicKey
}

function deriveSecret(theirPublicKey) {
    let sharedSecret = keyPair.computeSecret(theirPublicKey)
    let key = crypto.createCipheriv('aes-256-gcm', sharedSecret, Buffer.alloc(12, 0)) // IV should ideally be random and unique for each encryption
    return key
}

const Easypeers = function(identifier, args){
  const easypeers = this
  !args ? easypeers.opts = {} : easypeers.opts = {...args}

  const events = new EventEmitter()
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  easypeers.send = (data) => {easypeers.emit('_send', data)}
  easypeers.off = events.off.bind(events)

  easypeers.maxPeers = easypeers.opts.maxPeers || 6
  easypeers.timeout = easypeers.opts.timeout || 30 * 1000
  easypeers.identifier = easypeers.opts.infoHash
    || crypto.createHash('sha1').update(PREFIX+identifier).digest().toString('hex')
    || crypto.randomBytes(20).toString('hex')
  easypeers.address = easypeers.address || crypto.randomBytes(20).toString('hex')

  easypeers.wires = {}
  let seen = {}

  let client = new WebTorrent({dht:true, lsd:false, peerId:easypeers.address})
  
  let opts = {
    infoHash: easypeers.identifier,
    peerId: easypeers.address,
    wrtc: wrtc,
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
      if(wire._writableState.emitClose && seen[wire.peerId] && new Date().getTime() - seen[wire.peerId].when > new Date().getTime() - (2 * 60 * 1000))
      easypeers.emit('disconnect', wire.peerId)
    })

    // Avoid duplicate connections to existing peers
    if(easypeers.wires.hasOwnProperty(wire.peerId)) return
    
    // let closestPeerId = getClosestPeer(wire.peerId)
    // let furthestPeerId = getFurthestPeer(closestPeerId)
    
    // Partial mesh
    const hex2bin = (data) => data.split('').map(i => parseInt(i, 16).toString(2).padStart(4, '0')).join('')
    let closeness = hex2bin(easypeers.address) - hex2bin(wire.peerId)
    closeness = Math.abs(closeness)
    let closenessString = closeness.toString()
    let firstDigit = closenessString.charAt(0)
    closeness = parseInt(firstDigit)

    if(Math.trunc(Math.abs(closeness)) === 1 && easypeers.wireCount <= easypeers.maxPeers){
      if (easypeers.wireCount < easypeers.maxPeers) {
        easypeers.wires[wire.peerId] = wire
        easypeers.wires[wire.peerId].use(_easypeers(easypeers.wires[wire.peerId]))
        easypeers.wireCount++
        easypeers.peerCount = torrent.numPeers
      } else {
        wire.destroy()
      }
    }
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

    for(let wire in easypeers.wires){
      easypeers.wires[wire].extended('sw_easypeers', JSON.stringify(message))
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
        message = message.toString()
        if(message.includes(last)) return
        try {
          message = message.substring(message.indexOf(':') + 1)
          message = JSON.parse(message)
          message.has = []
          peers = Object.keys(easypeers.wires)
          peers.forEach(peer => {
            if(!message.has.includes(peer)){
              message.has.push(peer)
              easypeers.wires[peer].extended('sw_easypeers', JSON.stringify(message));
            }
          })
        } catch (err){
          easypeers.emit('message', message.toString());
        }
        if(message.from !== easypeers.address) easypeers.emit('message', message)
        last = message.id
      }
    }

    swEasypeers.prototype.name = 'sw_easypeers'
    return swEasypeers
  }
}

module.exports = Easypeers