const crypto = require('crypto')
const { EventEmitter } = require('events')
const WebTorrent = require('webtorrent-hybrid')
const wrtc = require('wrtc')

const PREFIX = 'easypeers-'

const Easypeers = function(identifier, args){
  const easypeers = this
  !args ? easypeers.opts = {} : easypeers.opts = {...args}

  const events = new EventEmitter()
  easypeers.on = events.on.bind(events)
  easypeers.once = events.once.bind(events)
  easypeers.emit = events.emit.bind(events)
  easypeers.send = (data) => {easypeers.emit('_send', data)}
  easypeers.off = events.off.bind(events)

  easypeers.maxPeers = easypeers.opts.maxPeers
  easypeers.coverage = easypeers.opts.coverage || 0.3
  easypeers.debug = easypeers.opts.debug || false
  easypeers.timeout = easypeers.opts.timeout || 30 * 1000
  easypeers.identifier = crypto.createHash('sha1').update(PREFIX+identifier).digest().toString('hex')
  easypeers.address = crypto.randomBytes(20).toString('hex')
  easypeers.swarmHashes = []

  let wires = {}
  let seen = {}

  let client = new WebTorrent({dht:false, lsd:false, peerId:easypeers.address})
  
  let opts = {
    infoHash: easypeers.identifier,
    peerId: easypeers.address,
    wrtc: wrtc,
    announce: [
      easypeers.opts.tracker ? easypeers.opts.tracker : '',
      'wss://tracker.peer.ooo',
      'wss://tracker.openwebtorrent.com'
    ],
    port: process ? easypeers.opts.port || 6881 : undefined
  }
  
  let torrent = client.add(opts)

  client.on('ready', () => {
    console.log("ready")
    setInterval(()=>{
      if(Object.keys(seen).length === 0){
        torrent.announce[opts.announce]
      }
    }, 60 * 1000)
  })
  client.on('warning', err => {
    console.log('Warning', err)
  })
  client.on('error', err => {
    console.log('Error', err)
  })

  torrent.on("wire", function(wire) {
    easypeers.peerCount = torrent.numPeers
    if(torrent.numPeers > easypeers.maxPeers && easypeers.coverage === -1){
      wire.destroy()
      return
    } else {
      wire._writableState.emitClose = false
      wire[wire.peerId] = wire
      wire[wire.peerId].use(_easypeers(wire[wire.peerId]))
    }
  })

  setInterval(()=>{
    torrent.announce[opts.announce]
  }, easypeers.timeout)

  let _easypeers = () =>{
    let swEasypeers = function(wire) {
      wire[wire.peerId].extendedHandshake.keys = 'SEA Pairs' // establish SEA pairs here
      this.onHandshake = (infoHash, peerId, extensions) => {
        wires[wire.peerId] = wire
        // partial mesh        
        if(torrent.numPeers > easypeers.maxPeers){
          let spares = Object.keys(wires)
          let spare = spares.filter(v => {
            return v < easypeers.address
          })
          if(Math.round(spare.length * easypeers.coverage) === 1 && torrent.numPeers <= easypeers.maxPeers + Math.round(spare.length * 0.3)+1) {
            wire[wire.peerId]._writableState.emitClose = true
          } else {
            wire[wire.peerId].destroy()
            delete wire[wire.peerId]
            delete wires[wire.peerId]
            return
          }
        }
        seen[wire.peerId] = {when: new Date().getTime()}
      }
      this.onExtendedHandshake = (handshake) => {
        if(new Date().getTime() - seen[wire.peerId].when < new Date().getTime() - (5 * 60 * 1000))
        easypeers.emit('connect', wire.peerId)
        // Send messages
        if (handshake.m && handshake.m.sw_easypeers) {
          if(typeof window === 'undefined'){
            easypeers.send = data =>{
              sendMessage(wire, data)
            }
            process.stdout.on('data', data => {
              sendMessage(wire, data)
            })
          } else {
            easypeers.send = data =>{
              sendMessage(wire, data)
            }
          }
        }
      }

      this.onMessage = function(message) {
        message = message.toString()
        try{
          message = message.substring(message.indexOf(':') + 1)
          message = JSON.parse(message)
          if(message.from === easypeers.address) return
          if(Object.keys(seen).length === 1) return easypeers.emit('_message', JSON.stringify(message))
          if(message.to === easypeers.address) return easypeers.emit('_message', JSON.stringify(message))
          else
          for(w in wires){
            message.to = w
            wires[w].extended('sw_easypeers', JSON.stringify(message))
          }
        } catch (err){
          //console.log(err)
        }
      }

      wire.on('close', ()=>{
        if(torrent.numPeers === 0){
          torrent.resume()
          setInterval(()=>{
            torrent.announce[opts.announce]
          }, 5 * 1000)
        } else
        if(torrent && torrent.numPeers <= 2 && torrent.numPeers < easypeers.maxPeers){
          torrent.resume()
          torrent.announce[opts.announce]
        }
        easypeers.peerCount = torrent.numPeers
        if(wire._writableState.emitClose && seen[wire.peerId] && new Date().getTime() - seen[wire.peerId].when > new Date().getTime() - (2 * 60 * 1000))
        easypeers.emit('disconnect', wire.peerId)
      })
    }

    swEasypeers.prototype.name = 'sw_easypeers'
    return swEasypeers
  }

  // message deduplication when gossiping
  let last
  easypeers.on('_message', message => {
    if(last === message) return
    easypeers.emit('message', message)
    last = message
  })

  let sendMessage = (wire, data) =>{
    data = data.toString().trim()
    let message = {}
    try{
      data = JSON.parse(data)
      message = {
        to: data.to,
        from: data.from,
        have: Object.keys(wires),
        message: data.message
      }
      if(message.have.includes(data.to)) return wires[data.to].extended('sw_easypeers', JSON.stringify(message))
    }
    catch{
      message = {
        type: 'broadcast',
        from: easypeers.address,
        have: Object.keys(wires),
        message: data
      }
      wire.extended('sw_easypeers', JSON.stringify(message))
    }
    /*
    try{
      message = JSON.parse(data)
      message.have = Object.keys(wires)

      if(message.to && message.have.includes(message.to)) wire[message.to].extended('sw_easypeers', JSON.stringify(message))

      wire.extended('sw_easypeers', JSON.stringify(message))
      console.log('nope')
    }
    catch (err) {      
      message = {
        type: 'broadcast',
        from: easypeers.address,
        have: Object.keys(wires),
        message: data,
      }
      wire.extended('sw_easypeers', JSON.stringify(message))
    }
    */
  }
}

module.exports = Easypeers