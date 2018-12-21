(function () {
    "use strict";
    chrome.browserAction.onClicked.addListener((activeTab) => {
        chrome.tabs.create({ url: 'main.html', selected: true }, () => {});
    });
})();