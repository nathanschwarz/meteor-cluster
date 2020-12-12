import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { Mongo } from 'meteor/mongo'
import { Match } from 'meteor/check'

const cluster = require('cluster')

import InMemoryJobHelper from './InMemoryJobHelper'
import { logger } from './logs'

class InMemoryTaskQueue {
  constructor() {
    this._data = []
  }
  _findIndex(_id) {
    return this._data.findIndex(job => job._id === taskId)
  }
  _pull(limit) {
    const availableTasks = this.availableTasks()
    let res = []
    for (let i = 0; i < availableTasks.length && res.length < limit; i++) {
      availableTasks[i].onGoing = true
      res = [ ...res, availableTasks[i] ]
    }
    return res
  }
  insert(doc) {
    this._data = [ ...this._data, doc ].sort(InMemoryJobHelper.compare)
  }
  findById(_id) {
    const _idx = this._findInMemoryIdx(_id)
    if (_idx === -1) {
      return undefined
    }
    return this._data[_idx]
  }
  removeById(_id) {
    const _idx = this._findInMemoryIdx(_id)
    if (_idx === -1) {
      return undefined
    }
    return this._data.splice(idx, 1)
  },
  availableTasks() {
    return this._data.filter(job => !job.onGoing)
  }
  count() {
    return this.availableTasks().length
  }
}

class MongoTaskQueue extends Mongo.Collection {
  constructor(props) {
    super(props)
    this.taskMap = {}
    if (cluster.isMaster) {
      this.inMemory = new InMemoryTaskQueue()
      // EVENTS
      this.listeners = {
        onDone: null,
        onError: null
      }
      this.addEventListener = (type, cb) => {
        if (this.listeners[type] !== undefined) {
          this.listeners[type] = cb
        }
      }
      this.removeEventListener = (type) => this.addEventListener(type,  null)
      this.onJobDone = (result, taskId) => Meteor.wrapAsync(async () => {
          let doc = null
          if (taskId.startsWith('inMemory_')) {
            const idx = this.findInMemory(taskId)
            doc =
          } else {
            doc = await this.rawCollection().findOneAndDelete({ _id: taskId })
          }
          if (this.listeners.onDone !== null) {
            this.listeners.onDone({ result, task: doc })
          }
          return doc._id
        }
      )
      this.pull = (limit = 1, inMemoryOnly = false) => {
        const inMemoryCount = this.inMemory.count()
        if (inMemoryCount > 0 || inMemoryOnly) {
          return this.inMemory.pull(limit)
        }
        return this.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch().map(i => i._id)
      }
      this.count = (inMemoryOnly = false)  => {
        const inMemoryCount = this.inMemory.count()
        if (inMemoryCount > 0 || inMemoryOnly) {
          return inMemoryCount
        }
        return this.find({ onGoing: false }).count()
      }
    } else {
      // CHILD PROCESS
      this.execute = async function(job) {
        const begin = Date.now()
        const isInMemory = typeof(job) === 'object'
        const task = isInMemory ? job : this.findOne({ _id: job })
        const log = logger.extend(task.taskType).extend(task._id).extend('\t')
        log('started')
        const result = await this.taskMap[task.taskType](task)
        const end = Date.now()
        const totalTime = end - begin
        log(`done in ${totalTime}ms`)
        return result
      }
    }
  }
  registerTaskMap(map = {}) {
    this.taskMap = map
  }
  addTask({ taskType, priority = 1, data = {}, _id = null, inMemory = false }, cb = null) {
    Meteor.setTimeout(() => {
      Match.test(taskType, String)
      Match.test(priority, Match.Integer)
      Match.test(data, Match.Object)
      Match.test(inMemory, Boolean)
      let doc = { taskType, priority, data, createdAt: new Date(), onGoing: false }
      if (_id != null) {
        doc._id = _id
      }
      if (inMemory) {
        if (!cluster.isMaster) {
          throw new Error('cannot start inMemory job from child process')
        }
        doc._id = `inMemory_${Random.id()}`
        return this.inMemory.insert(doc)
      }
      return this.insert(doc, cb)
    }, 0)
  }
  _setIndexes() {
    this.rawCollection().createIndex({ taskType: 1 })
    this.rawCollection().createIndex({ onGoing: 1 })
    this.rawCollection().createIndex({ priority: -1, createdAt: 1 })
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')

Meteor.startup(() => TaskQueue._setIndexes())

export default TaskQueue
