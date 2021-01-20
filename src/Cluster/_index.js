const cluster = require('cluster')

let Cluster = null
if (cluster.isMaster) {
  import MasterCluster from './MasterCluster'
  Cluster = MasterCluster
} else {
  import ChildProcess from './ChildProcess'
  Cluster = ChildProcess
}

export default Cluster