const debug = Npm.require('debug')

const logger = debug('nschwarz:cluster:TASK')
const warnLogger = debug('nschwarz:cluster:WARNING\t')
const errorLogger = debug('nschwarz:cluster:ERROR\t')

logger.log = console.log.bind(console)
warnLogger.log = console.warn.bind(console)

debug.enable('nschwarz:cluster:ERROR*,nschwarz:cluster:WARNING*')

export { logger, warnLogger, errorLogger }
