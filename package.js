Package.describe({
  name: 'nschwarz:cluster',
  version: '1.0.0',
  summary: 'native nodejs clusterization for meteor server',
  git: 'https://github.com/nathanschwarz/meteor-cluster.git',
  documentation: 'README.md'
})

Package.onUse((api) => {
  api.versionsFrom('1.9')
  api.use('check')
  api.use('meteor')
  api.addFiles('src/TaskQueue.js', 'server');
  api.addFiles('src/Worker.js', 'server');
  api.addFiles('src/Cluster.js', 'server');
  api.export('TaskQueue', 'server');
  api.export('Cluster', 'server');
})
