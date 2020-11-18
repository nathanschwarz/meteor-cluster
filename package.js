Package.describe({
  name: 'nschwarz:cluster',
  version: '1.0.0',
  summary: 'Use modernizr in your meteor project',
  git: 'https://github.com/nathanschwarz/meteor-cluster.git',
  documentation: 'README.md'
})

Package.registerBuildPlugin({
  name: 'meteor-cluster',
  use: [],
  sources: [
    'index.js'
  ]
})

Package.onUse((api) => {
  api.versionsFrom('1.9')
  api.use('check')
})
