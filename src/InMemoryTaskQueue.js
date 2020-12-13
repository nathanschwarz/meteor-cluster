import { Random } from 'meteor/random'

class InMemoryTaskQueue {
  static compareJobs(a, b) {
    if (a.priority > b.priority) {
      return -1
    }
    if (a.priority < b.priority) {
      return 1
    }
    if (a.createdAt > b.createdAt) {
      return -1
    }
    if (a.createdAt < b.createdAt) {
      return 1
    }
    return 0
  }
  constructor() {
    this._data = []
  }
  _findIndex(_id) {
    return this._data.findIndex(job => job._id === taskId)
  }
  insert(doc) {
    doc._id = `inMemory_${Random.id()}`
    this._data = [ ...this._data, doc ].sort(InMemoryTaskQueue.compareJobs)
  }
  findById(_id) {
    const _idx = this._findIndex(_id)
    if (_idx === -1) {
      return undefined
    }
    return this._data[_idx]
  }
  removeById(_id) {
    const _idx = this._findIndex(_id)
    if (_idx === -1) {
      return undefined
    }
    return this._data.splice(idx, 1)
  }
  // get available jobs (onGoing: false)
  availableTasks() {
    return this._data.filter(job => !job.onGoing)
  }
  // count available jobs (onGoing: false)
  count() {
    return this.availableTasks().length
  }
  // pull available jobs from the queue
  pull(limit) {
    const availableTasks = this.availableTasks()
    let res = []
    for (let i = 0; i < availableTasks.length && res.length < limit; i++) {
      availableTasks[i].onGoing = true
      res = [ ...res, availableTasks[i] ]
    }
    return res
  }
}

export default InMemoryTaskQueue
