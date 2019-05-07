
class Utils {
  constructor() {
    this.regMap = {
      mail: /^([\w-_]+(?:\.[\w-_]+)*)@((?:[a-z0-9]+(?:-[a-zA-Z0-9]+)*)+\.[a-z]{2,6})$/,
      ipOnly: /^([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})$/,
      ipWithMask: /^([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})\.([0-2]*[0-9]{1,2})(\/[0-9]+)?$/,
      number: /^[0-9]+$/
    }
  }
  getReg(type) {
    let result = null;
    if (this.regMap.hasOwnProperty(type)) {
      result = this.regMap[type];
    }
    return result;
  }

  isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  isInteger(n) {
    return Number.isInteger(n);
  }

  isString(s) {
    return typeof(s) === 'string' || s instanceof String;
  }

  isDate(n) {
    return n instanceof Date;
  }

  isObject(value) {
    var type = typeof value;
    return value != null && (type == 'object' || type == 'function');
  }

  isRegExp(obj) {
    return obj instanceof RegExp
  }

  escapeRegexp(str) {
    if (typeof str !== 'string') {
      throw new TypeError('Expected a string');
    }
    return String(str).replace(/([.*+?=^!:${}()|[\]\/\\])/g, '\\$1');
  }

  /**
   * Check if the given variable is a function
   * @method
   * @memberof Popper.Utils
   * @argument {Any} functionToCheck - variable to check
   * @returns {Boolean} answer to: is a function?
   */
  isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
  }

  // copy from node module shvl
  shvlGet (object, path, def) {
    return (object = (path.split ? path.split('.') : path).reduce(function (obj, p) {
      return obj && obj[p]
    }, object)) === undefined ? def : object;
  }
  shvlSet  (object, path, val, obj) {
    return ((path = path.split ? path.split('.') : path).slice(0, -1).reduce(function (obj, p) {
      return obj[p] = obj[p] || {};
    }, obj = object)[path.pop()] = val), object;
  }

  getUid() {
    function rid() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return `${rid()}_${rid()}_${rid()}_${rid()}_${Date.now()}`
  }
  
  /**
   * @return Promise, ip list
   */
  async getLocalIPList() {
    return new Promise((resolve, reject) => {
      var ips = [];
      var RTCPeerConnection = window.RTCPeerConnection ||
        window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
      var pc = new RTCPeerConnection({
        // Don't specify any stun/turn servers, otherwise you will
        // also find your public IP addresses.
        iceServers: []
      });
      // Add a media line, this is needed to activate candidate gathering.
      pc.createDataChannel('');
      // onicecandidate is triggered whenever a candidate has been found.
      pc.onicecandidate = function(e) {
        if (!e.candidate) {
          // Candidate gathering completed.
          resolve(ips);
          return;
        }
        var ip = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(e.candidate.candidate)[1];
        if (ips.indexOf(ip) == -1) { // avoid duplicate entries (tcp/udp)
          ips.push(ip);
        }
      };
      pc.createOffer(function(sdp) {
        pc.setLocalDescription(sdp);
      }, function onerror() {
        reject();
      });
      // 最多等待5秒
      setTimeout(() => {
        reject(ips);
      }, 5000);
    })
  }

  /**
   * transfer to formated date string
   * @date timestamp of date
   * @fmt the format of result, such as yyyy-MM-dd hh:mm:ss
   */
  formatDate(date, fmt) {
    if (!date) {
      return '未知';
    }
    if (!this.isDate(date)) {
      if (this.isString(date)) {
        date = parseInt(date);
      }
      if (this.isNumber(date)) {
        date = new Date(date);
      }
    }
    // console.log('date');
    // console.log(date);
    var o = {
      'M+': date.getMonth() + 1, //月份
      'd+': date.getDate(), //日
      'h+': date.getHours(), //小时
      'm+': date.getMinutes(), //分
      's+': date.getSeconds(), //秒
      'q+': Math.floor((date.getMonth() + 3) / 3), //季度
      'S': date.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
      if (new RegExp('(' + k + ')').test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
      }
    }
    return fmt;
  }

  getSecret() {
    return new Promise(function(resolve, reject){
      var secrethash = "";
      var key = "";
      var iv = "";
      chrome.storage.local.get(null, function(result){
        if (result.secrethash) {
          secrethash = result.secrethash;
          key = result.secretkey;
          iv = result.secretiv;
        }

        info = {
          "hash": secrethash,
        }
        var port = chrome.runtime.connect({name: "getSecret"})
        port.postMessage(info);
        port.onMessage.addListener(function(msg) {
          key = msg.key;
          iv = msg.iv;
        });

        resolve({"key": key, "iv": iv});
      });
    });
  }


  encrypt(message, key, iv) {
    var CBCOptions = {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode:CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
    var secretKey = CryptoJS.enc.Utf8.parse(key);
    var secretData = CryptoJS.enc.Utf8.parse(message);
    var encrypted = CryptoJS.AES.encrypt(secretData, secretKey, CBCOptions);
    return encrypted.toString();
  }


  luhn(cardNum) {
    if (!cardNum) {
      return false;
    }
    let len = cardNum.length;
    let carNumArr = Array.from(cardNum.slice(0, len));
    let tem = 0;
    for (let i = len-2; i >= 0; i -= 2) {
      tem = parseInt(cardNum[i]) * 2;
      carNumArr[i] = Math.floor(tem / 10) + tem % 10;
    }
    let result = 0;
    carNumArr.forEach(val => {
      result += parseInt(val);
    })
    return result % 10 == 0;
  }


  get_match_num(text, match_type) {
    pattern = {
      "mobile": /(\D)((13[0-9])|(14[5,7])|(15[0-3,5-9])|(17[0,3,5-8])|(18[0-9])|166|198|199|147)\d{8}(?![\dXx])/g,
      "idcard": /[1-9]\d{5}(19|20)\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx](?=\D)/g,
      "bankcard": /(1[08]|3[057]|4[0-9]|5[0-6]|58|6[02589]|8[478]|9[4589])\d{13,17}(?=\D)/g,
      "desensitive": /\d+\*{2,}\d+/g
    }
    match_result = text.match(pattern[match_type]);

    if ((match_type == "bankcard") && match_result) {
      match_result = match_result.filter((item)=>{return luhn(item)});
    }

    if (!match_result) {
      return 0;
    } else {
      return match_result.length;
    }
  }

  /*
   * 频率控制 返回函数连续调用时，fn 执行频率限定为每多少时间执行一次
   * @param fn {function}  需要调用的函数
   * @param delay  {number}    延迟时间，单位毫秒
   * @param immediate  {bool} 给 immediate参数传递false 绑定的函数先执行，而不是delay后后执行。
   * @return {function}实际调用函数
   */
  throttle(fn, delay, immediate, debounce) {
    var curr = +new Date(), //当前事件
      last_call = 0,
      last_exec = 0,
      timer = null,
      diff, //时间差
      context, //上下文
      args,
      exec = function() {
        last_exec = curr;
        fn.apply(context, args);
      };
    return function() {
      curr = +new Date();
      context = this,
        args = arguments,
        diff = curr - (debounce ? last_call : last_exec) - delay;
      clearTimeout(timer);
      if (debounce) {
        if (!immediate) {
          timer = setTimeout(exec, delay);
        } else if (diff >= 0) {
          exec();
        }
      } else {
        if (diff >= 0) {
          exec();
        } else if (!immediate) {
          timer = setTimeout(exec, -diff);
        }
      }
      last_call = curr;
    }
  }


  /*
   * 空闲控制 返回函数连续调用时，空闲时间必须大于或等于 delay，fn 才会执行
   * @param fn {function}  要调用的函数
   * @param delay   {number}    空闲时间
   * @param immediate  {bool} 给 immediate参数传递false 绑定的函数先执行，而不是delay后后执行。
   * @return {function}实际调用函数
   */
  debounce(fn, delay, immediate) {
    return this.throttle(fn, delay, immediate, true);
  }
  
  objectToQueryString (obj) {
    return Object.keys(obj).reduce(function (str, key, i) {
      var delimiter, val;
      delimiter = (i === 0) ? '?' : '&';
      key = encodeURIComponent(key);
      val = encodeURIComponent(obj[key]);
      return [str, delimiter, key, '=', val].join('');
    }, '');
  }

  parseQueryString(qs, sep, eq, options) {
    qs = qs.replace(/^[ ?]+/, '');
    sep = sep || '&';
    eq = eq || '=';
    var obj = {};
    if (typeof qs !== 'string' || qs.length === 0) {
      return obj;
    }
    try {
      var regexp = /\+/g;
      qs = qs.split(sep);
      var maxKeys = 1000;
      if (options && typeof options.maxKeys === 'number') {
        maxKeys = options.maxKeys;
      }
      var len = qs.length;
      // maxKeys <= 0 means that we should not limit keys count
      if (maxKeys > 0 && len > maxKeys) {
        len = maxKeys;
      }
      for (var i = 0; i < len; ++i) {
        var x = qs[i].replace(regexp, '%20'),
          idx = x.indexOf(eq),
          kstr, vstr, k, v;
        if (idx >= 0) {
          kstr = x.substr(0, idx);
          vstr = x.substr(idx + 1);
        } else {
          kstr = x;
          vstr = '';
        }
        k = decodeURIComponent(kstr);
        v = decodeURIComponent(vstr);
        if (!obj.hasOwnProperty(k)) {
          obj[k] = v;
        } else if (Array.isArray(obj[k])) {
          obj[k].push(v);
        } else {
          obj[k] = [obj[k], v];
        }
      }
    } catch (error) {
      console.log('error in parseQueryString:');
      console.log(error);
      obj = {};
    }
    return obj;
  }

  // 获取一个节点的文本内容
  getNodeText(node) {
    const tagName = node.tagName;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      return node.value;
    }
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].indexOf(node.tagName) > -1) {
      return '';
    }
    if (['DIV', 'A', 'SPAN', 'B', 'LI', 'TEXT', 'I', 'TH', 'TD'].indexOf(tagName) > -1) {
      return node.innerText;
    }
    return node.textContent;
  }

  // (通过递归的方式)获取node结点下的所有文本内容
  getTextAll(node) {
    if (!node) {
      return '';
    }
    const nodeType = node.nodeType;
    const tagName = node.tagName;

    if (nodeType == 8) {
      // 注释comments
      return '';
    } else if (['SCRIPT', 'STYLE', 'NOSCRIPT'].indexOf(tagName) > -1) {
      // 忽略script, style, noscript中的内容
      return '';
    } else if('IFRAME' === tagName) {
      // console.log(node);
      // console.log(node.contentWindow.document.body.textContent);
      // console.log(node.contentWindow.location.origin);
      // 获取iframe中的内容
      try {
        // 处理跨域的问题
        if (window.location.origin === node.contentWindow.location.origin) {
          return [node.contentWindow.href, '\n'].concat(
            Array.prototype.slice.call(node.contentWindow.document.body.childNodes).map(this.getTextAll.bind(this))
          ).join('');
        }
      } catch (err) {
        return '';
      }
    } else if (node.childNodes.length > 0) {
      return Array.prototype.slice.call(node.childNodes).map(this.getTextAll.bind(this)).join('');
    } else {
     var content = this.getNodeText(node);
     if (content) {
       return content.trim() + ' ';
     } else {
       return '';
     }
    }
  }
}

