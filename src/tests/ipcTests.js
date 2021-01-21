function ipcSinglePingTest(job, toggleIPC) {
  return toggleIPC(
    (msg) => console.log(`\n\n${msg}\n\n`),
    (smtm) => smtm({ status: 4, data: 'ping' })
  )
}

function ipcMultiPingTest(job, toggleIPC) {
  return toggleIPC((msg) => {
      console.log(`\n\n${msg}\n\n`)
      return toggleIPC(
        (msg) => console.log(`\n\n${msg}\n\n`),
        (smtm) => smtm({ status: 4, data: 'ping' })
      )
    }, (smtm) => smtm({ status: 4, data: 'ping' })
  )
}

export { ipcSinglePingTest, ipcMultiPingTest }
