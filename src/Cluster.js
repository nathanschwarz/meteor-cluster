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
        // register listeners if this process is a worker
        process.on('message', ClusterWorker.onMessage)
        process.on('disconnect', ClusterWorker.onDisconnect)
      }
    })
  }
  /*
    @params (masterProps: { port: Integer, maxAvailableWorkers: Integer, refreshRate: Integer })
    initialize Cluster on the master
  */
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

    // find worker by process id
    this.getWorkerIndex = (id) =>this._workers.findIndex(w => w.id === id)
    this.getWorker = (id) => this._workers[this.getWorkerIndex(id)]

    // update all previous undone task, to restart them (if the master server has crashed or was stopped)
    TaskQueue.update({ onGoing: true }, { $set: { onGoing: false }})

    /*
      @params (wantedWorkers: Integer)
      add workers if tasks > current workers
      remove workers if tasks < current workers
      @returns non idle workers
    */
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

    /*
      called at the interval set by Cluster.setRefreshRate
      gets jobs from the list
      gets available workers
      dispatch the jobs to the workers
    */
    this._run = () => {
      const jobsCount = TaskQueue.count()
      const hasJobs = jobsCount > 0
      const wantedWorkers = Math.min(this._cpus, jobsCount)
      const availableWorkers = this._getAvailableWorkers(wantedWorkers)
      if (availableWorkers.length > 0) {
        const jobs = TaskQueue.pull(availableWorkers.length)
        jobs.forEach((job, i) => availableWorkers[i].startJob(job))
      }
    }

    // initializing interval
    this.interval = null

    /*
      @params (delay: Integer)
      set the refresh rate at which Cluster._run is called
    */
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
