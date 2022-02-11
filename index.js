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
      'wss://tracker.peer.ooo',
      'wss://tracker.openwebtorrent.com'
    ],
    port: process ? easypeers.opts.port || 6881 : undefined
  }
  
  let torrent = client.add(opts)

  client.on('ready', () => {
    console.log("ready")
    setTimeout(()=>{
      if(Object.keys(seen).length === 0){
        torrent.destroy()
        torrent = client.add(opts)
      }
    },easypeers.timeout * 1.5)
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
      wire.use(_easypeers(wire, wire.peerId))
    }
  })

  setInterval(()=>{
    torrent.announce[opts.announce]
  }, easypeers.timeout)

  let _easypeers = () =>{
    let swEasypeers = function(wire) {
      wire._writableState.emitClose = false
      wire[wire.peerId] = wire
      wire[wire.peerId].extendedHandshake.keys = 'SEA Pairs' // establish SEA pairs here
      this.onHandshake = (infoHash, peerId, extensions) => {
        wires[wire.peerId] = wire.peerId
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
          }
        }
        seen[wire.peerId] = {when: new Date().getTime()}
      }
      this.onExtendedHandshake = (handshake) => {
        if(new Date().getTime() - seen[wire.peerId].when < new Date().getTime() - (2 * 60 * 1000))
        easypeers.emit('connect', wire.peerId)

        // Send messages
        if (handshake.m && handshake.m.sw_easypeers) {

          setInterval(()=>{
            //wire.extended('sw_easypeers', 'ping:'+wire.peerId+':'+new Date().getTime())
          },1000)

          if(typeof window === 'undefined'){
            process.stdout.on('data', data => {
              sendMessage(data)
            })
          } else {
            easypeers.send = (data) =>{
              sendMessage(data)
            }
          }
          let sendMessage = (data) =>{
            try{
              data = data.split(':')
              if(data[1] !== easypeers.address) return
            } catch{}
            //if(wire[wire.peerId])
            wire.extended('sw_easypeers', data)
          }
        }
      }

      wire.on('close', ()=>{
        console.log('wire closed', torrent.numPeers, wire.peerId)
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

      this.onMessage = function(message) {
        message = message.toString().trim()
        try{
          message = message.split(':')
          if(message[0]==='address') console.log(easypeers.address) 
          else
          if(message[0]==='peers') console.log(torrent.numPeers)
          else
          if(message[0]==='seen') console.log(seen)
          else
          if(message[0]==='direct' &&  Object.keys(seen).includes(message[1])){
            console.log('have peer, sending..... ', message[2])
          } else
          if(message.length === 1){
            easypeers.emit('message', message)
          } else 
          if (message[1] === easypeers.address){
            easypeers.emit('message', message)
          } else {
            easypeers.emit('message', message)
          }
          //console.log('don\'t have peer, not sending')
          
        }
        catch(err){console.log(err)}        
      }
    }
    swEasypeers.prototype.name = 'sw_easypeers'
    return swEasypeers
  }
}

module.exports = Easypeers