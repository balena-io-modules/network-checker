Promise = require 'bluebird'
request = Promise.promisifyAll require 'request'
net = require 'net'
_ = require 'lodash'

# options: An object of:
# bool checkFn(options): The function that will be used to check for connectivity.
#	interval: The time between each check.
#	checkHost options
# fn(bool connected): The function that will be called each time the state changes.
exports.monitor = monitor = (checkFn, options, fn) ->
	if not _.isFunction(checkFn)
		throw new Error("checkFn should be a Function")
	checkFn = Promise.method(checkFn)
	interval = options?.interval or 0
	connectivityState = null # Used to prevent multiple messages when disconnected
	_check = ->
		checkFn(options)
		.then (connected) ->
			return if connected == connectivityState
			connectivityState = connected
			fn(connected)
			return # Do not wait on fn if it returns a promise
		.finally ->
			setTimeout(_check, interval)
	_check()

# options: The url to check, or an object of request options.
#	timeout: 10s
#	gzip: true
exports.checkURL = checkURL = (options) ->
	if typeof options is 'string'
		options =
			url: options
	options.timeout ?= 10000
	options.gzip ?= true
	request
	.getAsync(options)
	.spread (response) ->
		return response.statusCode in [ 200, 304 ]
	.catch (e) ->
		return false

# options: The url to monitor, or an object of:
#	interval: The time between each check.
#	checkURL options
# fn(bool connected): The function that will be called each time the state changes.
exports.monitorURL = (options, fn) ->
	monitor(checkURL, options, fn)

# options: An object of net.connect options, with the addition of:
#	timeout: 10s
exports.checkHost = checkHost = (options) ->
	timeout = options?.timeout ? 10000
	socket = net.connect(options)
	new Promise (resolve, reject) ->
		socket
		.on('connect', resolve)
		.on('error', reject)
		.setTimeout(timeout, reject)
	.finally ->
		socket.destroy()
	.then ->
		return true
	.catch ->
		return false

# options: An object of:
#	interval: The time between each check.
#	checkHost options
# fn(bool connected): The function that will be called each time the state changes.
exports.monitorHost = (options, fn) ->
	monitor(checkHost, options, fn)
