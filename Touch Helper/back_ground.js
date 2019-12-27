// use contextMenu in "persistent":false background (event page)
// ref https://qiita.com/MugeSo/items/e5307bda346c0bb8e22e
var ContextMenus = new function () {
    var items = {};
    var callbacks = {};

    this.setItems = function (aItems) {
        aItems.forEach(function (item) {
            callbacks[item.id] = item.onclick;
            item.onclick = null;
            items[item.id] = item;
        });
    };

    this.create = function () {
	chrome.storage.local.set({'show_tap_buttons': true}, function () {});
        Object.keys(items).forEach(
            function (key) {
                chrome.contextMenus.create(items[key]);
            }
        );
    };

    chrome.contextMenus.onClicked.addListener(function (info, tab) {
        callbacks[info.menuItemId](info, tab);
    });
};

ContextMenus.setItems([
    {
        id: 'touch helper buttons',
        title: 'show touch helper buttons',
        type: 'checkbox',
		checked: true,
		contexts: ['all'],
        onclick: show_hide_touch_helper_buttons
	},
	{
        id: 'touch helper scrollbar',
        title: 'show scrollbar',
        type: 'checkbox',
		checked: true,
		contexts: ['all'],
        onclick: show_hide_scrollbar
    }
]);

chrome.runtime.onInstalled.addListener(ContextMenus.create);
    
function show_hide_touch_helper_buttons(info, tab){
    if (info.checked) {
	chrome.storage.local.set({'show_tap_buttons': true}, function () {});
    } else {
	chrome.storage.local.set({'show_tap_buttons': false}, function () {});
    }
}
function show_hide_scrollbar(info, tab){
    if (info.checked) {
	chrome.storage.local.set({'show_scrollbar': true}, function () {});
    } else {
	chrome.storage.local.set({'show_scrollbar': false}, function () {});
    }
}

// refer 
// https://github.com/suzuki86/QuickTabSwitch

function closeTab() {
    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) { 
	    chrome.tabs.remove(tabArray[0].id, function() { });
	});
//    chrome.tabs.getCurrent(function(tab) {
//	chrome.tabs.remove(tab.id, function() { });
//    });
    
//    chrome.windows.getCurrent({populate: true}, function(window){
//	window.tabs.getCurrent(function(tab){
//	    chrome.tabs.remove(tab.id);
//	});
//    });
}


function go2RightTab() {
//    chrome.windows.getAll({populate: true}, function(windows){
//	jQuery.each(windows, function(win_idx, win){
    chrome.windows.getCurrent({populate: true}, function(win){
	    var active_tab_idx = -1;
	    var activated = false;
	    jQuery.each(win.tabs, function(tab_idx, tab){
                // Chrome専用のタブは無視する（「拡張機能」とか）
		//if(tab.url.indexOf("chrome://") != -1){
		//    return;
		//}
		if (tab.active) {active_tab_idx = tab_idx;}
	    });
	    if (active_tab_idx == win.tabs.length - 1) {
		chrome.tabs.update(win.tabs[0].id, {active: true});
	    } else {
		chrome.tabs.update(win.tabs[active_tab_idx + 1].id, {active: true});
	    }
	});
//    });
}

function go2LeftTab() {
//    chrome.windows.getAll({populate: true}, function(windows){
//	jQuery.each(windows, function(win_idx, win){
    chrome.windows.getCurrent({populate: true}, function(win){
	    var active_tab_idx = -1;
	    var activated = false;
	    jQuery.each(win.tabs, function(tab_idx, tab){
                // Chrome専用のタブは無視する（「拡張機能」とか）
		//if(tab.url.indexOf("chrome://") != -1){
		//    return;
		//}
		if (tab.active) {active_tab_idx = tab_idx;}
	    });
	    if (active_tab_idx == 0) {
		chrome.tabs.update(win.tabs[win.tabs.length - 1].id, {active: true});
	    } else {
		chrome.tabs.update(win.tabs[active_tab_idx - 1].id, {active: true});
	    }
	});
//    });
}

// to make sure calling multiple openLinkBackgroundTab() gets serial, use deferred.
var defer = new $.Deferred();
var promise = defer.promise();
defer.resolve(); // initially, it is resolved.

function openLinkBackgroundTab(link_url) {
    promise = promise.then(function(){
	var next_defer = new $.Deferred();
	chrome.windows.getCurrent({populate: true}, function(win){
	    var active_tab_id = -1;
	    var activated = false;
	    console.log("num of tabs:"+win.tabs.length);
	    jQuery.each(win.tabs, function(tab_idx, tab){
		// Chrome専用のタブは無視する（「拡張機能」とか）
	    //if(tab.url.indexOf("chrome://") != -1){
		//    return;
		//}
		if (tab.active) {active_tab_id = tab.id;}
	    });
	    
	    var most_right_tab_idx = -1;
	    jQuery.each(win.tabs, function(tab_idx, tab){
		if (tab.id == active_tab_id || 
		    tab.openerTabId == active_tab_id) {
		    most_right_tab_idx=tab_idx;
		}
	    });
	    most_right_tab_idx++;
	    chrome.tabs.create({index: most_right_tab_idx, 
				url: link_url, 
				active: false,
				openerTabId: active_tab_id});
	    
	    next_defer.resolve();
	});

	return next_defer.promise();
    });
}

function openLinkSecretBackgroundTab(link_url) {
    // if opening the link from secret window, use it.
    chrome.windows.getCurrent({populate: false}, function(win){
	if (win.incognito) {
	    // secret window is using now. 
	    openLinkBackgroundTab(link_url);
	} else {
	    // look for secret window if it was already opened.
	    chrome.windows.getAll({populate: true}, function(windows){
		var done = false;
		jQuery.each(windows, function(win_idx, win){
		    if (win.incognito) {
			chrome.tabs.create({windowId: win.id,
					    url: link_url, 
					    active: false});
			done = true;
			return false; // break each loop
		    }
		});
		if (done) {return;}

		// when new secret window is opened, it should get focused.
		chrome.windows.create({url: link_url, incognito: true, focused: true});		
	    });
	}
    });
}


chrome.runtime.onMessage.addListener(
	function(request,sender,sendResponse){
	    console.log("got a message!");
	    console.log(request);
	    console.log(sender);
	    var res;
	    var func;
	    if (request.op == "closeTab") {
		closeTab();
		res = "closeTab done!";
	    } else if (request.op == "go2RightTab") {
		go2RightTab();
		res = "go2RightTab done!";
	    } else if (request.op == "go2LeftTab") {
		go2LeftTab();
		res = "go2LeftTab done!";
	    } else if (request.op == "openLinkBackgroundTab") {
		openLinkBackgroundTab(request.url);
		res = "openLinkBackgroundTab("+request.url+") done!";		
	    } else if (request.op == "openLinkSecretBackgroundTab") {
		openLinkSecretBackgroundTab(request.url);
		res = "openLinkSecretBackgroundTab("+request.url+") done!";		
	    }
	    sendResponse(res);
	});

function activateTab(){
    chrome.extension.sendMessage(
	{
	    tabId: parseInt($(this).attr("href").substring(1))
	},
	function(response){
	    console.log(response.message);
	}
    );
    return false;
}
