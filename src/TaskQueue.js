import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Match } from 'meteor/check'

const cluster = require('cluster')

import InMemoryJobHelper from './inMemoryJobHelper'
import { logger } from './logs'

class MongoTaskQueue extends Mongo.Collection {
  constructor(props) {
    super(props)
    this.taskMap = {}
    this.inMemory = []
  }
  _inMemoryInsert(doc) {
    if (!cluster.isMaster) {
      throw new Error('cannot start inMemory job from child process')
    }
    this.inMemory = [ ...this.inMemory, doc ].sort(InMemoryJobHelper.compare)
  }
  _inMemoryPull(availableTasks, limit) {
    let res = []
    for (let i = 0; i < availableTasks.length && res.length < limit; i++) {
      availableTasks.onGoing = true
      res = [ ...res, availableTasks ]
    }
    return res
  }
  addTask({ taskType, priority = 1, data = {}, _id = null, inMemory: false }, cb = null) {
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
        doc._id = `inMemory_${doc.createdAt.time()}`
        return this._inMemoryInsert(doc)
      }
      return this.insert(doc, cb)
    }, 0)
  }
  removeTask(taskId) {
    if (taskId.startsWith('inMemory_')) {
      const idx = this.inMemory.findIndex(job => job._id === taskId)
      this.inMemory.splice(idx, 1)
      return taskId
    }
    return this.remove({ _id: taskId })
  }
  pull(limit = 1) {
    const availableInMemoryTasks = this.inMemory.filter(task => task.onGoing === false)
    if (availableInMemoryTasks.length > 0) {
      return this._inMemoryPull(availableInMemoryTasks, limit)
    }
    return this.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch().map(i => i._id)
  }
  async execute(job) {
    const begin = Date.now()

    const isInMemory = typeof(job) === 'object'
    const task = isInMemory ? job : this.findOne({ _id: job })
    const log = logger.extend(task.taskType).extend(task._id).extend('\t')
    log('started')
    await this.taskMap[task.taskType](task)
    const end = Date.now()
    const totalTime = end - begin
    log(`done in ${totalTime}ms`)
  }
  registerTaskMap(map = {}) {
    this.taskMap = map
  }
  _setIndexes() {
    this.rawCollection().createIndex({ taskType: 1 })
    this.rawCollection().createIndex({ onGoing: 1 })
    this.rawCollection().createIndex({ priority: -1, createdAt: 1 })
  }
  count() {
    if (this.inMemory.length > 0) {
      return this.inMemory.length
    }
    return this.find({ onGoing: false }).count()
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')

Meteor.startup(() => TaskQueue._setIndexes())

export default TaskQueue
