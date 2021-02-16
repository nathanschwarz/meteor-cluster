import StaticCluster from './StaticCluster'
import { Meteor } from 'meteor/meteor'
import TaskQueue from '../TaskQueue'
import WORKER_STATUSES from '../Worker/statuses'
import MasterWorker from '../Worker/MasterWorker'
import { warnLogger } from '../logs'

const process = require('process')
const MAX_CPUS = StaticCluster.maxWorkers()

class MasterCluster extends StaticCluster {
  /*
    @params (taskMap: Object, masterProps: { port: Integer, maxAvailableWorkers: Integer, refreshRate: Integer, inMemoryOnly: Boolean })
    initialize Cluster on the master
  */
  constructor(taskMap, { port = 3008, maxAvailableWorkers = MAX_CPUS, refreshRate = 1000, inMemoryOnly = false, messageBroker = null } = {}) {
    super()
    Meteor.startup(() => {
      if (maxAvailableWorkers > MAX_CPUS) {
        warnLogger(`cannot have ${maxAvailableWorkers} workers, setting max system available: ${MAX_CPUS}`)
        this._cpus = MAX_CPUS
      } else if (maxAvailableWorkers <= 0) {
        warnLogger(`cannot have ${maxAvailableWorkers} workers, setting initial value to 1`)
        this._cpus = 1
      } else {
        this._cpus = maxAvailableWorkers
      }
      if (this._cpus === MAX_CPUS) {
        warnLogger(`you should not use all the cpus, please read the CPUS allocation documentation`)
      }
      this._port = port
      this._workers = []
      this.inMemoryOnly = inMemoryOnly
      this.messageBroker = messageBroker

      // find worker by process id
      this.getWorkerIndex = (id) =>this._workers.findIndex(w => w.id === id)
      this.getWorker = (id) => this._workers[this.getWorkerIndex(id)]

      // update all previous undone task, to restart them (if the master server has crashed or was stopped)
      TaskQueue.update({ onGoing: true }, { $set: { onGoing: false }}, { multi: true })

      // initializing interval
      this.interval = null
      // initializing pool refreshRate
      this.setRefreshRate(refreshRate)
    })
  }
  /*
    @params (wantedWorkers: Integer)
    add workers if tasks > current workers
    remove workers if tasks < current workers
    @returns non idle workers
  */
  _getAvailableWorkers(wantedWorkers) {
    const workerToCreate = wantedWorkers - this._workers.length
    if (workerToCreate > 0) {
      for (let i = 0; i < workerToCreate; i++) {
        const worker = new MasterWorker(this.messageBroker)
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
    @params (availableWorkers: Worker)
    dispatch jobs to idle workers
  */
  async _dispatchJobs(availableWorkers) {
    for (let i = 0; i < availableWorkers.length; i++) {
      const job = await TaskQueue.pull(this.inMemoryOnly)
      if (job !== undefined) {
        availableWorkers[i].startJob(job)
      }
    }
  }
  /*
    called at the interval set by Cluster.setRefreshRate
    gets jobs from the list
    gets available workers
    dispatch the jobs to the workers
  */
  async _run() {
    const jobsCount = TaskQueue.count(this.inMemoryOnly)
    const hasJobs = jobsCount > 0
    const wantedWorkers = Math.min(this._cpus, jobsCount)
    const availableWorkers = this._getAvailableWorkers(wantedWorkers)
    await this._dispatchJobs(availableWorkers)
  }

  /*
    @params (delay: Integer)
    set the refresh rate at which Cluster._run is called
  */
  setRefreshRate(delay) {
    if (this.interval != null) {
      Meteor.clearInterval(this.interval)
    }
    this.interval = Meteor.setInterval(() => this._run(), delay)
  }
}

export default MasterCluster
