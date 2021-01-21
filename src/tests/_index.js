import { Meteor } from 'meteor/meteor'
import { Cluster, TaskQueue } from '../index.js'
import taskMap from './taskMap'

function mongoJobs() {
  console.log('\n\n####### MONGO TASKS TESTS #######\n\n')
  TaskQueue.addTask({ taskType: 'simpleTest', data: {}})
  TaskQueue.addTask({ taskType: 'simpleAsyncTest', data: {}})
  TaskQueue.addTask({ taskType: 'ipcSinglePingTest', data: {}})
  const dueDate = new Date()
  dueDate.setSeconds(dueDate.getSeconds() + 5)
  TaskQueue.addTask({ taskType: 'simpleSchedTest', data: {}, dueDate })
  TaskQueue.addTask({ taskType: 'simpleRecuringTest', data: { }, dueDate })
  TaskQueue.addTask({ taskType: 'ipcMultiPingTest', data: {}})
}

function inMemoryJobs() {
  console.log('\n\n####### IN_MEMORY TESTS #######\n\n')
  TaskQueue.addTask({ taskType: 'simpleTest', data: {}, inMemory: true })
  TaskQueue.addTask({ taskType: 'simpleAsyncTest', data: {}, inMemory: true })
  TaskQueue.addTask({ taskType: 'simpleSchedTest', data: { isLastJob: true }, inMemory: true })
}

function cleanup() {
  console.log('\n\n####### CLEANING UP #######\n\n')
  TaskQueue.remove({ taskType: { $in: [
    'simpleTest',
    'simpleAsyncTest',
    'simpleSchedTest',
    'simpleRecuringTest',
    'ipcSinglePingTest',
    'ipcMultiPingTest'
  ]}})
}

function handleOtherEvents({ startsInMemory, isLastJob }) {
  if (startsInMemory) {
    inMemoryJobs()
  } else if (isLastJob) {
    Meteor.setTimeout(() => {
      cleanup()
      console.log('\n\n####### TEST SUITE DONE #######\n\n')
    }, 1000 * 10)
  }
}
function onJobDone(job) {
  const task = job.task
  const inMemory = task._id.startsWith('inMemory_')
  const exists = inMemory ? TaskQueue.inMemory.findById(job._id) : TaskQueue.findOne({ _id: job._id })

  if (exists === undefined) {
    console.log(`[${task.taskType}][${task._id}]: removed succesfully after execution`)
  } else {
    console.error(`[${task.taskType}][${task._id}]: still in queue after execution`)
  }
  handleOtherEvents(task.data)
}

function onJobError(job) {
  const task = job.task
  handleOtherEvents(task.data)
}

function messageBroker(respond, msg) {
  console.log(`\n\n${msg}\n\n`)
  if (msg.data === 'ping') {
    respond('pong')
  }
}

const cluster = new Cluster(taskMap, { refreshRate: 500, messageBroker })

function testSuite() {
  if (Cluster.isMaster()) {
    cleanup()
    TaskQueue.addEventListener('done', onJobDone)
    TaskQueue.addEventListener('error', onJobError)
    mongoJobs()
  }
}

Meteor.startup(testSuite)
