
class Utils {
  constructor() {
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
        var ip = /^candidate:.+ (\S+) \d+ typ/.exec(e.candidate.candidate)[1];
        if (ips.indexOf(ip) == -1) // avoid duplicate entries (tcp/udp)
          ips.push(ip);
      };
      pc.createOffer(function(sdp) {
        pc.setLocalDescription(sdp);
      }, function onerror() {
        reject();
      });
      // 最多等待5秒
      setTimeout(() => {
        reject();
      }, 5000);
    })
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
}

const utils = new Utils();

