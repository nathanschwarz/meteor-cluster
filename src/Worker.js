const cluster = require('cluster')
const process = require('process')
import TaskQueue from './TaskQueue'

const WORKER_STATUSES = {
  IDLE: 0,
  IDLE_ERROR: 1
}

class ClusterWorker {
  constructor() {
    this.isIdle = true
    this.isReady = false
    this.worker = null
  }
  // worker Processes
  // communication
  static sendMsg(workerStatus) {
    const msg = { pid: [process.pid], ...workerStatus }
    process.send(msg)
  }
  static onMessage(jobId) {
    TaskQueue.execute(jobId).then(super.onJobDone).catch(super.onJobFailed)
  }
  static onDisconnect() {
    process.exit(0)
  }
  //TODO
  // static onExit() {
  // }

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
  close() {
    if (this.worker === null) {
      throw new Error('cannot disconnect worker has not started yet')
    }
    this.worker.disconnect()
    this.worker = null
    this.isIdle = true
    this.isReady = false
  }
  register(env) {
    this.worker = cluster.fork(env)
    this.worker.on('message', ClusterWorker.onMessage)
    this.worker.on('disconnect', ClusterWorker.onDisconnect)
  }
  startJob(jobId) {
    this.isIdle = false
    this._worker.send(jobId)
  }
  onJobEnd() {
    this.isIdle = true
  }
}

export { WORKER_STATUSES, ClusterWorker }
