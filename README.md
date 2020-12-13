# meteor-cluster

Meteor Package enabling users to create a Worker Pool on the server to handle heavy jobs.
It can run synchronous and asynchronous tasks from a persitent / in-memory queue.

# TaskQueue
  `TaskQueue` is both a Mongodb and an in-memory backed job queue.<br>
  It enables to add, update, remove jobs consistently between processes.
  You can attach event listeners to handle the tasks results / errors<br><br>

## prototype

  `TaskQueue.addTask({ taskType: String, data: Object, priority: Integer, _id: String, inMemory: Boolean })`
  - `taskType` is mandatory
  - `data` is mandatory but you can pass an empty object
  - `priority` is mandatory, default is set to 1
  - `_id` is optional
  - `inMemory` is optional, default is set to `false`

  On the Master only :<br>

    Event listeners :<br>

    `TaskQueue.addEventListener(eventType: String, callback: function)`
    - `eventType` is one of `[ 'done', 'error' ]`
    - `callback` is a function prototyped as `callback({ value: Any, task: Task })`, `value` contains the result / error.

    `TaskQueue.removeEventListener(eventType: String)`
    - `eventType` is one of `[ 'done', 'error' ]`

    note : you can only attach one event listener by eventType.<br><br>

    In-Memory Queue :<br>

    `TaskQueue.inMemory.findById(_id: String)`

    `TaskQueue.inMemory.removeById(_id: String)`

    `TaskQueue.inMemory.tasks()` : returns all in-memory tasks

    `TaskQueue.inMemory.availableTasks()` : returns available in-memory tasks


# Cluster
  `Cluster` is an isomorphic class to handle both the Worker and the Master<br/><br/>
  on the Master it :
  - verifies if jobs are in the queue
  - verifies if workers are available, or create them
  - dispatches jobs to the workers
  - removes the task from the queue once the job is done
  - closes the workers when no jobs are available

  on the Worker it :
  - starts the job
  - when the job's done, tell the Master that it's available and to remove previous task.

  ## prototype

  `constructor(taskMap: Object, { port: Integer, maxAvailableWorkers: Integer, refreshRate: Integer, inMemoryOnly: Boolean })`
  - `taskMap`: a map of functions associated to a `taskType`
  - `maxAvailableWorkers`: maximum number of child process (cores), default set to maximum
  - `port`: server port for child process servers, default set to `3008`
  - `refreshRate`: Worker pool refresh rate (in ms), default set to `1000`
  - `inMemoryOnly`: force the cluster to only pull jobs from the in-memory task queue.

  `Cluster.isMaster()`: `true` if this process is the master<br/>

  `Cluster.maxWorkers()`: returns the maximum number of workers available at the same time<br/>

  `setRefreshRate(refreshRate: Integer)`: change the refresh rate on the master

  if the Master process crashes or restarts, all the unfinished jobs will be restarted from the beginning.<br/>
  Each job is logged when started / finished with the format : `${timestamp}:task:${taskType}:${taskId}`<br/>

# basic usage

```
  import { Meteor } from 'meteor/meteor'
  import { Cluster, TaskQueue } from 'meteor/nschwarz:cluster'

  const taskMap = {
    'TEST': job => console.log(`testing ${job._id} at position ${job.data.position}`),
    'SYNC': (job) => console.log("this is a synchrone task"),
    'ASYNC': (job) => new Promise((resolve, reject) => Meteor.setTimeout(() => {
      console.log("this is an asynchrone task")
      resolve()
    }, job.data.timeout))
  }

  function inMemoryTask(priority, position) {
   return TaskQueue.addTask({ taskType: 'TEST', priority, data: { position }, inMemory: true })
  }

  function persistentTask(priority, position) {
   return TaskQueue.addTask({ taskType: 'TEST', priority, data: { position }, inMemory: false })
  }

  const cluster = new Cluster(taskMap)
  Meteor.startup(() => {
    if (Cluster.isMaster()) {
      TaskQueue.addTask({ taskType: 'SYNC', data: {}})
      TaskQueue.addTask({ taskType: 'ASYNC', data: { timeout: 5000 }, priority: 6 })    

      inMemoryTask(8, 1)
      inMemoryTask(1, 2)
      inMemoryTask(3, 3)
      inMemoryTask(8, 4)
      inMemoryTask(8, 5)

      persistentTask(8, 1)
      persistentTask(1, 2)
      persistentTask(3, 3)
      persistentTask(8, 4)
      persistentTask(8, 5)
      persistentTask(8, 6)
    }
  })
```
# note on the in-memory / persistent task queue

Both in-memory and persistent tasks are available at the same time, and can be used altogether but :

- in-memory tasks can only be created on the Master (which is because it's non persistent...)
- in-memory tasks will always be called first over persistent tasks even if their respective `priority` are greater.
- if you use both in-memory and persistent tasks at the same time, the persistent tasks will be called only when no in-memory tasks are available (may change later).
