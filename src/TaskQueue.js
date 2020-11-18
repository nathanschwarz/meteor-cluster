import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Match } from 'meteor/check'
import { logger } from './logs'

class MongoTaskQueue extends Mongo.Collection {
  constructor(props) {
    super(props)
    this.taskMap = {}
  }
  addTask({ taskType, priority = 1, data = {}, _id = null }, cb = null) {
    Match.test(taskType, String)
    Match.test(priority, Match.Integer)
    Match.test(data, Object)
    let doc = { taskType, priority, data, createdAt: new Date(), onGoing: false }
    if (_id != null) {
      doc._id = _id
    }
    return this.insert(doc, cb)
  }
  pull(limit = 1) {
    return this.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch()
  }
  execute(jobId) {
    return new Promise((resolve, reject) => {
      const begin = Date.now()
      const job = this.findOne({ _id: jobId })
      logger(`[${job.taskType}][${job._id}]: started`)
      try {
        const task = super.taskMap[job.taskType](job)
        task.then(() => {
          const end = Date.now()
          const totalTime = end - begin
          this.remove({ _id: jobId })
          logger(`[${job.taskType}][${job._id}]: took ${totalTime}ms`)
          resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }
  registerTaskMap(map = {}) {
    this.taskMap = map
  }
  count() {
    return super.find({ onGoing: false }).count()
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')

Meteor.startup(() => {
  TaskQueue.rawCollection().createIndex({ taskType: 1 })
  TaskQueue.rawCollection().createIndex({ onGoing: 1 })
  TaskQueue.rawCollection().createIndex({ priority: -1, createdAt: 1 })
})

export default TaskQueue
