Package.describe({
  name: 'nschwarz:cluster',
  version: '1.0.2',
  summary: 'native nodejs clusterization for meteor server',
  git: 'https://github.com/nathanschwarz/meteor-cluster.git',
  documentation: 'README.md'
})

Package.onUse((api) => {
  api.versionsFrom('1.9')
  api.use([ 'ecmascript' ])
  api.mainModule('src/index.js', 'server')
})

Npm.depends({
  debug: '4.2.0'
})
