import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Match } from 'meteor/check'

const cluster = require('cluster')

import InMemoryTaskQueue from './InMemoryTaskQueue'
import { logger, errorLogger } from './logs'

class MongoTaskQueue extends Mongo.Collection {
  // verify that the collection indexes are set
  _setIndexes() {
    this.rawCollection().createIndex({ taskType: 1 })
    this.rawCollection().createIndex({ onGoing: 1 })
    this.rawCollection().createIndex({ priority: -1, createdAt: 1 })
  }
  constructor(props) {
    super(props)
    this.taskMap = {}
    if (cluster.isMaster) {
      Meteor.startup(() => this._setIndexes())
      this.inMemory = new InMemoryTaskQueue()

      // event listeners
      this.listeners = {
        done: null,
        error: null
      }
      this.addEventListener = (type, cb) => {
        if (this.listeners[type] !== undefined) {
          this.listeners[type] = cb
        }
      }
      this.removeEventListener = (type) => this.addEventListener(type,  null)

      // remove the job from the queue when completed, pass the result to the done listener
      this.onJobDone = async ({ result, taskId }) => {
        let doc = null
        if (taskId.startsWith('inMemory_')) {
          doc = this.inMemory.removeById(taskId)
        } else {
          doc = await this.rawCollection().findOneAndDelete({ _id: taskId })
        }
        if (this.listeners.done !== null) {
          this.listeners.done({ result, task: doc })
        }
        return doc._id
      }

      // log job errors to the error stream, pass the error and the task to the error listener
      this.onJobError = ({ error, taskId }) => {
        let doc = null
        if (taskId.startsWith('inMemory_')) {
          doc = this.inMemory.findById(taskId)
        } else {
          doc = this.findOne({ _id: taskId })
        }
        if (this.listeners.error !== null) {
          this.listeners.error({ error, task: doc })
        }
        errorLogger(error)
        return doc._id
      }

      // pull available jobs from the queue
      this.pull = (limit = 1, inMemoryOnly = false) => {
        const inMemoryCount = this.inMemory.count()
        if (inMemoryCount > 0 || inMemoryOnly) {
          return this.inMemory.pull(limit)
        }
        return this.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch().map(i => i._id)
      }

      // count available jobs (onGoing: false)
      this.count = (inMemoryOnly = false) => {
        const inMemoryCount = this.inMemory.count()
        if (inMemoryCount > 0 || inMemoryOnly) {
          return inMemoryCount
        }
        return this.find({ onGoing: false }).count()
      }
    } else {
      // execute the task on the child process
      this.execute = async (job) => {
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
        return this.inMemory.insert(doc)
      }
      return this.insert(doc, cb)
    }, 0)
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')
export default TaskQueue
