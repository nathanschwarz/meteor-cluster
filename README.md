# meteor-cluster

Meteor Package enabling users to create a Worker Pool on the server to handle heavy jobs.

It can run synchronous and asynchronous tasks from a persitent / in-memory queue.

It can also run recurring and scheduled tasks.

# TaskQueue

  `TaskQueue` is both a Mongodb and an in-memory backed job queue.<br>
  It enables to add, update, remove jobs consistently between processes.

  You can attach event listeners to handle the tasks results / errors<br>

## prototype

  `TaskQueue.addTask({ taskType: String, data: Object, priority: Integer, _id: String, dueDate: Date, inMemory: Boolean })`
  - `taskType` is mandatory
  - `data` is mandatory but you can pass an empty object
  - `priority` is mandatory, default is set to 1
  - `_id` is optional
  - `dueDate` is mandatory, default is set to `new Date()`
  - `inMemory` is optional, default is set to `false`<br>

### Event listeners (Master only) :

  `TaskQueue.addEventListener(eventType: String, callback: function)`
  - `eventType` is one of `[ 'done', 'error' ]`
  - `callback` is a function prototyped as `callback({ value: Any, task: Task })`, `value` contains the result / error.<br>

  `TaskQueue.removeEventListener(eventType: String)`<br>
  - `eventType` is one of `[ 'done', 'error' ]`<br>

  note : you can only attach one event listener by eventType.<br>

### In-Memory Queue (Master only) :

  `TaskQueue.inMemory.findById(_id: String)`<br><br>
  `TaskQueue.inMemory.removeById(_id: String)`<br><br>
  `TaskQueue.inMemory.tasks()` : returns all in-memory tasks<br><br>
  `TaskQueue.inMemory.availableTasks()` : returns available in-memory tasks<br>

## note on the in-memory / persistent task queue

Both in-memory and persistent tasks are available at the same time, and can be used altogether but :

- in-memory tasks can only be created on the Master (which is because it's non persistent...)
- in-memory tasks will always be called first over persistent tasks even if their respective `priority` are greater.
- if you use both in-memory and persistent tasks at the same time, the persistent tasks will be called only when no in-memory tasks are available (may change later).<br><br>

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
  - `maxAvailableWorkers`: maximum number of child process (cores), default is set to system maximum
  - `port`: server port for child process servers, default set to `3008`
  - `refreshRate`: Worker pool refresh rate (in ms), default set to `1000`
  - `inMemoryOnly`: force the cluster to only pull jobs from the in-memory task queue.

  `Cluster.isMaster()`: `true` if this process is the master<br/>

  `Cluster.maxWorkers()`: returns the maximum number of workers available at the same time<br/>

  `setRefreshRate(refreshRate: Integer)`: change the refresh rate on the master

  if the Master process crashes or restarts, all the unfinished jobs will be restarted from the beginning.<br/>
  Each job is logged when started / finished with the format : `${timestamp}:task:${taskType}:${taskId}`<br/>

# CPUS allocation

You should not use the default `maxAvailableWorkers` (cpus allocation number) value.
The default value is set to your system cpus number, but it's a reference value.
It's up to you to understand your needs and allocate cpus accordingly.

## how can I calculate the maximum number of cpus I can allocate ?

for example, if you're running on a 8 core machine :

- The app you're running is using 1 cpu to run.
- You should have a reverse proxy on your server, you should at least save 1 cpu (may be more depending on your traffic).
- the database you're using is hosted on the same server, you should save 1 cpu for it.
- you're running an external service such as Redis or Elastic Search, so that's 1 down.

so you should have `maxAvailableWorkers = Cluster.maxWorkers() - 4 === 4`

## what if I allocated too much CPUS ?

You can't allocate more than your maximum system cpu number.
You still can outrange the theoretical maximum process number :

in such case your overall system should be **slowed down** because some of the processes execution will be deferred.
**It will drastically reduce the multi-core performance gain**

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

  function onJobsDone({ value, task }) {
    console.log('do something with the result')
  }

  function onJobsError({ value, task }) {
    console.log('do something with the error')
  }

  function syncTask() {
    return TaskQueue.addTask({ taskType: 'SYNC', data: {}})
  }

  function asyncTask() {
    return TaskQueue.addTask({ taskType: 'ASYNC', data: { timeout: 5000 }, priority: 6 })
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
      TaskQueue.addEventListener('done', onJobsDone)
      TaskQueue.addEventListener('error', onJobsError)

      syncTask()
      asyncTask()
      inMemoryTask(8, 1)
      inMemoryTask(1, 2)

      persistentTask(8, 1)
      persistentTask(1, 2)
    }
  })
```

# scheduled task example : run a task in ten minutes
```
  import { add } from 'date-fns/date' // external library to handle date objects

  const dueDate = add(new Date(), { minutes: 10 })
  TaskQueue.addTask({ taskType: 'sometype', priority: 1, data: {}, dueDate })
```

# scheduled task example : run a recurring task every ten minutes
```
  import { add } from 'date-fns/date' // external library to handle date objects

  function schedTask(job) {
    // do something
    const dueDate = add(new Date(), { minutes: 10 })
    TaskQueue.addTask({ taskType: 'schedTask', priority: 1, data: {}, dueDate })
  }

  const taskMap = {
    schedTask
  }
```
