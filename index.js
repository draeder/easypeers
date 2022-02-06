const crypto = require('crypto')
const EventEmitter = require('events').EventEmitter
const Discovery = require('torrent-discovery')
const wrtc = require('wrtc')

const Easypeers = function(identifier){
  const easypeers = this
  const events = new EventEmitter()
  const PREFIX = 'easypeers-'
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  easypeers.send = () => {}
  easypeers.off = events.off.bind(events)

  easypeers.identifier = crypto.createHash('sha1').update(PREFIX+identifier).digest().toString('hex')
  easypeers.address = crypto.randomBytes(20).toString('hex')
  easypeers.connections = 0
  easypeers.timeout = 5 // seconds
  easypeers.maxPeers = 5
  easypeers.debug === true

  let opts = {
    infoHash: this.identifier,
    peerId: this.address,
    lsd: false,
    dht: false,
    //port: 9021,
    tracker: { wrtc },
    announce: [
      'wss://tracker.peer.ooo',
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.btorrent.xyz'
    ]
  }
  
  if(!process.browser && !opts.port) process.browser = ' '//'hack for torrent-discovery webrtc-only in node
  
  let peers = {}
  let discovery = new Discovery(opts)

  let connections = []
  let routes = {}

  let last

  discovery.on('peer', (peer, source) => {
    if(Object.keys(peers).length >= easypeers.maxPeers){
      console.log('Time to create a new instance')
      opts.infoHash = crypto.createHash('sha1').update(PREFIX+identifier+1).digest().toString('hex')
      discovery = new Discovery(opts)
    }
    peers[peer.id] = peer
    if(!connections.includes(peer.id)){
      connections.push(peer.id)
      easypeers.connections = Object.keys(peers).length
      easypeers.emit('connection', peer.id)
    }

    peer.once('close', ()=> {
      if(last === peer.id) return
      connections.splice(connections.indexOf(peer.id))
      delete peers[peer.id]
      easypeers.connections = Object.keys(peers).length
      easypeers.emit('disconnected', peer.id)
      peer.removeAllListeners()
      peer.destroy()
      last = peer.id
    })

    let distance = Math.abs(parseInt(this.address, 16) - parseInt(peer.id, 16))

    //console.log(distance, Object.keys(peers).length)
    peers[peer.id].distance = distance
    routes[peer.id] = distance
    //console.log(discovery.routes)

    let k = Object.keys(peers)
    let distances = k.map(d => peers[d].distance)
    let closest = Math.min(...distances)
    let furthest = Math.max(...distances)

    let far = Object.keys(peers).filter(peer => { 
      if(peers[peer].distance === furthest) return peer
    })[0]
    let near = Object.keys(peers).filter(peer => { 
      if(peers[peer].distance === closest) return peer
    })[0]

    peer.on('data', data => {
      try{
        data = JSON.parse(data)
        //console.log(data)
        easypeers.emit('message', data)
      }
      catch{
        //console.log(data.toString())
        easypeers.emit('message', data.toString())
      }
    })
    easypeers.connections = Object.keys(peers).length
  })

  discovery.on('warning', err => {
    console.warn('Discovery warning:', err)
  })
  discovery.on('error', err => {
    console.error('Discovery error:', err)
  })

  easypeers.send = (address, data) => {
    if(peers != {}){
      if(!data) data = address
      try{
        data = JSON.parse(data)
        if(data.connections){
          console.log(Object.keys(peers))
          console.log(easypeers.connections)
        }
        if(data.peers){
          console.log(Object.keys(peers))
        }
      }
      catch{}
      if(address === data){
        // broadcast message
        for(p in peers){
          try{ peers[p].send(data)} catch {} // no peers
        }
      } else { 
        // direct message
        try{ peers[address].send(data) } 
        catch{
          // ask peers if they have this address and relay through one of those peers
        }
      }
    } else {
      console.log('No peers connected')
    }
  }

  // Suppress extraneous simple-peer errors unless easypeers.debug === true
  process.on('uncaughtException', function (err) {
    let codes = [
      'ERR_WEBRTC_SUPPORT',
      'ERR_CREATE_OFFER',
      'ERR_CREATE_ANSWER',
      'ERR_SET_LOCAL_DESCRIPTION',
      'ERR_SET_REMOTE_DESCRIPTION',
      'ERR_ADD_ICE_CANDIDATE',
      'ERR_ICE_CONNECTION_FAILURE',
      'ERR_SIGNALING',
      'ERR_DATA_CHANNEL',
      'ERR_CONNECTION_FAILURE'
    ]
    if(easypeers.debug === true) console.error(err)
    if(!codes.includes(err.code)){
      console.error(err)
    }
  })
}

module.exports = Easypeers