import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Match } from 'meteor/check'

class MongoTaskQueue extends Mongo {
  static insert({ taskType, priority = 1, data = {}, _id = null }, cb = null) {
    Match.test(taskType, String)
    Match.test(priority, Match.Integer)
    Match.test(data, Object)
    let doc = { taskType, priority, data, createdAt: new Date(), onGoing: false }
    if (_id != null) {
      doc._id = _id
    }
    return super.insert(doc, cb)
  },
  static _ensureIndex() {
    super.rawCollection().createIndex({ taskType: 1 })
    super.rawCollection().createIndex({ onGoing: 1 })
    super.rawCollection().createIndex({ priority: -1, createdAt: 1 })
  }
  static pull(limit = 1) {
    return super.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch()
  }
  static registerTaskMap(map = {}) {
    super.taskMap = map
  }
  static execute(jobId) {
    return new Promise((resolve, reject) => {
      const job = super.findOne({ _id: jobId })
        reject(`undefined task type ${taskType}`)
      }
      try {
        const task = super.taskMap[job.taskType](job)
        task.then(() => {
          //TODO logger
          resolve(super.remove({ _id: jobId }))
        })
      } catch (e) {
        reject(e)
      }
    })
  }
  static count() {
    return super.find({ onGoing: false }).count()
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')

Meteor.startup(TaskQueue._ensureIndex)

export default TaskQueue
