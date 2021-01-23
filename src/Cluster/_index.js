const cluster = require('cluster')
import MasterCluster from './MasterCluster'
import ChildProcess from './ChildProcess'

export default (cluster.isMaster ? MasterCluster : ChildProcess)
