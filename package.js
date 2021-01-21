Package.describe({
  name: 'nschwarz:cluster',
  version: '2.0.0',
  summary: 'native nodejs clusterization for meteor server',
  git: 'https://github.com/nathanschwarz/meteor-cluster.git',
  documentation: 'README.md'
})

Package.onUse(api => {
  api.versionsFrom('1.9')
  api.use([ 'mongo', 'ecmascript', 'random' ])
  api.mainModule('src/index.js', 'server')
})

Npm.depends({
  debug: '4.2.0'
})

Package.onTest(api => {
	api.use('nschwarz:cluster')
	api.use([ 'ecmascript' ])
	api.mainModule('src/tests/_index.js')
})
