chrome.runtime.onConnect.addListener(function(port) {
  var tab = port.sender.tab;

  port.onMessage.addListener(function(info) {
    var xhr = new XMLHttpRequest();
    var data = new FormData();

    if (port.name == "sendPageInfo") {
      data.append("url", info.url);
      data.append("title", info.title);
      data.append("message", info.message);
      xhr.open('POST', 'http://127.0.0.1:7777', true);
      xhr.send(data);
    } else if (port.name == "getSecret") {
      data.append("version", "1.0.0");
      data.append("operation", "getconfig");
      xhr.open('POST', 'http://127.0.0.1:7777/getconfig', true);
      xhr.send(data);

      xhr.onreadystatechange = function(){
        if(xhr.readyState === 4 && xhr.status === 200) {
          resp = JSON.parse(xhr.responseText);
          code = resp.code;
          if (code == "2001") {
            console.log(resp);
            key = resp.key;
            iv = resp.iv;
            port.postMessage({"key": key, "iv": iv});
            chrome.storage.local.set({"secretkey": key, "secretiv": iv});
          }
        }
      };
    }
  });
});
