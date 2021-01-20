const cluster = require('cluster')
const process = require('process')
import WORKER_STATUSES from './statuses'
import TaskQueue from '../TaskQueue'

class MasterWorker {
  constructor(messageBroker = null) {
    this.isIdle = true
    this.isReady = false
    this.removed = false
    this.worker = null
    this.messageBroker = messageBroker
  }
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
    } else if (this.messageBroker !== null) {
      this.messageBroker((msg) => this.worker.send(msg), msg)
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

export default MasterWorker