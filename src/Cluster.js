import { Meteor } from 'meteor/meteor'
import TaskQueue from './TaskQueue'
import { WORKER_STATUSES, ClusterWorker } from './Worker'

const cluster = require('cluster')
const process = require('process')
const MAX_CPUS = require('os').cpus().length

class Cluster {
  static maxWorkers() {
    return MAX_CPUS
  }
  static isMaster() {
    return cluster.isMaster
  }
  constructor(taskMap, masterProps = {}) {
    Meteor.startup(() => {
      TaskQueue.registerTaskMap(taskMap)
      if (cluster.isMaster) {
        this._init(masterProps)
      }
    })
  }
  _init({ port = 3008, maxAvailableWorkers = MAX_CPUS, refreshRate = 1000 }) {
    if (maxAvailableWorkers > MAX_CPUS) {
      console.warn(`cannot have ${maxAvailableWorkers} workers, setting max system available: ${MAX_CPUS}`)
      this._cpus = MAX_CPUS
    } else if (maxAvailableWorkers <= 0) {
      console.warn(`cannot have ${maxAvailableWorkers} workers, setting initial value to 1`)
      this._cpus = 1
    }
    this._port = port
    this._workers = []

    this.getWorker = (pid) => this._workers.find(w => pid === w.process.pid)
    this.onListening = (_worker) => {
      const worker = this.getWorker(_worker.process.pid)
      worker.isReady = true
    }
    this.onMessage = (msg) => {
      const worker = this.getWorker(msg.pid)
      if (msg.status === WORKER_STATUSES.IDLE) {
        return worker.onJobEnd()
      } else if (WORKER_STATUSES.IDLE_ERROR) {
        worker.onJobEnd()
        console.error(msg.error)
      }
    }
    cluster.on('listenning', this.onListening)
    cluster.on('message', this.onMessage)

    this._getAvailableWorkers = (wantedWorkers) => {
      const workerToCreate = wantedWorkers - this._workers.length
      if (workerToCreate > 0) {
        for (let i = 0; i < workerToCreate; i++) {
          const worker = new ClusterWorker()
          worker.register({ PORT: this.port })
          this._workers.push(worker)
        }
      } else {
        this._workers.filter(w => w.isIdle && w.isReady).slice(workerToCreate).forEach(w => w.close())
        this._workers = this._workers.slice(this._workers.length + workerToCreate)
      }
      return this._workers.filter(w => w.isIdle && w.isReady)
    }

    this._run = () => {
      const jobsCount = TaskQueue.count()
      const hasJobs = jobsCount > 0
      const wantedWorkers = Math.min(this._cpus, jobsCount)
      const availableWorkers = this._getAvailableWorkers(wantedWorkers)
      const jobs = TaskQueue.pull(availableWorkers.length)
      jobs.forEach((job, i) => availableWorkers[i].startJob(job._id))
    }

    // initializing interval
    this.interval = null
    this.setRefreshRate = (delay) => {
      if (this.interval != null) {
        Meteor.clearInterval(this.interval)
      }
      this.interval = Meteor.setInterval(this._run, refreshRate)
    }

    this.setRefreshRate(refreshRate)
  }
}

export default Cluster
