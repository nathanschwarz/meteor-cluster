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
    Meteor.setTimeout(() => {
      Match.test(taskType, String)
      Match.test(priority, Match.Integer)
      Match.test(data, Match.Object)
      let doc = { taskType, priority, data, createdAt: new Date(), onGoing: false }
      if (_id != null) {
        doc._id = _id
      }
      return this.insert(doc, cb)
    }, 0)

  }
  pull(limit = 1) {
    return this.find({ onGoing: false }, { limit, sort: { priority: -1, createdAt: 1 }}).fetch()
  }
  async execute(jobId) {
    const begin = Date.now()
    const job = this.findOne({ _id: jobId })
    const log = logger.extend(job.taskType).extend(job._id).extend('\t')
    log('started')
    await this.taskMap[job.taskType](job)
    const end = Date.now()
    const totalTime = end - begin
    this.remove({ _id: jobId })
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
    return this.find({ onGoing: false }).count()
  }
}

const TaskQueue = new MongoTaskQueue('taskQueue')

Meteor.startup(() => TaskQueue._setIndexes())

export default TaskQueue
