$(function() {
    var CHECK_INTERVAL = 100; // msec
    var REFRESH_ELEMENT_ID = ":l";
    var TAP_BUTTON_ID = "masuda_tap_buttons";
    var GESTURE_INFO_ID = "masuda_gesture_info";
    var GESTURE_START_HOLD_OFF_TIME = 500; // in msec
    var GESTURE_MOVE_THRESHOLD = 30;
    var PATH_LINE_CSS_NAME = "masuda_path_line";
    var PATH_LINE_WIDTH = 5;
    var PATH_LINE_COLOR = "rgb(0, 0, 256)";
    var FIXED_SCROLL_MERGIN = 30;
    var DEBUG = 0;

    var show_buttons = true;
    var scroll_support = true;
    var scroll_element = null;

    var cur_link = "";
    var cur_links = Array();

    function sleep(aWait) {
        var timer = { timeup: false };

        var interval = window.setInterval(function(){
            timer.timeup = true;
        }, aWait);

        var thread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;
        while(!timer.timeup){
            thread.processNextEvent(true);
        }
        window.clearInterval(interval);
    }

    function dispatch_keydown(key_code) {
        var keyevent = new KeyboardEvent('keydown', {bubbles:true});
        Object.defineProperty(keyevent, 'charCode', {get:function(){return this.charCodeVal;}});
        keyevent.charCodeVal = key_code;
        document.body.dispatchEvent(keyevent);
    }
    function dispatch_keyup(key_code) {
        var keyevent = new KeyboardEvent('keyup', {bubbles:true});
        Object.defineProperty(keyevent, 'charCode', {get:function(){return this.charCodeVal;}});
        keyevent.charCodeVal = key_code;
        document.body.dispatchEvent(keyevent);
    }
    function dispatch_keydownup(key_code) {
	dispatch_keydown(key_code);
	dispatch_keyup(key_code);
    }


/////////////////////////
// Do something functions
/////////////////////////
    function do_close_tab() {
	chrome.runtime.sendMessage({op: "closeTab"},
				   function(response){
				       console.log("closeTab message sent");
				   });
    }

    function do_go2right_tab() {
	chrome.runtime.sendMessage({op: "go2RightTab"},
				   function(response){
				       console.log("go2RightTab message sent");
				   });
    }

    function do_go2left_tab() {
	chrome.runtime.sendMessage({op: "go2LeftTab"},
				   function(response){
				       console.log("go2LeftTab message sent");
				   });
    }
    function set_scroll_element() {
	var url = location.href;
	var path = location.pathname;
	if (url.match("https://docs.google.com/") ||
	    url.match("https://drive.google.com/") ||
	    url.match("https://photos.google.com/") ||
	    (url.match("https://www.google.com/") && path.match(/^\/maps\//)) ||
	    url.match("https://mail.google.com/") ||
	    url.match("https://news.google.com/")) {
	    scroll_support = false;
	}
	return;

	// it is hard to support scroll in google apps...
	if (scroll_element) {return;}
	// for google spreadsheets
	if (url.match("https://docs.google.com/") &&
	    path.match("/spreadsheets/d/")) {
	    var elm = $("#0-scrollable");
	    console.log("google spreadsheet detected");
	    console.log(elm[0]);
	    if (elm) {scroll_element = elm[0];}
	}
    }

    function get_scroll_element() {
	if (scroll_element) {
	    $(scroll_element).scroll();
	    return scroll_element;
	}
	else {return 'html,body';}
    }
    function get_scroll_height() {
	if (scroll_element) {return $(scroll_element).height();}
	else {return window.innerHeight;}
    }
    
    function do_scroll_top() {
	//	    dispatch_keydownup(36);
	$(get_scroll_element()).animate({
	    scrollTop: 0
	}, 'normal');
    }

    function do_scroll_bottom() {
//      dispatch_keydownup(35);
	$(get_scroll_element()).animate({
	    scrollTop: $(document).height()
	}, 'normal');	
    }

    function is_in_display(jq_obj) {
	var scroll_top    = $(window).scrollTop();
	var scroll_bottom = scroll_top + $(window).height();
	var target_top    = jq_obj.offset().top;
	var target_bottom = target_top + jq_obj.height();
	if (scroll_bottom > target_top && scroll_top < target_bottom) {
    	    return true;
	} else {
    	    return false;
	}
    }

    function get_header_height() {
	var header_mergin = 0;
	var header_tag = $("header");
	header_tag.each(function(i){
	    if ($(this).is(':visible') && is_in_display($(this))) {
		var header_height = header_tag.outerHeight(true);
		console.log("found header["+i+"]. height="+header_height);
		header_mergin += header_height;
	    } 
	});

	console.log("header_mergin="+header_mergin);
	
	return header_mergin;
    }

    function do_scroll_up() {
//      dispatch_keydownup(33);
	var elm=get_scroll_element();
	console.log($(get_scroll_element()));
	console.log($(get_scroll_element()).scrollTop());
	$(get_scroll_element()).animate({
	    scrollTop: $(get_scroll_element()).scrollTop()-
		(get_scroll_height() - FIXED_SCROLL_MERGIN - get_header_height())
	}, 'normal');
    }

    function do_scroll_down() {
//      dispatch_keydownup(34);
	$(get_scroll_element()).animate({
	    scrollTop: $(get_scroll_element()).scrollTop()+
		(get_scroll_height() - FIXED_SCROLL_MERGIN - get_header_height())
	}, 'normal');
    }

    function do_open_gmail() {
	window.location="https://gmail.com/";
    }

    function do_open_homepage() {
//	window.home(); // only for Firefox
//	window.location = "about:home";// IE
	// no way to open homepage in chrome... see,
	// https://groups.google.com/a/chromium.org/forum/#!topic/chromium-discuss/ek69f3oMs-I
	// https://stackoverflow.com/questions/4822619/how-to-forward-to-browsers-home-google-chrome
	window.location = "https://feedly.com/i/category/TITLE.news";
    }

    function do_go_back() {
	history.back();
    }

    function do_go_forward() {
	history.forward();
    }

    function do_open_link_in_background() {
	if (cur_link != undefined){
	    chrome.runtime.sendMessage({op: "openLinkBackgroundTab", url: cur_link},
				       function(response){
					   console.log("openLinkBackgroundTab message sent");
				       });
	}
    }

    function do_open_links_in_background() {
	if (cur_links.length > 0){
	    cur_links.forEach(function(a_url){
		chrome.runtime.sendMessage({op: "openLinkBackgroundTab", url: a_url},
					   function(response){
					       console.log("openLinkBackgroundTab message sent");
					   });
	    });
	}
    }
    
    function do_open_links_in_secret_background() {
	if (cur_link != undefined){
	    chrome.runtime.sendMessage({op: "openLinkSecretBackgroundTab", url: cur_link},
				       function(response){
					   console.log("openLinkSecretBackgroundTab message sent");
				       });
	}
    }
    
    function do_reload() {
	location.reload();
    }

    function do_reload_wo_cache() {
	location.reload(true);
    }

    function do_copy() {
	document.execCommand('copy');
    }

    function do_paste() {
	document.execCommand('paste');
    }

//////////
// buttons
//////////
    function create_tap_element(c, color, func) {
	var button = document.createElement('span');
        if (!button) {
            console.log("can not create "+c+" button");
            return NULL;
        }
        button.innerHTML = c;
	button.setAttribute("style",
			    "background:"+color+";"+
			    "display: inline-block;"+
			    "width: 35px;"+
			    "height: 35px;"+
			    "text-align: center;"+
			    "vertical-align:middle;"+
			    "font: 30px Helvetica, Arial, sans-serif;");
        button.onclick = func;
	return button;
    }

    function add_tap_buttons() {
        var body_nodes = document.getElementsByTagName('body');
        if (!body_nodes) {
            console.log("failed to get body element");
            return;
        }
        if (body_nodes.length != 1) {
            console.log("body.length="+body_nodes.length);
            return;
        }
        var body_node = body_nodes[0];
        var tap_buttons = document.createElement('div');
        if (!tap_buttons) {
            console.log("failed to create tap_buttons");
            return;
        }
        tap_buttons.id = TAP_BUTTON_ID;
        tap_buttons.style.visibility = "visible";
        tap_buttons.style.bottom = "5px";
        tap_buttons.style.right = "15px";
        tap_buttons.style.position = "fixed";
        tap_buttons.style.zIndex = "2147483647";
        tap_buttons.style.textAlign = "center";
        tap_buttons.style.cursor = "pointer";
        tap_buttons.style.opacity = "0.6";
	
        var close_button = create_tap_element("x", "#FF6666", function(){
	    do_close_tab();
	});

        var go2left_tab_button = create_tap_element("←", "#9933FF", function(){
	     do_go2left_tab();
	});

        var go2right_tab_button = create_tap_element("→", "#FF6600", function(){
	     do_go2right_tab();
	});

        var home_button = create_tap_element("⇑", "#6666FF", function(){
	    do_scroll_top();
	});

        var end_button = create_tap_element("⇓", "#66FF66", function(){
	    do_scroll_bottom();
	});

        var pgu_button = create_tap_element("↑", "#FFFF66", function(){
	    do_scroll_up();
	});

        var pgd_button = create_tap_element("↓", "#66FFFF", function(){
	    do_scroll_down();
	});



	if (!scroll_support) {
	    home_button.setAttribute("style", 
				     home_button.getAttribute("style")+
				     "visibility:hidden;");
	    end_button.setAttribute("style", 
				    end_button.getAttribute("style")+
				    "visibility:hidden;");
	    pgu_button.setAttribute("style", 
				    pgu_button.getAttribute("style")+
				    "visibility:hidden;");
	    pgd_button.setAttribute("style", 
				    pgd_button.getAttribute("style")+
				    "visibility:hidden;");
	}
        tap_buttons.appendChild(close_button);
        tap_buttons.appendChild(go2left_tab_button);
        tap_buttons.appendChild(go2right_tab_button);
        tap_buttons.appendChild(home_button);
        tap_buttons.appendChild(end_button);
        tap_buttons.appendChild(pgu_button);
        tap_buttons.appendChild(pgd_button);


        body_node.appendChild(tap_buttons);

    }

////////////////////////////////
// touch gesture using hammer.js
////////////////////////////////

    var sequence = "";
    var touch_start_timestamp = 0;
    var prev_pos;
    var prev_moving = "";
    var prev_pos_line;
    var in_gesture = false;
    var wait_gesture = true;

    var process_sequence_map = {
	"l"   : {str: "go back",          func: do_go_back},
	"r"   : {str: "go forward",       func: do_go_forward},
	"d"   : {str: "open link",        func: do_open_link_in_background},
	"u"   : {str: "open secret link", func: do_open_links_in_secret_background},
	"ud"  : {str: "reload",           func: do_reload},
	"udu" : {str: "reload w/o cache", func: do_reload_wo_cache},
	"dr"  : {str: "close tab",        func: do_close_tab},
	"lu"  : {str: "scroll top",       func: do_scroll_top},
	"ld"  : {str: "scroll bottom",    func: do_scroll_bottom},
	"udud": {str: "open gmail",       func: do_open_gmail},
	"ur"  : {str: "go to right tab",  func: do_go2right_tab},
	"ul"  : {str: "go to left tab",   func: do_go2left_tab},
	"rdl" : {str: "open links",       func: do_open_links_in_background},
	"durd": {str: "home",             func: do_open_homepage},
	"ldr" : {str: "copy",             func: do_copy},
	"du"  : {str: "paste",            func: do_paste}
    }

    function gen_gesture_info_html() {
	if (sequence == "") {
	    return "Gesture Started!";
	} else if (process_sequence_map[sequence] === undefined) {
	    var ret_str = "";
	    var seq_array = sequence.split("");
	    for (var i=0; i<sequence.length; i++) {
		if (seq_array[i] == "u") {ret_str += "↑";}
		else if (seq_array[i] == "d") {ret_str += "↓";}
		else if (seq_array[i] == "r") {ret_str += "→";}
		else if (seq_array[i] == "l") {ret_str += "←";}
	    }
	    ret_str += "";
	    return ret_str;
	} else {
	    return ""+process_sequence_map[sequence].str+"";
	}
    }

    function update_gesture_info(pos) {
	if ($('#'+GESTURE_INFO_ID)) {
	    $('#'+GESTURE_INFO_ID).html(gen_gesture_info_html());
	    var xPos = 0;
            if(pos.x < window.innerWidth/2) {
		xPos = pos.x; 
            } else {
		xPos = pos.x -  $('#'+GESTURE_INFO_ID).width();
            }

	    if (sequence == "") {
		$('#'+GESTURE_INFO_ID).css('background-color','#ff9999');
	    } else if (process_sequence_map[sequence] === undefined) {
		$('#'+GESTURE_INFO_ID).css('background-color','#ffff66');
	    } else {
		$('#'+GESTURE_INFO_ID).css('background-color','#99ff99');
	    }

	    $('#'+GESTURE_INFO_ID).offset({ "top": pos.y-80, "left": xPos});
//	    console.log("gesture_info moved to ("+pos.x+","+pos.y+")");
	} else {
	    console.log("no "+GESTURE_INFO_ID+" node found");
	}
    }

    function add_gesture_info() {
        var body_nodes = document.getElementsByTagName('body');
        if (!body_nodes) {
            console.log("failed to get body element");
            return;
        }
        if (body_nodes.length != 1) {
            console.log("body.length="+body_nodes.length);
            return;
        }
        var body_node = body_nodes[0];
        var gesture_info = document.createElement('div');
        if (!gesture_info) {
            console.log("failed to create gesture_info");
            return;
        }
        gesture_info.id = GESTURE_INFO_ID;
	gesture_info.setAttribute("style",
				  "white-space: nowrap;"+
				  "background-color:#ffffff;"+
				  "color:#000000;"+
//				  "border: 2px solid black;"+
				  "z-index: 214748367;"+
				  "position:absolute;"+
//				  "display: block;"+
				  "height: 35px;"+
				  "text-align: left;"+
				  "vertical-align:middle;"+
				  "margin:0;"+
				  "padding:0;"+
				  "font: 30px Helvetica, Arial, sans-serif;");
        body_node.appendChild(gesture_info);
    }
    
    function remove_gesture_info(){
	var gesture_info = document.getElementById(GESTURE_INFO_ID);
	if (gesture_info) {
	    gesture_info.parentNode.removeChild(gesture_info);
	}
    }

/*
//    var options = {
//	preventDefault: true
//    };
//    var hammertime = new Hammer(window, options);
    var hammertime = new Hammer(window);
    hammertime.get('press').set({time: GESTURE_START_HOLD_OFF_TIME});
    hammertime.on('press', function(ev) {
	if (ev.pointerType != "touch") {return;}
	console.log("Hammer press");
	console.log(ev);
	in_gesture = true;
	// suprress scroll
//	$(window).on('touchmove.noScroll', function(e) {
//	    e.preventDefault();
//	});

//      $(window).bind("touchmove" , TouchMove); // Jquery has not support possive:false.
	window.addEventListener('touchmove', TouchMove, {passive: false});
	add_gesture_info();
	update_gesture_info(get_position(ev));
    });
*/  

    $(window).bind("touchstart" , TouchStart);
    $(window).bind("touchend" , TouchLeave);

    function TouchStart( event ) {
	prev_moving = "";
	prev_pos = get_position(event);
	prev_pos_line = get_client_position(event);
	
	var date = new Date();
	touch_start_timestamp = date.getTime();

	console.log("start touch from ("+prev_pos.x+","+prev_pos.y+") at "+touch_start_timestamp);
	cur_link = $(event.target).closest('a').prop('href');
	cur_links.length=0;
	console.log("cur_link="+cur_link);
	$(window).bind("touchmove" , TouchMove);
	
   }

    function add_cur_links(link_url){
	for (var i=0; i<cur_links.length; i++) {
	    if (cur_links[i] == link_url) {
		// the link was already stored
		return;
	    }
	}
	cur_links.push(link_url);
	console.log(link_url+" is added");
    }

    
    function TouchMove( event ) {

	var pos_line = get_client_position(event);
	var dist_x = pos_line.x - prev_pos_line.x;
	var dist_y = pos_line.y - prev_pos_line.y;
	if (GESTURE_MOVE_THRESHOLD*GESTURE_MOVE_THRESHOLD < dist_x*dist_x + dist_y*dist_y) {
	    // not in gesture mode
	    wait_gesture = false;
	}
	
	
    }

    function TouchMoveWithGesture( event ) {

	if (!in_gesture){return;}

	event.preventDefault();
	
	var pos_line = get_client_position(event);
	path_line({x1: prev_pos_line.x, y1: prev_pos_line.y, x2: pos_line.x, y2:pos_line.y});
	prev_pos_line = pos_line;

	var pos = get_position(event);
	var dist_x = pos.x - prev_pos.x;
	var dist_y = pos.y - prev_pos.y;
	var cur_moving = "";
	if (Math.abs(dist_x) < Math.abs(dist_y)) {
	    // moving vertical
	    if (dist_y < -GESTURE_MOVE_THRESHOLD) {
		console.log("↑");
		cur_moving = "u";
	    } else if (GESTURE_MOVE_THRESHOLD < dist_y) {
		console.log("↓");
		cur_moving = "d";
	    }
	} else {
	    // moving horizontal
	    if (dist_x < -GESTURE_MOVE_THRESHOLD) {
		console.log("←");
		cur_moving = "l";
	    } else if (GESTURE_MOVE_THRESHOLD < dist_x) {
		console.log("→");
		cur_moving = "r";
	    }
	}
	if (cur_moving != "") {
	    prev_pos = pos;
	    if (cur_moving != prev_moving) {
		// moving direction was changed!
		sequence += cur_moving;
		prev_moving = cur_moving;
	    }
	}

	var canvas = document.getElementById(PATH_LINE_CANVAS_ID+"_div");
	if (canvas) {
	    canvas.style.visibility = "hidden";
//	    canvas.style.display = "none";
	}
	    
	var here = document.elementFromPoint(pos_line.x, pos_line.y);

	if (canvas) {
	    canvas.style.visibility = "visible";
//	    canvas.style.display = "block";
	}
	console.log(here);
	console.log($(event.target).closest('a').prop('href'));
//	console.log($(event.target).find('a').prop('href'));
	if ($(here).closest('a').prop('href') != undefined) {
	    add_cur_links($(here).closest('a').prop('href'));
	} 
	update_gesture_info(pos);
	
    }
    
    function TouchLeave( event ) {
//	$(window).off('.noScroll'); // reactivate scroll
	if (in_gesture) {
	    console.log("end touch gesture");
	    window.removeEventListener('touchmove', TouchMoveWithGesture);
	    process_sequence();
//	    $("."+PATH_LINE_CSS_NAME).remove();
	    clear_path_line();
	    remove_gesture_info();
	    in_gesture = false;
	} else {
	    console.log("end touch");
	}
	touch_start_timestamp = 0;
	wait_gesture = true;
	cur_link = "";
    }

 
    function get_position(e){
	var x,y;
	if (typeof e.originalEvent === "undefined") {
	    if (typeof e.changedTouches === "undefined") {
		// hammer event
		x = e.changedPointers[0].pageX;
		y = e.changedPointers[0].pageY;
	    } else {
		// javascript event
		x = e.changedTouches[0].pageX;
		y = e.changedTouches[0].pageY;
	    }
	} else {
	    // jquery event
	    x = e.originalEvent.touches[0].pageX;
	    y = e.originalEvent.touches[0].pageY;
	}
	x = Math.floor(x);
	y = Math.floor(y);
	var pos = {'x':x , 'y':y};
	return pos;
    }
   function get_client_position(e){
	var x,y;
	if (typeof e.originalEvent === "undefined") {
	    if (typeof e.changedTouches === "undefined") {
		// hammer event
		x = e.changedPointers[0].clientX;
		y = e.changedPointers[0].clientY;
	    } else {
		// javascript event
		x = e.changedTouches[0].clientX;
		y = e.changedTouches[0].clientY;
	    }
	} else {
	    // jquery event
	    x = e.originalEvent.touches[0].clientX;
	    y = e.originalEvent.touches[0].clientY;
	}
	x = Math.floor(x);
	y = Math.floor(y);
	var pos = {'x':x , 'y':y};
	return pos;
    }


///////////////////////////////////////
// path line
///////////////////////////////////////
    var PATH_LINE_CANVAS_ID = "masuda_canvas";

    function add_canvas() {
	$('body').append("<div id=\""+PATH_LINE_CANVAS_ID+"_div\" style=\"width:100%; height: 100%; position: fixed; top: 0; left: 0;z-index: 2147483646;\"><canvas id=\""+PATH_LINE_CANVAS_ID+"\"></canvas></div>");

	sizing();
	$(window).resize(function() {
            sizing();
	});
    }

    function sizing(){
	$("#"+PATH_LINE_CANVAS_ID).attr({height:$("#"+PATH_LINE_CANVAS_ID+"_div").height()});
	$("#"+PATH_LINE_CANVAS_ID).attr({width:$("#"+PATH_LINE_CANVAS_ID+"_div").width()});
    }


    function path_line(params) {
	var param = jQuery.extend({
            ID: 0,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
	}, params);

	var canvas = document.getElementById(PATH_LINE_CANVAS_ID);
	if ( ! canvas || ! canvas.getContext ) {
	    console.log("no canvas. create it.");
	    add_canvas();
	    canvas = document.getElementById(PATH_LINE_CANVAS_ID);
	    if ( ! canvas || ! canvas.getContext ) {
	    console.log("no canvas. failed to create it...");		
		return false;
	    }
	}
//	console.log(params);
//	console.log("line: ("+params.x1+","+params.y1+")-("+params.x2+","+params.y2+")");
	var ctx = canvas.getContext('2d');
	ctx.strokeStyle = PATH_LINE_COLOR;
	ctx.fillStyle = PATH_LINE_COLOR;
	ctx.lineWidth = PATH_LINE_WIDTH;
	ctx.beginPath();
	ctx.moveTo(params.x1, params.y1);
	ctx.lineTo(params.x2, params.y2);
	ctx.stroke();
    }

    function clear_path_line(){
	$("#"+PATH_LINE_CANVAS_ID+"_div").remove();
/*	var canvas = document.getElementById(PATH_LINE_CANVAS_ID);
	if ( ! canvas || ! canvas.getContext ) {
	    console.log("no canvas");
	    return false;
	}
	console.log("clear path");
	var ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
*/
}


    function process_sequence() {
	console.log("prosessing:"+sequence);
	if (process_sequence_map[sequence] === undefined) {
	    // no process is defined
	} else {
	    process_sequence_map[sequence].func();
	}
	sequence = "";
    }

///////////////////////////////////////
// interval timer
///////////////////////////////////////

    var interval_id = setInterval(
        function(){
	    if(typeof chrome!=='undefined' &&
	       typeof chrome.app!=='undefined' &&
	       typeof chrome.app.isInstalled!=='undefined'){
		chrome.storage.local.get('show_tap_buttons', function (value) {
		    show_buttons = value.show_tap_buttons;
		});
	    }
	    set_scroll_element();
            if (show_buttons && !document.getElementById(TAP_BUTTON_ID)) {
                add_tap_buttons();
            }
	    if (!show_buttons && document.getElementById(TAP_BUTTON_ID)) {
		$("#"+TAP_BUTTON_ID).remove();
	    }
	    var date = new Date();
	    if (wait_gesture && touch_start_timestamp != 0 && 
		date.getTime() - touch_start_timestamp > GESTURE_START_HOLD_OFF_TIME) {
		console.log("touch gesture start at "+date.getTime());
		wait_gesture = false;
		in_gesture = true;
		$(window).unbind("touchmove" , TouchMove);
		window.addEventListener('touchmove', TouchMoveWithGesture, {passive: false});
		add_gesture_info();
		update_gesture_info(prev_pos);
	    }
//	    if (sequence != "" &&
//		date.getTime() - newest_event_timestamp > (CHECK_INTERVAL/2)) {
//		process_sequence();
//		newest_event_timestamp = 0; // indicating done
//	    }

        },
        CHECK_INTERVAL);

    //    window.onload = function(){
    //	if (!document.getElementById(TAP_BUTTON_ID)) {
    //	    add_tap_buttons();
    //	}
    //    };




// for debug
    if (DEBUG) {
    window.document.addEventListener("keydown", dbg_keyevt, false);
    window.document.addEventListener("keypress", dbg_keyevt, false);
    window.document.addEventListener("keyup", dbg_keyevt, false);
    
    var tkeyname = {};
    tkeyname['8']='BackSpace';
    tkeyname['9']='Tab';
    tkeyname['13']='Enter';
    tkeyname['16']='Shift';
    tkeyname['17']='Ctrl';
    tkeyname['18']='Alt';
    tkeyname['19']='PauseBreak';
    tkeyname['20']='CapsLock';
    tkeyname['27']='Esc';
    tkeyname['32']='SPACE';
    tkeyname['33']='PageUp';
    tkeyname['34']='PageDown';
    tkeyname['35']='End';
    tkeyname['36']='Home';
    tkeyname['37']='←';
    tkeyname['38']='↑';
    tkeyname['39']='→';
    tkeyname['40']='↓';
    tkeyname['45']='Insert';
    tkeyname['46']='Delete';
    tkeyname['96']='0(ﾃﾝｷｰ)';
    tkeyname['97']='1(ﾃﾝｷｰ)';
    tkeyname['98']='2(ﾃﾝｷｰ)';
    tkeyname['99']='3(ﾃﾝｷｰ)';
    tkeyname['100']='4(ﾃﾝｷｰ)';
    tkeyname['101']='5(ﾃﾝｷｰ)';
    tkeyname['102']='6(ﾃﾝｷｰ)';
    tkeyname['103']='7(ﾃﾝｷｰ)';
    tkeyname['104']='8(ﾃﾝｷｰ)';
    tkeyname['105']='9(ﾃﾝｷｰ)';
    tkeyname['106']='*(ﾃﾝｷｰ)';
    tkeyname['107']='+(ﾃﾝｷｰ)';
    tkeyname['109']='-(ﾃﾝｷｰ)';
    tkeyname['110']='.(ﾃﾝｷｰ)';
    tkeyname['111']='/(ﾃﾝｷｰ)';
    tkeyname['144']='NumLock';
    tkeyname['145']='ScrollLock';
    tkeyname['112']='F1';
    tkeyname['113']='F2';
    tkeyname['114']='F3';
    tkeyname['115']='F4';
    tkeyname['116']='F5';
    tkeyname['117']='F6';
    tkeyname['118']='F7';
    tkeyname['119']='F8';
    tkeyname['120']='F9';
    tkeyname['121']='F10';
    tkeyname['122']='F11';
    tkeyname['123']='F12';
    tkeyname['186']='* or :';
    tkeyname['187']='+ or ;';
    tkeyname['188']='< or ,';
    tkeyname['189']='= or -';
    tkeyname['190']='> or .';
    tkeyname['191']='? or /';
    tkeyname['192']='* or :';
    tkeyname['219']='{ or [';
    tkeyname['220']='| or \\';
    tkeyname['221']='} or ]';
    tkeyname['222']='~ or ^';
    tkeyname['226']='_ or \\';
    
    var tpressname = {};
    tpressname['13']='Enter';
    tpressname['27']='Esc';
    tpressname['32']='SPACE';
    tpressname['38']='&amp;';
    
    function dbg_keyevt(evt){
	
//	var wkeycode=evt.which;
	var wkeycode=evt.charCodeVal;
	var dmane;
//	if(tkeyname[wkeycode]){
//		dname = tkeyname[wkeycode];}
//	else{
		dname = String.fromCharCode(wkeycode);
//	}

	console.log("DBG: "+evt.type+"! name="+dname+"("+wkeycode+") shft="+evt.shiftKey+" ctrl="+evt.ctrlKey+" alt="+evt.altKey);
    }
    }	





/*



    var DIST_THRESH = 500*500;
    var long_tapped = false;
    var cur_id = -1;


///////////////////////////////////////
// Let's use Hammer-time.js!!
// http://hammerjs.github.io/
///////////////////////////////////////
    function touchStart(e){
	console.log("enter touchStart");
	var interval = 1000;
	timer = setTimeout(function() 
			   {
			       console.log("long tap detected");
			       long_tapped = true;
			   }, interval);
	if (long_tapped) {
	    var touch_list = e.changedTouches;
	    var i;
	    var num = touch_list.length;
	    var prev_x = touch_list[0].pageX;
	    var prev_y = touch_list[0].pageY;
	    var prev_id = touch_list[0].identifier;
	    var prev_dir = ""; // u:up, d:down, l:left, r:right
	    var cur_dir = "";
	    var cur_start_x =  touch_list[0].pageX;
	    var cur_start_y =  touch_list[0].pageY;
	    for(i=1;i < num;i++){
		var touch = touch_list[i];
		cur_id = touch.identifier;
		if (prev_id != cur_id)
		var x_dist = (touch.pageX - prev_x)*(touch.pagex - prev_x);
		var y_dist = (touch.pageY - prev_y)*(touch.pageY - prev_y);
		var cur_total_dist = 
		    (touch.pageX - cur_start_x)*(touch.pageX - cur_start_x) + 
		    (touch.pageY - cur_start_y)*(touch.pageY - cur_start_y);
		var ud_dir = 0;
		var lr_dir = 0;
		if (0 < touch.pageX - prev_x){
		    lr_dir = "l";
		} else if (touch.pageX - prev_x < 0) {
		    lr_dir = "r";
		}
		if (0 < touch.pageY - prev_y) {
		    ud_dir = "d";
		} else if(touch.pageY - prev_y) {
		    ud_dir = "u";
		}
		if (x_dist < y_dist) {
		    cur_dir = ud_dir;
		} else if (y_dist < x_dist) {
		    cur_dir = lr_dist;
		}
		if (cur_dir != "") {
		    if (prev_dir != cur_dir && cur_tota_dist > DIST_THRESH) {
			// direction change!
			prev_dir = cur_dir;
		    
		}
		sprite.setId(id);
		sprite_container[id] = sprite;
	    }
	}
}

    }

    function clearFunction(){clearTimeout(timer);}

    function touchMove(){clearFunction();}
    function touchEnd(){clearFunction();}
    function onTouchCancel(){clearFunction();}
    


    var support_touchevent = Boolean( window.TouchEvent );
    if (support_touchevent) {
	console.log("touch event is supported");

	document.addEventListener("touchstart" , touchStart, false);//タップされた瞬間
	document.addEventListener("touchmove" , touchMove, false);//指を動かしている
	document.addEventListener("touchend" , touchEnd, false);//指が画面から離れた
	document.addEventListener("touchcancel" , onTouchCancel, false);
    }
*/

console.log("touch helper: contents script done");

});


