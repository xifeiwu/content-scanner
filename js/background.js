/** global utils, axios */
// const utils = require('./utils');
// const axios = require('./axios');

const netHelper = new NetHelper();


chrome.runtime.onInstalled.addListener(function() {
  // chrome.storage.local.set({color: '#3aa757', startedAt: Number(new Date())}, function() {
  //   console.log("storage.local has set");
  // });
});

chrome.runtime.onConnect.addListener(function(port) {
  var tab = port.sender.tab;
  const portName = port.name;
  if (portName !== 'content-script') {
    return;
  }

  port.onMessage.addListener(async (pageInfo) => {
    console.log(pageInfo);
    netHelper.postPageInfo(pageInfo);
  });
});
  
utils.getLocalIPList().then(v => console.log(v));
