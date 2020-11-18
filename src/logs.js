const debug = Npm.require('debug')

const logger = debug('task')
const warnLogger = debug('task_warn')
const errorLogger = debug('task_error')

logger.log = console.log.bind(console)
warnLogger.log = console.warn.bind(console)

debug.enable('task*')

export { logger, warnLogger, errorLogger }
