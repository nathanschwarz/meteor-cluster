const debug = Npm.require('debug')
import StaticCluster from './StaticCluster'
const process = require('process')
import TaskQueue from '../TaskQueue'
import ChildWorker from '../Worker/ChildWorker'

class ChildProcess extends StaticCluster {
  constructor(taskMap, { logs = 'all' } = {}) {
    super()
    Meteor.startup(() => {
      TaskQueue.registerTaskMap(taskMap)
    })
    // enable / disable logs
    if (logs === 'all') {
      debug.enable('nschwarz:cluster:*')
    } else {
      debug.enable('nschwarz:cluster:ERROR*,nschwarz:cluster:WARNING*')
    }
    // register listeners if this process is a worker
    process.on('message', ChildWorker.onMessageFromMaster)
    process.on('disconnect', ChildWorker.onDisconnect)
  }
}

export default ChildProcess
