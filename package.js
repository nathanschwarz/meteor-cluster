Package.describe({
  name: 'nschwarz:cluster',
  version: '1.1.3',
  summary: 'native nodejs clusterization for meteor server',
  git: 'https://github.com/nathanschwarz/meteor-cluster.git',
  documentation: 'README.md'
})

Package.onUse((api) => {
  api.versionsFrom('1.9')
  api.use([ 'ecmascript', 'random' ])
  api.mainModule('src/index.js', 'server')
})

Npm.depends({
  debug: '4.2.0'
})
