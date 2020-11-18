# meteor-cluster

# Cluster

# TaskQueue
  `TaskQueue.addTask({ taskType: String, data: Object, priority: Integer, _id: String(optional) })` : add a task in the queue

# basic usage

```
  import { Meteor } from 'meteor/meteor'
  import { Cluster, TaskQueue } from 'meteor/nschwarz:cluster'

  const taskMap = {
    'SYNC': (job) => console.log("this is a synchrone task"),
    'ASYNC': (job) => new Promise((resolve, reject) => Meteor.setTimeout(() => {
      console.log("this is an asynchrone task")
      resolve()
    }, job.data.timeout))
  }

  const cluster = new Cluster(taskMap)
  Meteor.startup(() => {
    TaskQueue.addTask({ taskType: 'SYNC', data: {}, priority: 1 })
    TaskQueue.addTask({ taskType: 'ASYNC', data: { timeout: 5000 }, priority: 6 })
  })
```
