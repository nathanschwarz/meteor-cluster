const cluster = require('cluster')
const process = require('process')
import WORKER_STATUSES from './statuses'
import TaskQueue from '../TaskQueue'

class ChildWorker {
  // sends an identifyed msg to the Master
  static sendMsg(workerStatus) {
    const msg = { id: [cluster.worker.id], ...workerStatus }
    process.send(msg)
  }
  // worker events
  static toggleIPC(messageBroker, initialize) {
    return new Promise((resolve, reject) => {
      process.removeAllListeners('message')
      process.on('message', (msg) => resolve(messageBroker(msg)))
      initialize(ChildWorker.sendMsg)
    }).catch(e => {
      throw new Error(e)
    })
  }
  // default msg handler, used to start the task issued by the master
  static onMessageFromMaster(task) {
    const taskId = task._id
    TaskQueue.execute(task, ChildWorker.toggleIPC)
    .then(res => ChildWorker.onJobDone(res, taskId))
    .catch(error => ChildWorker.onJobFailed(error, taskId))
  }
  // exit the process when disconected event is issued by the master
  static onDisconnect() {
    process.exit(0)
  }
  // task events
  static onJobDone(result, taskId) {
    process.removeAllListeners('message')
    process.on('message', ChildWorker.onMessageFromMaster)
    const msg = { result, taskId, status: WORKER_STATUSES.IDLE }
    ChildWorker.sendMsg(msg)
  }
  static onJobFailed(error, taskId) {
    process.removeAllListeners('message')
    process.on('message', ChildWorker.onMessageFromMaster)
    const msg = { taskId, status: WORKER_STATUSES.IDLE_ERROR, error: {
      message: error.message,
      stack: error.stack,
      type: error.type,
      arguments: error.arguments
    }}
    ChildWorker.sendMsg(msg)
  }
}

export default ChildWorker
