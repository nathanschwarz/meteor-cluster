import { ipcSinglePingTest, ipcMultiPingTest } from './ipcTests'
import { simpleTest, simpleAsyncTest, simpleSchedTest, simpleRecuringTest } from './simpleTests'

const taskMap = {
  simpleTest,
  simpleAsyncTest,
  simpleSchedTest,
  simpleRecuringTest,
  ipcSinglePingTest,
  ipcMultiPingTest
}

export default taskMap
