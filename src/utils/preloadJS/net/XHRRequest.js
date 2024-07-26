import AbstractLoader from "@/utils/preloadJS/loaders/AbstractLoader.js";
import URLUtils from "@/utils/base/URLUtils.js";
import Base from "@/utils/base/Base.js";
import {Event} from "@createjs/core";
import ErrorEvent from "@/utils/base/ErrorEvent.js";
import ProgressEvent from "@/utils/preloadJS/event/ProgressEvent.js";
import RequestUtils from "@/utils/base/RequestUtils.js";
import Methods from "@/utils/preloadJS/data/Methods.js";
export default class XHRRequest extends AbstractLoader {
  constructor(loadItem) {
    super(loadItem);
    // protected properties
    /**
     * A reference to the XHR request used to load the content.
     * @property _request
     * @type {XMLHttpRequest | XDomainRequest | ActiveX.XMLHTTP}
     * @private
     */
    this._request = null;

    /**
     * A manual load timeout that is used for browsers that do not support the onTimeout event on XHR (XHR level 1,
     * typically IE9).
     * @property _loadTimeout
     * @type {Number}
     * @private
     */
    this._loadTimeout = null;

    /**
     * The browser's XHR (XMLHTTPRequest) version. Supported versions are 1 and 2. There is no official way to detect
     * the version, so we use capabilities to make a best guess.
     * @property _xhrLevel
     * @type {Number}
     * @default 1
     * @private
     */
    this._xhrLevel = 1;

    /**
     * The response of a loaded file. This is set because it is expensive to look up constantly. This property will be
     * null until the file is loaded.
     * @property _response
     * @type {mixed}
     * @private
     */
    this._response = null;

    /**
     * The response of the loaded file before it is modified. In most cases, content is converted from raw text to
     * an HTML tag or a formatted object which is set to the <code>result</code> property, but the developer may still
     * want to access the raw content as it was loaded.
     * @property _rawResponse
     * @type {String|Object}
     * @private
     */
    this._rawResponse = null;

    this._canceled = false;

    // Setup our event handlers now.
    this._handleLoadStartProxy = Base.proxy(this._handleLoadStart, this);
    this._handleProgressProxy = Base.proxy(this._handleProgress, this);
    this._handleAbortProxy = Base.proxy(this._handleAbort, this);
    this._handleErrorProxy = Base.proxy(this._handleError, this);
    this._handleTimeoutProxy = Base.proxy(this._handleTimeout, this);
    this._handleLoadProxy = Base.proxy(this._handleLoad, this);
    this._handleReadyStateChangeProxy = Base.proxy(this._handleReadyStateChange, this);

    if (!this._createXHR(item)) {
      //TODO: Throw error?
    }
  }
  static ACTIVEX_VERSIONS = [
    "Msxml2.XMLHTTP.6.0",
    "Msxml2.XMLHTTP.5.0",
    "Msxml2.XMLHTTP.4.0",
    "MSXML2.XMLHTTP.3.0",
    "MSXML2.XMLHTTP",
    "Microsoft.XMLHTTP"
  ];
  /**
   * Look up the loaded result.
   * @method getResult
   * @param {Boolean} [raw=false] Return a raw result instead of a formatted result. This applies to content
   * loaded via XHR such as scripts, XML, CSS, and Images. If there is no raw result, the formatted result will be
   * returned instead.
   * @return {Object} A result object containing the content that was loaded, such as:
   * <ul>
   *      <li>An image tag (&lt;image /&gt;) for images</li>
   *      <li>A script tag for JavaScript (&lt;script /&gt;). Note that scripts loaded with tags may be added to the
   *      HTML head.</li>
   *      <li>A style tag for CSS (&lt;style /&gt;)</li>
   *      <li>Raw text for TEXT</li>
   *      <li>A formatted JavaScript object defined by JSON</li>
   *      <li>An XML document</li>
   *      <li>An binary arraybuffer loaded by XHR</li>
   * </ul>
   * Note that if a raw result is requested, but not found, the result will be returned instead.
   */
  getResult = function (raw) {
    if (raw && this._rawResponse) {
      return this._rawResponse;
    }
    return this._response;
  };

  // Overrides abstract method in AbstractRequest
  cancel = function () {
    this.canceled = true;
    this._clean();
    this._request.abort();
  };

  // Overrides abstract method in AbstractLoader
  load = function () {
    if (this._request == null) {
      this._handleError();
      return;
    }

    //Events
    if (this._request.addEventListener != null) {
      this._request.addEventListener("loadstart", this._handleLoadStartProxy, false);
      this._request.addEventListener("progress", this._handleProgressProxy, false);
      this._request.addEventListener("abort", this._handleAbortProxy, false);
      this._request.addEventListener("error", this._handleErrorProxy, false);
      this._request.addEventListener("timeout", this._handleTimeoutProxy, false);

      // Note: We don't get onload in all browsers (earlier FF and IE). onReadyStateChange handles these.
      this._request.addEventListener("load", this._handleLoadProxy, false);
      this._request.addEventListener("readystatechange", this._handleReadyStateChangeProxy, false);
    } else {
      // IE9 support
      this._request.onloadstart = this._handleLoadStartProxy;
      this._request.onprogress = this._handleProgressProxy;
      this._request.onabort = this._handleAbortProxy;
      this._request.onerror = this._handleErrorProxy;
      this._request.ontimeout = this._handleTimeoutProxy;

      // Note: We don't get onload in all browsers (earlier FF and IE). onReadyStateChange handles these.
      this._request.onload = this._handleLoadProxy;
      this._request.onreadystatechange = this._handleReadyStateChangeProxy;
    }

    // Set up a timeout if we don't have XHR2
    if (this._xhrLevel == 1) {
      this._loadTimeout = setTimeout(Base.proxy(this._handleTimeout, this), this._item.loadTimeout);
    }

    // Sometimes we get back 404s immediately, particularly when there is a cross origin request.  // note this does not catch in Chrome
    try {
      if (!this._item.values) {
        this._request.send();
      } else {
        this._request.send(URLUtils.formatQueryString(this._item.values));
      }
    } catch (error) {
      this.dispatchEvent(new ErrorEvent("XHR_SEND", null, error));
    }
  };

  setResponseType = function (type) {
    // Some old browsers doesn't support blob, so we convert arraybuffer to blob after response is downloaded
    if (type === 'blob') {
      type = window.URL ? 'blob' : 'arraybuffer';
      this._responseType = type;
    }
    this._request.responseType = type;
  };

  /**
   * Get all the response headers from the XmlHttpRequest.
   *
   * <strong>From the docs:</strong> Return all the HTTP headers, excluding headers that are a case-insensitive match
   * for Set-Cookie or Set-Cookie2, as a single string, with each header line separated by a U+000D CR U+000A LF pair,
   * excluding the status line, and with each header name and header value separated by a U+003A COLON U+0020 SPACE
   * pair.
   * @method getAllResponseHeaders
   * @return {String}
   * @since 0.4.1
   */
  getAllResponseHeaders = function () {
    if (this._request.getAllResponseHeaders instanceof Function) {
      return this._request.getAllResponseHeaders();
    } else {
      return null;
    }
  };

  /**
   * Get a specific response header from the XmlHttpRequest.
   *
   * <strong>From the docs:</strong> Returns the header field value from the response of which the field name matches
   * header, unless the field name is Set-Cookie or Set-Cookie2.
   * @method getResponseHeader
   * @param {String} header The header name to retrieve.
   * @return {String}
   * @since 0.4.1
   */
  getResponseHeader = function (header) {
    if (this._request.getResponseHeader instanceof Function) {
      return this._request.getResponseHeader(header);
    } else {
      return null;
    }
  };

// protected methods
  /**
   * The XHR request has reported progress.
   * @method _handleProgress
   * @param {Object} event The XHR progress event.
   * @private
   */
  _handleProgress = function (event) {
    if (!event || event.loaded > 0 && event.total == 0) {
      return; // Sometimes we get no "total", so just ignore the progress event.
    }

    let newEvent = new ProgressEvent(event.loaded, event.total);
    this.dispatchEvent(newEvent);
  };

  /**
   * The XHR request has reported a load start.
   * @method _handleLoadStart
   * @param {Object} event The XHR loadStart event.
   * @private
   */
  _handleLoadStart = function (event) {
    clearTimeout(this._loadTimeout);
    this.dispatchEvent("loadstart");
  };

  /**
   * The XHR request has reported an abort event.
   * @method handleAbort
   * @param {Object} event The XHR abort event.
   * @private
   */
  _handleAbort = function (event) {
    this._clean();
    this.dispatchEvent(new ErrorEvent("XHR_ABORTED", null, event));
  };

  /**
   * The XHR request has reported an error event.
   * @method _handleError
   * @param {Object} event The XHR error event.
   * @private
   */
  _handleError = function (event) {
    this._clean();
    this.dispatchEvent(new ErrorEvent(event.message));
  };

  /**
   * The XHR request has reported a readyState change. Note that older browsers (IE 7 & 8) do not provide an onload
   * event, so we must monitor the readyStateChange to determine if the file is loaded.
   * @method _handleReadyStateChange
   * @param {Object} event The XHR readyStateChange event.
   * @private
   */
  _handleReadyStateChange = function (event) {
    if (this._request.readyState == 4) {
      this._handleLoad();
    }
  };

  /**
   * The XHR request has completed. This is called by the XHR request directly, or by a readyStateChange that has
   * <code>request.readyState == 4</code>. Only the first call to this method will be processed.
   *
   * Note that This method uses {{#crossLink "_checkError"}}{{/crossLink}} to determine if the server has returned an
   * error code.
   * @method _handleLoad
   * @param {Object} event The XHR load event.
   * @private
   */
  _handleLoad = function (event) {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    let error = this._checkError();
    if (error) {
      this._handleError(error);
      return;
    }

    this._response = this._getResponse();
    // Convert arraybuffer back to blob
    if (this._responseType === 'arraybuffer') {
      try {
        this._response = new Blob([this._response]);
      } catch (e) {
        // Fallback to use BlobBuilder if Blob constructor is not supported
        // Tested on Android 2.3 ~ 4.2 and iOS5 safari
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
        if (e.name === 'TypeError' && window.BlobBuilder) {
          let builder = new BlobBuilder();
          builder.append(this._response);
          this._response = builder.getBlob();
        }
      }
    }
    this._clean();

    this.dispatchEvent(new Event("complete"));
  };

  /**
   * The XHR request has timed out. This is called by the XHR request directly, or via a <code>setTimeout</code>
   * callback.
   * @method _handleTimeout
   * @param {Object} [event] The XHR timeout event. This is occasionally null when called by the backup setTimeout.
   * @private
   */
  _handleTimeout = function (event) {
    this._clean();
    this.dispatchEvent(new ErrorEvent("PRELOAD_TIMEOUT", null, event));
  };

// Protected
  /**
   * Determine if there is an error in the current load.
   * Currently this checks the status of the request for problem codes, and not actual response content:
   * <ul>
   *     <li>Status codes between 400 and 599 (HTTP error range)</li>
   *     <li>A status of 0, but *only when the application is running on a server*. If the application is running
   *     on `file:`, then it may incorrectly treat an error on local (or embedded applications) as a successful
   *     load.</li>
   * </ul>
   * @method _checkError
   * @return {Error} An error with the status code in the `message` argument.
   * @private
   */
  _checkError = function () {
    let status = parseInt(this._request.status);
    if (status >= 400 && status <= 599) {
      return new Error(status);
    } else if (status == 0) {
      if ((/^https?:/).test(location.protocol)) { return new Error(0); }
      return null; // Likely an embedded app.
    } else {
      return null;
    }
  };


  /**
   * Validate the response. Different browsers have different approaches, some of which throw errors when accessed
   * in other browsers. If there is no response, the <code>_response</code> property will remain null.
   * @method _getResponse
   * @private
   */
  _getResponse = function () {
    if (this._response != null) {
      return this._response;
    }

    if (this._request.response != null) {
      return this._request.response;
    }

    // Android 2.2 uses .responseText
    try {
      if (this._request.responseText != null) {
        return this._request.responseText;
      }
    } catch (e) {
    }

    // When loading XML, IE9 does not return .response, instead it returns responseXML.xml
    try {
      if (this._request.responseXML != null) {
        return this._request.responseXML;
      }
    } catch (e) {
    }

    return null;
  };

  /**
   * Create an XHR request. Depending on a number of factors, we get totally different results.
   * <ol><li>Some browsers get an <code>XDomainRequest</code> when loading cross-domain.</li>
   *      <li>XMLHttpRequest are created when available.</li>
   *      <li>ActiveX.XMLHTTP objects are used in older IE browsers.</li>
   *      <li>Text requests override the mime type if possible</li>
   *      <li>Origin headers are sent for crossdomain requests in some browsers.</li>
   *      <li>Binary loads set the response type to "arraybuffer"</li></ol>
   * @method _createXHR
   * @param {Object} item The requested item that is being loaded.
   * @return {Boolean} If an XHR request or equivalent was successfully created.
   * @private
   */
  _createXHR = function (item) {
    // Check for cross-domain loads. We can't fully support them, but we can try.
    let crossdomain = URLUtils.isCrossDomain(item);
    let headers = {};

    // Create the request. Fallback to whatever support we have.
    let req = null;
    if (window.XMLHttpRequest) {
      req = new XMLHttpRequest();
      // This is 8 or 9, so use XDomainRequest instead.
      if (crossdomain && req.withCredentials === undefined && window.XDomainRequest) {
        req = new XDomainRequest();
      }
    } else { // Old IE versions use a different approach
      for (let i = 0, l = s.ACTIVEX_VERSIONS.length; i < l; i++) {
        let axVersion = s.ACTIVEX_VERSIONS[i];
        try {
          req = new ActiveXObject(axVersion);
          break;
        } catch (e) {
        }
      }
      if (req == null) {
        return false;
      }
    }

    // Default to utf-8 for Text requests.
    if (item.mimeType == null && RequestUtils.isText(item.type)) {
      item.mimeType = "text/plain; charset=utf-8";
    }

    // IE9 doesn't support overrideMimeType(), so we need to check for it.
    if (item.mimeType && req.overrideMimeType) {
      req.overrideMimeType(item.mimeType);
    }

    // Determine the XHR level
    this._xhrLevel = (typeof req.responseType === "string") ? 2 : 1;

    let src = null;
    if (item.method == Methods.GET) {
      src = URLUtils.buildURI(item.src, item.values);
    } else {
      src = item.src;
    }

    // Open the request.  Set cross-domain flags if it is supported (XHR level 1 only)
    req.open(item.method || Methods.GET, src, true);

    if (crossdomain && req instanceof XMLHttpRequest && this._xhrLevel == 1) {
      headers["Origin"] = location.origin;
    }

    // To send data we need to set the Content-type header)
    if (item.values && item.method == Methods.POST) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    if (!crossdomain && !headers["X-Requested-With"]) {
      headers["X-Requested-With"] = "XMLHttpRequest";
    }

    if (item.headers) {
      for (let n in item.headers) {
        headers[n] = item.headers[n];
      }
    }

    for (let n in headers) {
      req.setRequestHeader(n, headers[n])
    }

    if (req instanceof XMLHttpRequest && item.withCredentials !== undefined) {
      req.withCredentials = item.withCredentials;
    }

    this._request = req;

    return true;
  };

  /**
   * A request has completed (or failed or canceled), and needs to be disposed.
   * @method _clean
   * @private
   */
  _clean = function () {
    clearTimeout(this._loadTimeout);

    if (this._request.removeEventListener != null) {
      this._request.removeEventListener("loadstart", this._handleLoadStartProxy);
      this._request.removeEventListener("progress", this._handleProgressProxy);
      this._request.removeEventListener("abort", this._handleAbortProxy);
      this._request.removeEventListener("error", this._handleErrorProxy);
      this._request.removeEventListener("timeout", this._handleTimeoutProxy);
      this._request.removeEventListener("load", this._handleLoadProxy);
      this._request.removeEventListener("readystatechange", this._handleReadyStateChangeProxy);
    } else {
      this._request.onloadstart = null;
      this._request.onprogress = null;
      this._request.onabort = null;
      this._request.onerror = null;
      this._request.ontimeout = null;
      this._request.onload = null;
      this._request.onreadystatechange = null;
    }
  };

  toString = function () {
    return "[PreloadJS XHRRequest]";
  };
}