'use strict'

function getXHR() {
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest()
  }
  let xhr
  try {
    xhr = new ActiveXObject('Msxml2.XMLHTTP')
  } catch (e) {
    try {
      xhr = new ActiveXObject('Microsoft.XMLHTTP')
    } catch (e) {}
  }
  if (!xhr) {
    console.error('ajax.js: your browser does not support XMLHttpRequest')
  }
  return xhr
}

function AjaxPromise(executor = function() {}) {
  let _resolve, _reject
  let p = new Promise(function (resolve, reject) {
    _resolve = resolve
    _reject = reject
    return executor(resolve, reject)
  })

  p.__proto__ = AjaxPromise.prototype
  p._resolve = _resolve
  p._reject = _reject

  return p
}

AjaxPromise.__proto__ = Promise
AjaxPromise.prototype.__proto__ = Promise.prototype

AjaxPromise.prototype.then = function(onFulfilled, onRejected) {
  let p = Promise.prototype.then.call(this, onFulfilled, onRejected)
  return this._prepare(p)
}
AjaxPromise.prototype.catch = function(onFulfilled, onRejected) {
  let p = Promise.prototype.catch.call(this, onFulfilled, onRejected)
  return this._prepare(p)
}
AjaxPromise.prototype._prepare = function(instance) {
  if (!instance._prepared) {
    instance.abort = this.abort
    instance.send = this.send
    instance.xhr = this.xhr
    instance._prepared = true
  }
  return instance
}
AjaxPromise.prototype.resolve = function() {
  this._resolve.apply(this, arguments)
}
AjaxPromise.prototype.reject = function() {
  this._reject.apply(this, arguments)
}

function queryString(obj) {
  let buf = []
  for (let p in obj) {
    if (obj.hasOwnProperty(p)) {
      buf.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]))
    }
  }
  return buf.join('&')
}

// Variables for limit mechanism
let requests = 0
let request_stack = []

// Guess XHR version
const xhr2 = (function() {
  let xhr = getXHR()
  return xhr && xhr.responseType === ''
})()

const MimeTypes = {
  text: '*/*',
  xml: 'text/xml',
  json: 'application/json',
  post: 'application/x-www-form-urlencoded'
}
const Accept = {
  text: '*/*',
  xml: 'application/xml; q=1.0, text/xml; q=0.8, */*; q=0.1',
  json: 'application/json; q=1.0, text/*; q=0.8, */*; q=0.1'
}

/**
 * @param {String} method
 * @param {String} url
 * @param {Object|String} data
 * @param {Object} options
 * @return {Promise}
 */
function request(method, url, data = null, options = {}) {
  method = method.toUpperCase()

  // Define variables
  let nativeResponseParsing = false,
    crossOrigin,
    xhr,
    xdr = false,
    timeoutInterval,
    aborted = false,
    attempts = 0,
    headers = {},
    i, j,
    serialized,
    response,
    sending = false,
    delayed = false,
    timeout_start

  let promise = new AjaxPromise()
  promise.abort = abort
  promise.send = function() {
    // Prevent further send() calls
    if (sending) {
      return
    }

    // Reached request limit, get out!
    if (requests == ajax.config.limit) {
      request_stack.push(promise)
      return
    }
    ++requests
    sending = true

    // Start the chrono
    timeout_start = new Date().getTime()

    // Open connection
    if (xdr) {
      xhr.open(method, url)
    } else {
      xhr.open(method, url, true, options.user, options.password)
      if (xhr2) {
        xhr.withCredentials = options.withCredentials
      }
    }

    // Set headers
    if (!xdr) {
      for (let i in headers) {
        if (headers[i]) {
          xhr.setRequestHeader(i, headers[i])
        }
      }
    }

    // Verify if the response type is supported by the current browser
    if (xhr2 && options.responseType != 'document' && options.responseType != 'auto') { // Don't verify for 'document' since we're using an internal routine
      try {
        xhr.responseType = options.responseType
        nativeResponseParsing = (xhr.responseType == options.responseType)
      } catch (e) {}
    }

    // Plug response handler
    if (xhr2 || xdr) {
      xhr.onload = handleResponse
      xhr.onerror = handleError
    } else {
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          handleResponse()
        }
      }
    }

    // Override mime type to ensure the response is well parsed
    if (options.responseType != 'auto' && 'overrideMimeType' in xhr) {
      xhr.overrideMimeType(MimeTypes[options.responseType])
    }

    // Send request
    if (xdr) {
      // http://cypressnorth.com/programming/internet-explorer-aborting-ajax-requests-fixed/
      xhr.onprogress = function() {}
      xhr.ontimeout = function() {}
      xhr.onerror = function() {}
      // https://developer.mozilla.org/en-US/docs/Web/API/XDomainRequest
      setTimeout(function() {
        xhr.send(method != 'GET' ? data : null)
      })
    } else {
      xhr.send(method != 'GET' ? data : null)
    }
  }

  // Get XHR object
  xhr = getXHR()
  if (crossOrigin) {
    if (!('withCredentials' in xhr) && window.XDomainRequest) {
      xhr = new XDomainRequest() // CORS with IE8/9
      xdr = true
      if (method != 'GET' && method != 'POST') {
        console.warn('ajax.js: for request '+method+' '+url+' method will be forced to POST')
        method = 'POST'
      }
    }
  }

  promise.xhr = xhr
  promise._prepared = true

  function abort() {
    if (xhr) {
      xhr.abort()
      --requests
      aborted = true
    }
  }
  
  // Handle the response
  function handleResponse() {
    // Prepare
    let i, responseType
    --requests
    sending = false

    // Verify timeout state
    // --- https://stackoverflow.com/questions/7287706/ie-9-javascript-error-c00c023f
    if (new Date().getTime() - timeout_start >= options.timeout) {
      if (!options.attempts || ++attempts != options.attempts) {
        promise.send()
      } else {
        promise.reject(new Error('Timeout ('+url+')'), response)
      }
      return
    }

    // Launch next stacked request
    if (request_stack.length) {
      request_stack.shift().send()
    }

    // Handle response
    try {
      // Process response
      if (nativeResponseParsing && ('response' in xhr) && xhr.response !== null) {
        response = xhr.response
      } else if (options.responseType == 'document') {
        let frame = document.createElement('iframe')
        frame.style.display = 'none'
        document.body.appendChild(frame)
        frame.contentDocument.open()
        frame.contentDocument.write(xhr.response)
        frame.contentDocument.close()
        response = frame.contentDocument
        document.body.removeChild(frame)
      } else {
        // Guess response type
        responseType = options.responseType
        if (responseType == 'auto') {
          if (xdr) {
            responseType = ajax.config.defaultXdrResponseType
          } else {
            let ct = xhr.getResponseHeader('Content-Type') || ''
            if (ct.indexOf(MimeTypes.json) >- 1) {
              responseType = 'json'
            } else if (ct.indexOf(MimeTypes.xml) >- 1) {
              responseType = 'xml'
            } else {
              responseType = ajax.config.defaultResponseType
            }
          }
        }

        // Handle response type
        switch (responseType) {
        case 'json':
          if (xhr.responseText.length) {
            try {
              if ('JSON' in window) {
                response = JSON.parse(xhr.responseText)
              } else {
                response = eval('('+xhr.responseText+')')
              }
            } catch (e) {
              throw 'Error while parsing JSON body : ' + e
            }
          }
          break

        case 'xml':
          // Based on jQuery's parseXML() function
          try {
            // Standard
            if (window.DOMParser) {
              response = (new DOMParser()).parseFromString(xhr.responseText, 'text/xml')
            }
            // IE<9
            else {
              response = new ActiveXObject('Microsoft.XMLDOM')
              response.async = 'false'
              response.loadXML(xhr.responseText)
            }
          }
          catch (e) {
            response = undefined
            console.error('ajax.js: failed to parse XML', e)
          }
          if (!response || !response.documentElement || response.getElementsByTagName('parsererror').length) {
            throw 'Invalid XML'
          }
          break

        default:
          response = xhr.responseText
          break
        }
      }

      // Late status code verification to allow passing data when, per example,
      // a 409 is returned
      // --- https://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
      if ('status' in xhr && !/^2|1223/.test(xhr.status)) {
        throw xhr.status+' ('+xhr.statusText+')'
      }

      // Fulfilled
      promise.resolve(response)
    } catch (e) {
      // Rejected
      promise.reject(e, response)
    }
  }

  // Handle errors
  function handleError(e) {
    --requests
    promise.reject(e, null)
  }

  // Normalize options
  options.cache = 'cache' in options ? !!options.cache : false
  options.dataType = 'dataType' in options ? options.dataType.toLowerCase() : ajax.config.defaultDataType
  options.responseType = 'responseType' in options ? options.responseType.toLowerCase() : 'auto'
  options.user = options.user || ''
  options.password = options.password || ''
  options.withCredentials = !!options.withCredentials
  options.timeout = 'timeout' in options ? parseInt(options.timeout, 10) : 30000
  options.attempts = 'attempts' in options ? parseInt(options.attempts, 10) : 1
  options.send = 'send' in options ? !!options.send : true

  // Guess if we're dealing with a cross-origin request
  i = url.match(/\/\/(.+?)\//)
  crossOrigin = i && (i[1] ? i[1] != location.host : false)

  // Prepare data
  if ('ArrayBuffer' in window && data instanceof ArrayBuffer) {
    options.dataType = 'arraybuffer'
  }
  else if ('Blob' in window && data instanceof Blob) {
    options.dataType = 'blob'
  }
  else if ('Document' in window && data instanceof Document) {
    options.dataType = 'document'
  }
  else if ('FormData' in window && data instanceof FormData) {
    options.dataType = 'formdata'
  }
  switch (options.dataType) {
  case 'json':
    data = (data !== null ? JSON.stringify(data) : data)
    break

  case 'post':
    if (typeof data == 'object') {
      data = queryString(data)
    }
    break
  }

  // Prepare headers
  if (options.headers) {
    let format = (match, p1, p2) => p1 + p2.toUpperCase()
    for (i in options.headers) {
      headers[i.replace(/(^|-)([^-])/g, format)] = options.headers[i]
    }
  }
  if (!('Content-Type' in headers) && method != 'GET') {
    if (options.dataType in MimeTypes) {
      if (MimeTypes[options.dataType]) {
        headers['Content-Type'] = MimeTypes[options.dataType]
      }
    }
  }
  if (!headers.Accept) {
    headers['Accept'] = (options.responseType in Accept) ? Accept[options.responseType] : '*/*'
  }
  if (!crossOrigin && !('X-Requested-With' in headers) && ajax.config.autoXRequestedWith) { // (that header breaks in legacy browsers with CORS)
    headers['X-Requested-With'] = 'XMLHttpRequest'
  }
  if (!options.cache && !('Cache-Control' in headers)) {
    headers['Cache-Control'] = 'no-cache'
  }

  // Prepare URL
  if (method == 'GET' && data && typeof data == 'string') {
    url += (url.indexOf('?') != -1 ? '&' : '?') + data
  }

  // Start the request
  if (options.send) {
    promise.send()
  }

  // Return promise
  return promise
}

const ajax = {
  config: {
    // Default data type
    defaultDataType: 'post',
    // Default response type in auto mode
    defaultResponseType: 'text',
    // Default response type for XDR in auto mode
    defaultXdrResponseType: 'text',
    // Whether to add X-Requested-With: XMLHttpRequest header
    autoXRequestedWith: true,
    // Simultaneous requests limit
    limit: null
  },
  xhr2,

  get() {
    let args = ['GET']
    args.push.apply(args, arguments)
    return request.apply(window, args)
  },

  post() {
    let args = ['POST']
    args.push.apply(args, arguments)
    return request.apply(window, args)
  },

  put() {
    let args = ['PUT']
    args.push.apply(args, arguments)
    return request.apply(window, args)
  },

  delete() {
    let args = ['DELETE']
    args.push.apply(args, arguments)
    return request.apply(window, args)
  },

  map() {
    return request.apply(window, arguments)
  },

  getOpenRequests() {
    return requests
  }
}

module.exports = ajax
