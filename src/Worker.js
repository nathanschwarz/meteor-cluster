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
  static onMessage(task) {
    const taskId = task._id || task
    TaskQueue.execute(task)
    .then((res) => ClusterWorker.onJobDone(res, taskId))
    .catch((error) => ClusterWorker.onJobFailed(error, taskId))
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
    const msg = { taskId, status: WORKER_STATUSES.IDLE_ERROR, error: error }
    ClusterWorker.sendMsg(msg)
  }
  constructor(onRemove) {
    this.isIdle = true
    this.isReady = false
    this.removed = false
    this.worker = null
  }
  // Master processes
  // events
  onListening() {
    this.isReady = true
  }
  onExit() {
    this.removed = true
  }
  onMessage(msg) {
    if (msg.status === WORKER_STATUSES.IDLE) {
      this.isIdle = true
      TaskQueue.onJobDone({ result: msg.result, taskId: msg.taskId })
    } else if (msg.status === WORKER_STATUSES.IDLE_ERROR) {
      this.isIdle = true
      TaskQueue.onJobError({ error: msg.error, taskId: msg.taskId })
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
    if (typeof task === 'string') {
      TaskQueue.update({ _id: task }, { $set: { onGoing: true }})
    }
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
