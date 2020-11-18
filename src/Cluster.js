import { Meteor } from 'meteor/meteor'
import TaskQueue from './TaskQueue'
import { WORKER_STATUSES, ClusterWorker } from './Worker'
import { warnLogger } from './logs'

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
      } else {
        process.on('message', ClusterWorker.onMessage)
        process.on('disconnect', ClusterWorker.onDisconnect)
      }
    })
  }
  _init({ port = 3008, maxAvailableWorkers = MAX_CPUS, refreshRate = 1000 }) {
    if (maxAvailableWorkers > MAX_CPUS) {
      warnLogger(`cannot have ${maxAvailableWorkers} workers, setting max system available: ${MAX_CPUS}`)
      this._cpus = MAX_CPUS
    } else if (maxAvailableWorkers <= 0) {
      warnLogger(`cannot have ${maxAvailableWorkers} workers, setting initial value to 1`)
      this._cpus = 1
    } else {
      this._cpus = maxAvailableWorkers
    }
    this._port = port
    this._workers = []
    this.getWorkerIndex = (id) =>this._workers.findIndex(w => w.id === id)
    this.getWorker = (id) => this._workers[this.getWorkerIndex(id)]

    this._getAvailableWorkers = (wantedWorkers) => {
      const workerToCreate = wantedWorkers - this._workers.length
      if (workerToCreate > 0) {
        for (let i = 0; i < workerToCreate; i++) {
          const worker = new ClusterWorker()
          worker.register({ ...process.env, PORT: this.port })
          this._workers.push(worker)
        }
      } else if (workerToCreate < 0) {
        this._workers.filter(w => w.isIdle && w.isReady).slice(workerToCreate).forEach(w => w.close())
      }
      this._workers = this._workers.filter(w => !w.removed)
      return this._workers.filter(w => w.isIdle && w.isReady)
    }

    this._run = () => {
      const jobsCount = TaskQueue.count()
      const hasJobs = jobsCount > 0
      const wantedWorkers = Math.min(this._cpus, jobsCount)
      const availableWorkers = this._getAvailableWorkers(wantedWorkers)
      if (availableWorkers.length > 0) {
        const jobs = TaskQueue.pull(availableWorkers.length)
        jobs.forEach((job, i) => availableWorkers[i].startJob(job._id))
      }
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
