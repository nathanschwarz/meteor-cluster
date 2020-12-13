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
  static onMessage(job) {
    const jobId = job._id || job
    TaskQueue.execute(job)
    .then((res) => ClusterWorker.onJobDone(res, jobId))
    .catch((error) => ClusterWorker.onJobFailed(error, jobId))
  }
  static onDisconnect() {
    process.exit(0)
  }
  // job events
  static onJobDone(result, jobId) {
    const msg = { result, jobId, status: WORKER_STATUSES.IDLE }
    ClusterWorker.sendMsg(msg)
  }
  static onJobFailed(error, jobId) {
    const msg = { jobId, status: WORKER_STATUSES.IDLE_ERROR, error: error }
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
      TaskQueue.onJobDone(result, msg.jobId)
    } else if (msg.status === WORKER_STATUSES.IDLE_ERROR) {
      this.isIdle = true
      TaskQueue.onJobError(msg.error, msg.jobId)
    }
  }
  register(env) {
    this.worker = cluster.fork(env)
    this.worker.on('listening', () => this.onListening())
    this.worker.on('message', (msg) => this.onMessage(msg))
    this.worker.on('exit', () => this.onExit())
  }
  startJob(job) {
    this.isIdle = false
    if (typeof job === 'string') {
      TaskQueue.update({ _id: job }, { $set: { onGoing: true }})
    }
    this.worker.send(job)
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
