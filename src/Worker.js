const cluster = require('cluster')
const process = require('process')
import TaskQueue from './TaskQueue'

const WORKER_STATUSES = {
  IDLE: 0,
  IDLE_ERROR: 1
}

class ClusterWorker {
  // sends an identifyed msg to the Master
  static sendMsg(workerStatus) {
    const msg = { id: [cluster.worker.id], ...workerStatus }
    process.send(msg)
  }
  // worker events
  static onMessageFromMaster(task) {
    const taskId = task._id
    TaskQueue.execute(task)
    .then(res => ClusterWorker.onJobDone(res, taskId))
    .catch(error => ClusterWorker.onJobFailed(error, taskId))
  }
  waitForMessageBroker(messageBroker) {
    return new Promise((resolve, reject) => {
      process.on('message', (msg) => {
        resolve(messageBroker(msg))
      })
    }).then(res => {
      process.on('message', ClusterWorker.onMessageFromMaster)
      return res
    }).catch(err => {
      process.on('message', ClusterWorker.onMessageFromMaster)
      throw(err)
    })
  }
  static onDisconnect() {
    process.exit(0)
  }
  // task events
  static onJobDone(result, taskId) {
    const msg = { result, taskId, status: WORKER_STATUSES.IDLE }
    ClusterWorker.sendMsg(msg)
  }
  static onJobFailed(error, taskId) {
    const msg = { taskId, status: WORKER_STATUSES.IDLE_ERROR, error: {
      message: error.message,
      stack: error.stack,
      type: error.type,
      arguments: error.arguments
    }}
    ClusterWorker.sendMsg(msg)
  }
  constructor(messageBroker = null) {
    this.isIdle = true
    this.isReady = false
    this.removed = false
    this.worker = null
    this.messageBroker = messageBroker
  }
  // Master processes
  // events
  onListening() {
    this.isReady = true
  }
  onExit() {
    this.removed = true
  }
  setIdle({ taskId, result, error = undefined }) {
    this.isIdle = true
    if (error !== undefined) {
      TaskQueue.onJobError({ error, taskId })
    } else {
      TaskQueue.onJobDone({ result, taskId })
    }
  }
  onMessage(msg) {
    if (msg.status === WORKER_STATUSES.IDLE || msg.status === WORKER_STATUSES.IDLE_ERROR) {
      this.setIdle(msg)
    } else if (this.messageBroker) {
      this.messageBroker({ send: this.worker.send, setIdle: this.setIdle }, msg)
    }
  }
  register(env) {
    this.worker = cluster.fork(env)
    this.worker.on('listening', () => this.onListening())
    this.worker.on('message', (msg) => this.onMessage(msg))
    this.worker.on('exit', () => this.onExit())
  }
  startJob(task) {
    this.isIdle = false
    this.worker.send(task)
  }
  close() {
    if (this.worker === null) {
      throw new Error('cannot disconnect worker has not started yet')
    }
    this.worker.disconnect()
    this.isIdle = true
    this.isReady = false
  }
}

export { WORKER_STATUSES, ClusterWorker }
