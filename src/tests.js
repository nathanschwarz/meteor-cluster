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
	},
	schedTest(job) {
		const now = Date.now()
		console.log(job)
		const expectedDate = new Date(job.dueDate).getTime()
		const createdAt = new Date(job.createdAt).getTime()
		const wantedTime = expectedDate - createdAt
		const msDiff = Math.abs(now - expectedDate)

		if (msDiff < 0) {
			throw new Error(`\n\n[schedTest][${job._id}]: called too soon: diff is ${msDiff}ms\n\n`)
		} else if (msDiff > 1000) {
			throw new Error(`\n\n[schedTest][${job._id}]: called too late: diff is ${msDiff}ms\n\n`)
		}
		console.log(`\n\n[schedTest][${job._id}]: called on time: diff is ${msDiff}ms\n\n`)
	}
}

function inMemoryJobs() {
	console.log('\n\n####### IN_MEMORY TESTS #######\n\n')
	TaskQueue.addTask({ _id: 'IN_MEMORY_SYNC', priority: 1, taskType: 'simpleTest', data: { isLastJob: false }, inMemory: true })
	TaskQueue.addTask({ _id: 'IN_MEMORY_ASYNC', priority: 1, taskType: 'simpleAsyncTest', data: { isLastJob: true }, inMemory: true })
}

function cleanup() {
	console.log('\n\n####### CLEANING UP #######\n\n')
	TaskQueue.remove({ _id: { $in: [ 'MONGO_SYNC', 'MONGO_ASYNC', 'SCHED' ]}})
}

function handleOtherEvents({ startsInMemory, isLastJob }) {
	if (startsInMemory) {
		inMemoryJobs()
	} else if (isLastJob) {
		cleanup()
		console.log('\n\n####### TEST SUITE DONE #######\n\n')
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

const cluster = new Cluster(taskMap, { refreshRate: 500 })

function testSuite() {
	if (Cluster.isMaster()) {
		cleanup()
		TaskQueue.addEventListener('done', onJobDone)
		TaskQueue.addEventListener('error', onJobError)
		console.log('\n\n####### MONGO TASKS TESTS #######\n\n')
		TaskQueue.addTask({ _id: 'MONGO_SYNC', priority: 1, taskType: 'simpleTest', data: { isLastJob: false }})
		TaskQueue.addTask({ _id: 'MONGO_ASYNC', priority: 1, taskType: 'simpleAsyncTest', data: { isLastJob: false }})
		console.log('\n\n####### SCHED TEST #######\n\n')
		const dueDate = new Date()
		dueDate.setSeconds(dueDate.getSeconds() + 5)
		TaskQueue.addTask({ _id: 'SCHED', priority: 1, taskType: 'schedTest', data: { isLastJob: false, startsInMemory: true }, dueDate })
	}
}

Meteor.startup(testSuite)