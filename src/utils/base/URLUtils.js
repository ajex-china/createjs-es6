import Elements from "@/utils/base/Elements.js";

export default class URLUtils{
  /**
   * The Regular Expression used to test file URLS for an absolute path.
   * @property ABSOLUTE_PATH
   * @type {RegExp}
   * @static
   */
  static ABSOLUTE_PATT = /^(?:\w+:)?\/{2}/i;

  /**
   * The Regular Expression used to test file URLS for a relative path.
   * @property RELATIVE_PATH
   * @type {RegExp}
   * @static
   */
  static RELATIVE_PATT = (/^[./]*?\//i);

  /**
   * The Regular Expression used to test file URLS for an extension. Note that URIs must already have the query string
   * removed.
   * @property EXTENSION_PATT
   * @type {RegExp}
   * @static
   */
  static EXTENSION_PATT = /\/?[^/]+\.(\w{1,5})$/i;

  /**
   * Parse a file path to determine the information we need to work with it. Currently, PreloadJS needs to know:
   * <ul>
   *     <li>If the path is absolute. Absolute paths start with a protocol (such as `http://`, `file://`, or
   *     `//networkPath`)</li>
   *     <li>If the path is relative. Relative paths start with `../` or `/path` (or similar)</li>
   *     <li>The file extension. This is determined by the filename with an extension. Query strings are dropped, and
   *     the file path is expected to follow the format `name.ext`.</li>
   * </ul>
   *
   * @method parseURI
   * @param {String} path
   * @returns {Object} An Object with an `absolute` and `relative` Boolean values,
   * 	the pieces of the path (protocol, hostname, port, pathname, search, hash, host)
   * 	as well as an optional 'extension` property, which is the lowercase extension.
   *
   * @static
   */
  static parseURI = function (path) {
    let info = {
      absolute: false,
      relative: false,
      protocol: null,
      hostname: null,
      port: null,
      pathname: null,
      search: null,
      hash: null,
      host: null
    };

    if (path == null) { return info; }

    // Inject the path parts.
    let parser = Elements.a();
    parser.href = path;

    for (let n in info) {
      if (n in parser) {
        info[n] = parser[n];
      }
    }

    // Drop the query string
    let queryIndex = path.indexOf("?");
    if (queryIndex > -1) {
      path = path.substr(0, queryIndex);
    }

    // Absolute
    let match;
    if (s.ABSOLUTE_PATT.test(path)) {
      info.absolute = true;

      // Relative
    } else if (s.RELATIVE_PATT.test(path)) {
      info.relative = true;
    }

    // Extension
    if (match = path.match(URLUtils.EXTENSION_PATT)) {
      info.extension = match[1].toLowerCase();
    }

    return info;
  };

  /**
   * Formats an object into a query string for either a POST or GET request.
   * @method formatQueryString
   * @param {Object} data The data to convert to a query string.
   * @param {Array} [query] Existing name/value pairs to append on to this query.
   * @static
   */
  static formatQueryString = function (data, query) {
    if (data == null) {
      throw new Error("You must specify data.");
    }
    let params = [];
    for (let n in data) {
      params.push(n + "=" + escape(data[n]));
    }
    if (query) {
      params = params.concat(query);
    }
    return params.join("&");
  };

  /**
   * A utility method that builds a file path using a source and a data object, and formats it into a new path.
   * @method buildURI
   * @param {String} src The source path to add values to.
   * @param {Object} [data] Object used to append values to this request as a query string. Existing parameters on the
   * path will be preserved.
   * @returns {string} A formatted string that contains the path and the supplied parameters.
   * @static
   */
  static buildURI = function (src, data) {
    if (data == null) {
      return src;
    }

    let query = [];
    let idx = src.indexOf("?");

    if (idx != -1) {
      let q = src.slice(idx + 1);
      query = query.concat(q.split("&"));
    }

    if (idx != -1) {
      return src.slice(0, idx) + "?" + this.formatQueryString(data, query);
    } else {
      return src + "?" + this.formatQueryString(data, query);
    }
  };

  /**
   * @method isCrossDomain
   * @param {LoadItem|Object} item A load item with a `src` property.
   * @return {Boolean} If the load item is loading from a different domain than the current location.
   * @static
   */
  static isCrossDomain = function (item) {
    let target = Elements.a();
    target.href = item.src;

    let host = Elements.a();
    host.href = location.href;

    let crossdomain = (target.hostname != "") &&
      (target.port != host.port ||
        target.protocol != host.protocol ||
        target.hostname != host.hostname);
    return crossdomain;
  };

  /**
   * @method isLocal
   * @param {LoadItem|Object} item A load item with a `src` property
   * @return {Boolean} If the load item is loading from the "file:" protocol. Assume that the host must be local as
   * well.
   * @static
   */
  static isLocal = function (item) {
    let target = Elements.a();
    target.href = item.src;
    return target.hostname == "" && target.protocol == "file:";
  };
}