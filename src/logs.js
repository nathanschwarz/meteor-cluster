const debug = Npm.require('debug')

const logger = debug('nschwarz:cluster:TASK\t')
const warnLogger = debug('nschwarz:cluster:WARNING\t')
const errorLogger = debug('nschwarz:cluster:ERROR\t')

logger.log = console.log.bind(console)
warnLogger.log = console.warn.bind(console)

debug.enable('nschwarz:cluster*')

export { logger, warnLogger, errorLogger }
