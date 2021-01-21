import StaticCluster from './StaticCluster'
const process = require('process')
import TaskQueue from '../TaskQueue'
import ChildWorker from '../Worker/ChildWorker'

class ChildProcess extends StaticCluster {
  constructor(taskMap) {
    super()
    Meteor.startup(() => {
      TaskQueue.registerTaskMap(taskMap)
    })
    // register listeners if this process is a worker
    process.on('message', ChildWorker.onMessageFromMaster)
    process.on('disconnect', ChildWorker.onDisconnect)
  }
}

export default ChildProcess