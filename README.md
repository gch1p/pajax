pajax
============

`pajax` is a simple AJAX library based on ES6 Promises. It supports `XMLHttpRequest2` special data like `ArrayBuffer`, `Blob` and `FormData`. It was forked from [qwest](https://github.com/pyrsmk/qwest).

Differences to qwest
------------

- Removed all dependencies and `pinkyswear` as a Promise polyfill. Now using standard ES6 promises.
- Removed `async` option. No one needs to perform synchronous requests.
- Removed `before` callback, implemented a better way to access raw XHR object.
- Removed ability to chain request calls. I suggest to use standard `Promise.all` function.
- Changed a way to modify default configuration, added a few options.
- More clean code.

Install
-------

```
npm install --save pajax
```

I use `pajax` with WebPack, Babel transpiler and `es6-promises` polyfill.
An example on how to properly setup promises polyfill with WebPack you can find [here](https://gist.github.com/Couto/b29676dd1ab8714a818f).


Basics
------

```js
const ajax = require('pajax')

ajax.`method`(`url`, `data`, `options`)
.then(function(response) {
	// Run when the request is successful
})
.catch(function(e, response) {
	// Process the error
})
```

The `method` is either `get`, `post`, `put` or `delete`.

The `data` parameter can be a multi-dimensional array or object, a string, an ArrayBuffer, a Blob, etc... If you don't want to pass any data but specify some options, set data to `null`.

The available `options` are :

- ***dataType***: `post` (by default), `json`, `text`, `arraybuffer`, `blob`, `document` or `formdata` (you don't need to specify XHR2 types since they're automatically detected)
- ***responseType***: the response type; either `auto` (default), `json`, `xml`, `text`, `arraybuffer`, `blob` or `document`. auto mode is only supported for `xml`, `json` and `text` response types; for `arraybuffer`, `blob` and `document` you'll need to define explicitly the `responseType` option
- ***cache***: browser caching; default is `false`. Also see this [note](#cors)
- ***user***: the user to access to the URL, if needed
- ***password***: the password to access to the URL, if needed
- ***headers***: an object containing headers to be sent
- ***withCredentials***: `false` by default; sends [credentials](http://www.w3.org/TR/XMLHttpRequest2/#user-credentials) with your XHR2 request ([more info in that post](https://dev.opera.com/articles/xhr2/#xhrcredentials))
- ***timeout***: the timeout for the request in ms; `30000` by default
- ***attempts***: the total number of times to attempt the request through timeouts; 1 by default; if you want to remove the limit set it to `null`
- ***send***: whether to send the request immediately or not. Default is `true`. If you specify `false`, you have to manually call `send()` method of the returned Promise.

Returns ES6 Promise instance with `abort()` ([see here](#abort)) and `send()` methods and `xhr` ([see here](#before)) property added.

The `catch` handler will be executed for status codes different from `2xx`; if no data has been received when `catch` is called, `response` will be `null`.

You can also make a request with custom HTTP method using the `map()` function :

```js
ajax.map('PATCH', 'example.com', ...)
.then(function() {
	// Blah blah
})
```

Configuration
--------

You can control some of the library default behaviours by changing corresponding settings in `ajax.config` object.

The available settings are:
- ***defaultDataType***: `dataType` to be used by default if not specified in `options`. Default is `post`.
- ***defaultResponseType***: `responseType` to be used if unable to determine it by `Content-Type` header in `auto` mode. Default is `text`.
- ***defaultXdrResponseType***. The CORS object shipped with IE8 and 9 is `XDomainRequest`. This object __does not__ support `PUT` and `DELETE` requests and XHR2 types. Moreover, the `getResponseHeader()` method is not supported too which is used in the `auto` mode for detecting the reponse type. Then, the response type automatically fallbacks to default when in `auto` mode. If you expect another response type, you have to specify it explicitly. If you want to specify another default response type to fallback in `auto` mode, this is the option that controls it. Default is `text`.
- ***autoXRequestedWith***: by default, the lib adds `X-Requested-With: XMLHttpRequest` header to the request. You can disable it by setting this option to `false`. Default is `true`.
- ***limit***: maximum number of parallel requests. Default is `null` (no limit).

Request limit
-------------

One of the greatest library functionalities is the request limit. It avoids browser freezes and server overloads by freeing bandwidth and memory resources when you have a whole bunch of requests to do at the same time. Set the request limit and when the count is reached the library will stack all further requests and start them when a slot is free.

Let's say we have a gallery with a lot of images to load. We don't want the browser to download all images at the same time to have a faster loading. Let's see how we can do that.

```html
<div class="gallery">
	<img data-src="images/image1.jpg" alt="">
	<img data-src="images/image2.jpg" alt="">
	<img data-src="images/image3.jpg" alt="">
	<img data-src="images/image4.jpg" alt="">
	<img data-src="images/image5.jpg" alt="">
	...
</div>
```

```js
// Browsers are limited in number of parallel downloads, setting it to 4 seems fair
ajax.config.limit = 4

$('.gallery').children().forEach(function() {
	var $this = $(this)
	ajax.get($this.data('src'), {responseType: 'blob'})
	.then(function(response) {
		$this.attr('src', window.URL.createObjectURL(response))
		$this.fadeIn()
	})
})

// rewrite this example
```

<a name="cors"></a>CORS and preflight requests
---------------------------

According to [#90](https://github.com/pyrsmk/qwest/issues/90) and [#99](https://github.com/pyrsmk/qwest/issues/99), a CORS request will send a preflight `OPTIONS` request to the server to know what is allowed and what's not. It's because we're adding a `Cache-Control` header to handle caching of requests. The simplest way to avoid this `OPTIONS` request is to set `cache` option to `true`. If you want to know more about preflight requests and how to really handle them, read this : https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS

<a name="abort"></a>Aborting a request
------------------

You can abort a request by calling `abort()` method of the returned Promise.

```js
let request = ajax.get('example.com')
.then(function(response) {
	// Won't be called
})
.catch(function(response) {
	// Won't be called either
})

// Some code

request.abort()
```

<a name="before"></a>Access the XHR object
-----------------------------

You can access the XHR object by the `xhr` field of the returned Promise. If you want to get access to it before the request is sent, you have specify `send: false` option  to the request. In this case you have to manually send the request afterwards.

```js
let req = ajax.get('example.com', null, { send: false })
.then(function(response) {	
})

let xhr = req.xhr // Access the XHR object
// Some code

req.send() // Send the request
```

Handling fallbacks
------------------

XHR2 is not available on every browser, so, if needed, you can verify the XHR version with:

```js
if (ajax.xhr2) {
	// Actions for XHR2
} else {
	// Actions for XHR1
}
```

Receiving binary data in older browsers
---------------------------------------

Getting binary data in legacy browsers needs a trick, as we can read it on [MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers). In this library, that's how we could handle it:

```js
let req = ajax.get('example.com/file', null, { send: false })
.then(function(response) {
	// response is now a binary string
})
req.xhr.overrideMimeType('text\/plain; charset=x-user-defined')
req.send()
```


Other notes
----------

- Blackberry 10.2.0 (and maybe others) can [log an error saying json is not supported](https://github.com/pyrsmk/qwest/issues/94) : set `responseType` to `auto` to avoid the issue
- If you want to set or get raw data, set `dataType` option to `text`
- As stated on [StackOverflow](https://stackoverflow.com/questions/8464262/access-is-denied-error-on-xdomainrequest), XDomainRequest forbid HTTPS requests from HTTP scheme and vice versa
- IE8 only supports basic request methods

License
-------

[MIT license](http://dreamysource.mit-license.org)
