const cluster = require('cluster')
const process = require('process')
import TaskQueue from './TaskQueue'
import { errorLogger } from './logs'

const WORKER_STATUSES = {
  IDLE: 0,
  IDLE_ERROR: 1
}

class ClusterWorker {
  constructor(onRemove) {
    this.isIdle = true
    this.isReady = false
    this.removed = false
    this.worker = null
  }
  static sendMsg(workerStatus) {
    const msg = { id: [cluster.worker.id], ...workerStatus }
    process.send(msg)
  }
  // worker events
  static onMessage(jobId) {
    TaskQueue.execute(jobId)
    .then(ClusterWorker.onJobDone)
    .catch(ClusterWorker.onJobFailed)
  }
  static onDisconnect() {
    process.exit(0)
  }
  // job events
  static onJobDone() {
    const msg = { status: WORKER_STATUSES.IDLE }
    ClusterWorker.sendMsg(msg)
  }
  static onJobFailed(error) {
    const msg = { status: WORKER_STATUSES.IDLE_ERROR, error: error }
    ClusterWorker.sendMsg(msg)
  }
  // Master processes
  onListening() {
    this.isReady = true
  }
  onMessage(msg) {
    if (msg.status === WORKER_STATUSES.IDLE) {
      this.isIdle = true
    } else if (msg.status === WORKER_STATUSES.IDLE_ERROR) {
      this.isIdle = true
      errorLogger(msg.error)
    }
  }
  onExit() {
    this.removed = true
  }
  register(env) {
    this.worker = cluster.fork(env)
    this.worker.on('listening', () => this.onListening())
    this.worker.on('message', (msg) => this.onMessage(msg))
    this.worker.on('exit', () => this.onExit())
  }
  startJob(jobId) {
    this.isIdle = false
    this.worker.send(jobId)
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
