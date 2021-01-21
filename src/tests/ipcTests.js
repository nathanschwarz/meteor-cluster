function ipcSinglePingTest(job, toggleIPC) {
  return toggleIPC(
    (msg, closeIPC) => {
      console.log(`\n\n${msg}\n\n`)
      closeIPC()
    }, (smtm) => smtm({ status: 4, data: 'ping' })
  )
}

function ipcMultiPingTest(job, toggleIPC) {
  return toggleIPC(
    (msg, closeIPC) => {
      console.log(`\n\n${msg}\n\n`)
      closeIPC(
        toggleIPC(
          (msg, closeIPC) => {
            console.log(`\n\n${msg}\n\n`)
            closeIPC()
          }, (smtm) => smtm({ status: 4, data: 'ping' })
        )
      )
    }, (smtm) => smtm({ status: 4, data: 'ping' })
  )
}

export { ipcSinglePingTest, ipcMultiPingTest }
