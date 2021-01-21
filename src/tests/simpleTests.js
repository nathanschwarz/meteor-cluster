import { Meteor } from 'meteor/meteor'
import { TaskQueue } from '../index.js'

function simpleTest(job) {
  console.log(`\n\n[simpleTest][${job._id}]: running succesfully\n\n`)
}

function simpleAsyncTest(job) {
  return new Promise((resolve, reject) => {
    Meteor.setTimeout(() => resolve(
      console.log(`\n\n[simpleAsyncTest][${job._id}]: running succesfully\n\n`)
    ), 1000)
  })
}


function logDiff(msDiff, taskType, _id) {
  if (msDiff < 0) {
    throw new Error(`\n\n[${taskType}][${_id}]: called too soon: diff is ${msDiff}ms\n\n`)
  } else if (msDiff > 1000) {
    throw new Error(`\n\n[${taskType}][${_id}]: called too late: diff is ${msDiff}ms\n\n`)
  }
  console.log(`\n\n[${taskType}][${_id}]: called on time: diff is ${msDiff}ms\n\n`)
}

function handleMsDiff(job) {
  const now = Date.now()
  const expectedDate = new Date(job.dueDate).getTime()
  const createdAt = new Date(job.createdAt).getTime()
  const wantedTime = expectedDate - createdAt
  const msDiff = Math.abs(now - expectedDate)
  logDiff(msDiff, job.taskType, job._id)
}

function simpleSchedTest(job) {
  handleMsDiff(job)
}

function simpleRecuringTest(job) {
  handleMsDiff(job)
  if (job.data.completeted < 3) {
    const dueDate = new Date()
    dueDate.setSeconds(dueDate.getSeconds() + 5)
    TaskQueue.addTask({ taskType: 'simpleRecuringTest', data: { ...job.data, completed: (job.data.completeted || 0) + 1, startsInMemory: job.data.completed === 2 }, dueDate })
  }
}

export {
  simpleTest,
  simpleAsyncTest,
  simpleSchedTest,
  simpleRecuringTest
}
