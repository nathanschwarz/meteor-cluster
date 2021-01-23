import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { check } from 'meteor/check'

const cluster = require('cluster')

import InMemoryTaskQueue from './InMemoryTaskQueue'
import { logger, errorLogger } from './logs'

class MongoTaskQueue extends Mongo.Collection {
  // verify that the collection indexes are set
  _setIndexes() {
    this.rawCollection().ensureIndex({ taskType: 1 })
    this.rawCollection().ensureIndex({ onGoing: 1 })
    // remove post @1.2 index if it exists
    this.rawCollection().dropIndex({ priority: -1, createdAt: 1 }).catch(e => e)

    // add dueDate index for scheduled tasks in @1.2; add dueDate field to prior @1.2 tasks
    this.update({ dueDate: null }, { $set: { dueDate: new Date() }}, { multi: true })
    this.rawCollection().ensureIndex({ dueDate: 1, priority: -1, createdAt: 1 })
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
        } else {
          throw new Error(`TaskQueue: can't listen to ${type} event doesn't exists`)
        }
      }
      this.removeEventListener = (type) => this.addEventListener(type,  null)

      // remove the job from the queue when completed, pass the result to the done listener
      this.onJobDone = Meteor.bindEnvironment(async ({ result, taskId }) => {
        let doc = null
        if (taskId.startsWith('inMemory_')) {
          doc = this.inMemory.removeById(taskId)
        } else {
          doc = await this.rawCollection().findOneAndDelete({ _id: taskId }).then(res => res.value)
        }
        if (this.listeners.done !== null) {
          this.listeners.done({ value: result, task: doc })
        }
        return doc._id
      })

      // log job errors to the error stream, pass the error and the task to the error listener
      this.onJobError = Meteor.bindEnvironment(({ error, taskId }) => {
        let doc = null
        if (taskId.startsWith('inMemory_')) {
          doc = this.inMemory.findById(taskId)
        } else {
          doc = this.findOne({ _id: taskId })
        }
        if (this.listeners.error !== null) {
          this.listeners.error({ value: error, task: doc })
        }
        errorLogger(error)
        return doc._id
      })

      // pull available jobs from the queue
      this.pull = (inMemoryOnly = false) => {
        const inMemoryCount = this.inMemory.count()
        if (inMemoryCount > 0 || inMemoryOnly) {
          return this.inMemory.pull()
        }
        return this.rawCollection().findOneAndUpdate({ onGoing: false, dueDate: { $lte: new Date() }}, { $set: { onGoing: true }}, { sort: { priority: -1, createdAt: 1, dueDate: 1 }}).then(res => {
          if (res.value != null) {
            return res.value
          }
          return undefined
        })
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
      this.execute = async (job, toggleIPC) => {
        const begin = Date.now()
        const isInMemory = typeof(job) === 'object'
        const task = isInMemory ? job : this.findOne({ _id: job })
        const log = logger.extend(task.taskType).extend(task._id).extend('\t')
        log('started')
        const result = await this.taskMap[task.taskType](task, toggleIPC)
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
  addTask({ taskType, priority = 1, data = {}, _id = null, inMemory = false, dueDate = new Date() }, cb = null) {
    Meteor.setTimeout(() => {
      check.test(taskType, String)
      check.test(priority, Match.Integer)
      check.test(data, Match.Object)
      check.test(inMemory, Boolean)
      check.test(dueDate, Date)
      let doc = { taskType, priority, data, createdAt: new Date(), onGoing: false, dueDate }
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
