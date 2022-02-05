# Easypeers
> Easy serverless WebRTC mesh using WebTorrent

Easypeers connects peers together based on a shared topic that is announced to WebTorrent bootstrap servers. It supports broadcast and direct messages over a gossip protocol that relays messages to indirectly connected peers.

# Security
Easypeeers is designed to easily connect peers together. You will want to explore addiing your own cryptography to secure messages and privacy. I highly recommend [Gun's SEA suite](https://gun.eco/docs/SEA).

# Easypeers Gossip Protocol
The gossip protocol is a basic 'distance' algorithm to determine how to get from peer A to peer Z. When peer A wants to reach peer Z, but is only connected to peer B, it asks peer B if it has seen peer Z. If peer B hasn't seen peer Z, it asks the peers it is connected to where peer Z is. Each peer responds with the distance to peer Z, or the default distance `Infinity` if it hasn't seen that peer. If all peers respond with `Infinity`, the peer is not part of the swarm and is considered dead.