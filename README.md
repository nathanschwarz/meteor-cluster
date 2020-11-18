# meteor-cluster

Meteor Package enabling users to create a Worker Pool on the server to handle heavy jobs.
It can run synchronous and asynchronous tasks.

# TaskQueue
  `TaskQueue.addTask({ taskType: String, data: Object, priority: Integer, _id: String })`
  - `taskType` is mandatory
  - `data` is mandatory but you can pass an empty object
  - `priority` is mandatory, default is set to 1
  - `_id` is optional

  `TaskQueue` is a Mongodb backed job queue.

# Cluster
  `Cluster.isMaster()`: `true` if this process is the master<br/>
  `Cluster.maxWorkers()`: returns the maximum number of workers available at the same time<br/>

  `constructor(taskMap: Object, masterOptions: { port: Integer, maxAvailableWorkers: Integer, refreshRate: Integer })`
  - `maxAvailableWorkers`: maximum number of child process (cores), default set to maximum
  - `port`: server port for child process servers, default set to `3008`
  - `refreshRate`: Worker pool refresh rate, default set to `1000`
  - `taskMap`: a map of functions associated to a `taskType`

  `Cluster` is the WorkerPool Handler<br/><br/>
  on the Master :
  - verifies if jobs are in the queue
  - verifies if workers are available, or create them
  - dispatches jobs to the workers
  - closes the workers when no jobs are available
  on the Worker :
  - starts the job

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
    if (Cluster.isMaster()) {
      TaskQueue.addTask({ taskType: 'SYNC', data: {}})
      TaskQueue.addTask({ taskType: 'ASYNC', data: { timeout: 5000 }, priority: 6 })    
    }
  })
```
