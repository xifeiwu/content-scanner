function getSecret() {
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


function encrypt(message, key, iv) {
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


function luhn(cardNum) {
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


function get_match_num(text, match_type) {
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
