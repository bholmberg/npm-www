module.exports = package

var LRU = require("lru-cache")
, regData = new LRU(10000)
, marked = require("marked")
, callresp = require("cluster-callresp")
, gravatar = require('gravatar').url

function package (params, cb) {
  var name, version

  if (typeof params === 'object') {
    name = params.name
    version = params.version
  } else {
    var p = params.split('@')
    name = p.shift()
    version = p.join('@')
  }
  version = version || 'latest'

  var k = name + '/' + version
  , data = regData.get(k)

  // remove excessively stale data
  // ignore anything over 10 minutes old
  if (data) {
    var age = Date.now() - data._time
    if (age > 10 * 60 * 1000) {
      regData.del(k)
      data = null
    }
  }

  if (data) return cb(null, data)

  callresp({ cmd: 'registry.get'
           , name: name
           , version: version }, function (er, data) {
    if (er) return cb(er)

    data._time = Date.now()
    if (data.readme) data.readme = parseReadme(data.readme)
    gravatarPeople(data)
    regData.set(k, data)
    return cb(null, data)
  })
}

function parseReadme (readme) {
  // allow <url>, but not arbitrary html tags.
  // any < must be the start of a <url> or <email@address>
  var e = /^<(?![^ >]+(@|:\/)[^ >]+>)/g
  readme = readme.replace(e, '&lt;')
  return marked.parse(readme)
}

function gravatarPeople (data) {
  gravatarPerson(data.author)
  if (data.maintainers) data.maintainers.forEach(function (m) {
    gravatarPerson(m)
  })
  if (data.contributors) data.contributors.forEach(function (m) {
    gravatarPerson(m)
  })
}

function gravatarPerson (p) {
  if (!p || typeof p !== 'object' || !p.email) {
    return
  }
  p.gravatar = gravatar(p.email, {s:50, d:'retro'}, true)
}
