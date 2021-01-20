const cluster = require('cluster')
const MAX_CPUS = require('os').cpus().length

class StaticCluster {
	static maxWorkers() {
    return MAX_CPUS
  }
  static isMaster() {
    return cluster.isMaster
  }
}

export default StaticCluster