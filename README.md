ajax
============

`ajax` is a simple AJAX library based on ES6 Promises. It supports `XMLHttpRequest2` special data like `ArrayBuffer`, `Blob` and `FormData`. It is a fork of `qwest`.

Install
-------

```
npm install .. (to be finished)
bower install ..
jam install ..
```

Quick examples
--------------

```js
ajax.get('example.com')
.then(function(response) {
  console.log(response)
})
```

```js
ajax.post('example.com', {
  firstname: 'Pedro',
  lastname: 'Sanchez',
  age: 30
})
.then(function(response) {
  // Make some useful actions
})
.catch(function(e) {
  // Process the error
})
```

Basics
------

```js
ajax.`method`(`url`, `data`, `options`, `before`)
	 .then(function(response) {
		// Run when the request is successful
	 })
	 .catch(function(e) {
		// Process the error
	 })
```

The method is either `get`, `post`, `put` or `delete`. The `data` parameter can be a multi-dimensional array or object, a string, an ArrayBuffer, a Blob, etc... If you don't want to pass any data but specify some options, set data to `null`.

The available `options` are :

- dataType : `post` (by default), `json`, `text`, `arraybuffer`, `blob`, `document` or `formdata` (you don't need to specify XHR2 types since they're automatically detected)
- responseType : the response type; either `auto` (default), `json`, `xml`, `text`, `arraybuffer`, `blob` or `document`
- cache : browser caching; default is `false`
- async : `true` (default) or `false`; used to make asynchronous or synchronous requests
- user : the user to access to the URL, if needed
- password : the password to access to the URL, if needed
- headers : javascript object containing headers to be sent
- withCredentials : `false` by default; sends [credentials](http://www.w3.org/TR/XMLHttpRequest2/#user-credentials) with your XHR2 request ([more info in that post](https://dev.opera.com/articles/xhr2/#xhrcredentials))
- timeout : the timeout for the request in ms; `30000` by default
- attempts : the total number of times to attempt the request through timeouts; 1 by default; if you want to remove the limit set it to `null`
- before : (to be explained)

You can change the default data type with :

```js
(tbf)
```

If you want to make a call with another HTTP method, you can use the `map()` function :

```js
ajax.map('PATCH', 'example.com')
	 .then(function() {
	 	// Blah blah
	 })
```

Request limit
-------------

One of the greatest library functionnalities is the request limit. It avoids browser freezes and server overloads by freeing bandwidth and memory resources when you have a whole bunch of requests to do at the same time. Set the request limit and when the count is reached the library will stock all further requests and start them when a slot is free.

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
		 .then(function(xhr, response) {
			$this.attr('src', window.URL.createObjectURL(response))
			$this.fadeIn()
		 })
})
```

If you want to remove the limit, set it to `null`.

CORS and preflight requests
---------------------------

According to [#90](https://github.com/pyrsmk/qwest/issues/90) and [#99](https://github.com/pyrsmk/qwest/issues/99), a CORS request will send a preflight `OPTIONS` request to the server to know what is allowed and what's not. It's because we're adding a `Cache-Control` header to handle caching of requests. The simplest way to avoid this `OPTIONS` request is to set `cache` option to `true`. If you want to know more about preflight requests and how to really handle them, read this : https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS

Aborting a request
------------------

```js
// Start the request
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

Set options to the XHR object
-----------------------------

If you want to apply some manual options to the `XHR` object, you can use the `before` option

```js
ajax.get('example.com', null, { before: true })
     .before(function(xhr) {
		xhr.upload.onprogress = function(e) {
			// Upload in progress
		}
     })
	 .then(function(response) {
		// Blah blah blah
	 });
```

Handling fallbacks
------------------

XHR2 is not available on every browser, so, if needed, you can simply verify the XHR version with :

```js
if (ajax.xhr2) {
	// Actions for XHR2
}
else {
	// Actions for XHR1
}
```

Receiving binary data in older browsers
---------------------------------------

Getting binary data in legacy browsers needs a trick, as we can read it on [MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers). In this library, that's how we could handle it :

```js
ajax.get('example.com/file', null, {before: true})
     .before(function(xhr) {
		xhr.overrideMimeType('text\/plain; charset=x-user-defined')
	 })
	 .then(function(response) {
	 	// response is now a binary string
	 });
```

Compatibility notes
-------------------

According to this [compatibility table](https://kangax.github.io/compat-table/es5), IE7/8 do not support using `catch` and `delete` as method name because these are reserved words. If you want to support those browsers you should write :

```js
ajax.delete('example.com')
	 .then(function(){})
	 .catch(function(){});
```

Like this :

```js
ajax['delete']('example.com')
	 .then(function(){})
	 ['catch'](function(){});
```

(tbf: make a note about sync)

The CORS object shipped with IE8 and 9 is `XDomainRequest`. This object __does not__ support `PUT` and `DELETE` requests and XHR2 types. Moreover, the `getResponseHeader()` method is not supported too which is used in the `auto` mode for detecting the reponse type. Then, the response type automatically fallbacks to `json` when in `auto` mode. If you expect another response type, please specify it explicitly. If you want to specify another default response type to fallback in `auto` mode, you can do it like this :

```js
ajax.config.defaultXdrResponseType = 'text'
```

Last notes
----------

- Blackberry 10.2.0 (and maybe others) can [log an error saying json is not supported](https://github.com/pyrsmk/qwest/issues/94) : set `responseType` to `auto` to avoid the issue
- the `catch` handler will be executed for status codes different from `2xx`; if no data has been received when `catch` is called, `response` will be `null`
- `auto` mode is only supported for `xml`, `json` and `text` response types; for `arraybuffer`, `blob` and `document` you'll need to define explicitly the `responseType` option
- if the response of your request doesn't return a valid (and recognized) `Content-Type` header, then you __must__ explicitly set the `responseType` option
- the default `Content-Type` header for a `POST` request is `application/x-www-form-urlencoded`, for `post` and `xhr2` data types
- if you want to set or get raw data, set `dataType` option to `text`
- as stated on [StackOverflow](https://stackoverflow.com/questions/8464262/access-is-denied-error-on-xdomainrequest), XDomainRequest forbid HTTPS requests from HTTP scheme and vice versa
- IE8 only supports basic request methods

License
-------

[MIT license](http://dreamysource.mit-license.org) everywhere!
