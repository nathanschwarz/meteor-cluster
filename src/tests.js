const process = require('process')
import { Cluster, TaskQueue } from './index.js'

const taskMap = {
	simpleTest(job) {
		console.log(`\n\n[simpleTest][${job._id}]: running succesfully\n\n`)
	},
	simpleAsyncTest(job) {
		return new Promise((resolve, reject) => {
			Meteor.setTimeout(() => resolve(
				console.log(`\n\n[simpleAsyncTest][${job._id}]: running succesfully\n\n`)
			), 1000)
		})
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
	if (task.data.startsInMemory) {
		console.log('\n\n####### IN_MEMORY TESTS #######\n\n')
		TaskQueue.addTask({ _id: 'IN_MEMORY_SYNC', priority: 1, taskType: 'simpleTest', data: { isLastJob: false }, inMemory: true })
		TaskQueue.addTask({ _id: 'IN_MEMORY_ASYNC', priority: 1, taskType: 'simpleAsyncTest', data: { isLastJob: true }, inMemory: true })
	} else if (task.data.isLastJob) {
		console.log('\n\n####### TEST SUITE DONE #######\n\n')
	}
}

const cluster = new Cluster(taskMap)

function testSuite() {
	if (Cluster.isMaster()) {
		TaskQueue.addEventListener('done', onJobDone)
		console.log('####### MONGO TASKS TESTS #######\n\n')
		TaskQueue.addTask({ _id: 'MONGO_SYNC', priority: 1, taskType: 'simpleTest', data: { isLastJob: false }})
		TaskQueue.addTask({ _id: 'MONGO_ASYNC', priority: 1, taskType: 'simpleAsyncTest', data: { isLastJob: false, startsInMemory: true }})
	}
}

testSuite()