// ==UserScript==
// @name         Tf2 Inventory History Downloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Download your tf2 inventory history from https://steamcommunity.com/my/inventoryhistory/?app[]=440&l=english
// @author       jh34ghu43gu
// @match        https://steamcommunity.com/*/inventoryhistory*
// @icon         https://wiki.teamfortress.com/wiki/Mann_Co._Supply_Crate_Key#/media/File:Backpack_Mann_Co._Supply_Crate_Key.png
// @require      http://code.jquery.com/jquery-latest.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM_getValue
// ==/UserScript==

console.log("Tf2 Inventory History Downloader Script is active.");
var IHD_json_object = {};
var IHD_loop;
var IHD_counter = 0;
var IHD_ready_to_load = true;
var prevCursor;
const IHD_item_attribute_blacklist = [
    "icon_url",
    "icon_url_large",
    "icon_drag_url",
    "name", //market_hash_name has wears unlike this one
    "market_name",
    "name_color",
    "background_color",
    "commodity",
    "classid",
    "instanceid",
    "cache_expiration",
    "market_tradable_restriction",
    "market_marketable_restriction",
    "descriptions", //Might want to use something from this
    "tags", //We do want some things from here but we'll specifically ask for what we want
    "app_data", //Same with this^
    "fraudwarnings"
];
const IHD_item_attribute_map = { //TODO convience feature
    "market_hash_name":"name",
};
const IHD_item_qualities = [ //TODO convience feature
    ""
];

waitForKeyElements(".inventory_history_pagingrow", IHD_addDownloadButton);

function IHD_addDownloadButton (jNode) {
    var IHD_download_button = document.createElement("button");
    IHD_download_button.id = "IHD_download_button";
    IHD_download_button.innerText = "Download as json";
    var IHD_cursor_input = document.createElement("input");
    IHD_cursor_input.type = "text";
    IHD_cursor_input.id = "IHD_cursor_input";
    IHD_cursor_input.placeholder = "Optional starting cursor here";
    IHD_cursor_input.size = 30;
    var IHD_stop_button = document.createElement("button");
    IHD_stop_button.id = "IHD_stop_button";
    IHD_stop_button.innerText = "Stop download";
    IHD_stop_button.disabled = true;
    jNode[0].appendChild(IHD_download_button);
    jNode[0].appendChild(IHD_cursor_input);
    jNode[0].appendChild(IHD_stop_button);

    IHD_stop_button.addEventListener("click", () => {
        IHD_stop_button.disabled = true;
        IHD_enableButton();
        //TODO save progress
        if(g_historyCursor) {
            var IHD_progress = g_historyCursor.time + " " + g_historyCursor.time_frac + " " + g_historyCursor.s;
            console.log("Download stopped at cursor: " + IHD_progress);
            IHD_cursor_input.value = IHD_progress;
        } else {
            IHD_progress = prevCursor.time + " " + prevCursor.time_frac + " " + prevCursor.s;
            console.log("Download stopped at cursor: " + IHD_progress);
            IHD_cursor_input.value = IHD_progress;
        }
    });
    IHD_download_button.addEventListener("click", () => {
        IHD_download_button.disabled = true;
        IHD_stop_button.disabled = false;
        IHD_checkForCursorInput();
        //IHD_gatherVisibleItems();

        IHD_loop = setInterval(()=>{
            if(IHD_ready_to_load) {
                IHD_ready_to_load = false;
                IHD_gatherVisibleItems();
                IHD_loadMoreItems();
            }
        }, 5000);
    });
}

//This function reenables the download button and stops our progress, either because the user stopped it or we had an error
function IHD_enableButton() {
    clearInterval(IHD_loop);
    IHD_download_button.disabled = false;
    IHD_ready_to_load = true;
    IHD_download(JSON.stringify(IHD_json_object), 'inventory_history.json', 'application/json');
}

function IHD_checkForCursorInput() {
    if(document.getElementById("IHD_cursor_input").value) {
        var IHD_text = document.getElementById("IHD_cursor_input").value.split(" ");
        console.log("IHD - Found starting cursor input of " + IHD_text);
        g_historyCursor.time = IHD_text[0];
        g_historyCursor.time_frac = IHD_text[1];
        g_historyCursor.s = IHD_text[2];
        document.getElementById("IHD_cursor_input").value = "";
        $(".tradehistoryrow").each(IHD_clearTradeRow);
    }
}

function IHD_clearTradeRow() {
    this.remove();
}

function IHD_gatherVisibleItems() {
    $(".tradehistoryrow").each(IHD_tradeHistoryRowToJson);
    console.log(IHD_json_object); //TODO REMOVE
}

//g_historyCursor & g_sessionID is defined on the page this is meant to run on
//This function basically uses the same code as steam's load more button but with modified instructions
function IHD_loadMoreItems() {
    var request_data = {
        ajax: 1,
        cursor: g_historyCursor,
        sessionid: g_sessionID
    };

	prevCursor = g_historyCursor;
	g_historyCursor = null;

    $J.ajax({
        type: "GET",
        url: g_strProfileURL + "/inventoryhistory/",
        data: request_data
    }).done( function( data ) {
        if ( data.success )
        {
            console.log("IHD - Data was retrieved successfully.");
            //console.log(data);
            if( data.html && data.descriptions) {
                $J('#inventory_history_table').append( data.html );
                g_rgDescriptions = data.descriptions;
                //IHD_gatherVisibleItems();
            } else {
                console.warn("IHD - Data did not return an html object or descriptions object.");
                IHD_enableButton();
            }

            if ( data.cursor )
			{
				g_historyCursor = data.cursor;
                IHD_ready_to_load = true;
			}
			else
			{
				console.warn("IHD - Data did not return a cursor.");
                IHD_enableButton();
			}
        } else {
            console.warn("IHD - Data finished but did not succeed, dumping data object and restoring g_historyCursor.");
            console.warn(data);
            g_historyCursor = prevCursor;
            IHD_enableButton();
        }
    }).fail( function( data ) {
		g_historyCursor = prevCursor;

		if ( data.status == 429 )
		{
			console.warn("IHD - Error 429 - Too many requests");
            IHD_enableButton();
		}
		else
		{
			console.warn("IHD - Data failed, unknown error status: " + data.status);
            console.warn("IHD - Dumping data object.");
            console.warn(data);
            IHD_enableButton();
		}
	}).always( function() {
		//$J('#inventory_history_loading').hide();
	});
}
/*
This function grabs all the essential data from a row and makes a json object from it.
After the data is retrieved we delete the row to keep the page from becoming too large.
Data we want is:
  Date
  Event
  Items lost/gained
    Quality
    Item id
    *Wear
    *Secondary Quality

?Itemdef instead of names to save space might be worth doing?
*/
function IHD_tradeHistoryRowToJson() {
    var IHD_inventory_event = {};
    //Time
    var IHD_time = this.getElementsByClassName("tradehistory_date")[0].textContent.trim();
    IHD_time = IHD_time.replace(/\s\s+/g, ' ');
    IHD_inventory_event["time"] = IHD_time;
    //Event
    var IHD_eventName = this.getElementsByClassName("tradehistory_event_description")[0].textContent.trim(); //TODO: Condense these names to save space (map to ids?)
    IHD_inventory_event["event"] = IHD_eventName;
    //Items
    var IHD_items_temp1 = this.getElementsByClassName("tradehistory_items_plusminus")[0];
    var IHD_items_temp2 = this.getElementsByClassName("tradehistory_items_plusminus")[1];
    var IHD_items_gained = {};
    var IHD_items_lost = {};
    if(IHD_items_temp1) {
        if(IHD_items_temp1.textContent == "+") {
            IHD_items_gained = JSON.parse(JSON.stringify(IHD_itemsToJson(IHD_items_temp1.nextElementSibling))); //These JSON.parse calls probably aren't needed and was just some debugging for a different problem
            IHD_inventory_event["items_gained"] = IHD_items_gained;
        } else if (IHD_items_temp1.textContent == "-") {
            IHD_items_lost = JSON.parse(JSON.stringify(IHD_itemsToJson(IHD_items_temp1.nextElementSibling))); //Possibly remove all of them later
            IHD_inventory_event["items_lost"] = IHD_items_lost;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp1.textContent);
        }
    }
    if(IHD_items_temp2) {
        if(IHD_items_temp2.textContent == "+") {
            IHD_items_gained = JSON.parse(JSON.stringify(IHD_itemsToJson(IHD_items_temp2.nextElementSibling)));
            IHD_inventory_event["items_gained"] = IHD_items_gained;
        } else if (IHD_items_temp2.textContent == "-") {
            IHD_items_lost = JSON.parse(JSON.stringify(IHD_itemsToJson(IHD_items_temp2.nextElementSibling)));
            IHD_inventory_event["items_lost"] = IHD_items_lost;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp2.textContent);
        }
    }
    this.remove(); //TODO UNCOMMENT ME
    IHD_json_object[IHD_counter] = IHD_inventory_event;
    IHD_counter++;
}

//g_rgDescriptions is defined on the page this is meant to run on
function IHD_itemsToJson(itemDiv) {
    var IHD_items_json = {};
    var i = 0;
    Array.prototype.forEach.call(itemDiv.getElementsByClassName("history_item"), function(el) {
        var IHD_item_json = {};
        var IHD_item_classid = el.getAttribute("data-classid")
        var IHD_item_instanceid = el.getAttribute("data-instanceid")
        var IHD_item_combinedID = IHD_item_classid + "_" + IHD_item_instanceid;
        var IHD_item_data = g_rgDescriptions[el.getAttribute("data-appid")][IHD_item_combinedID];
        if(IHD_item_data) {
            for (const [key, value] of Object.entries(IHD_item_data)) {
                //IHD_item_json = {};
                if(!IHD_item_attribute_blacklist.includes(key) && value) {
                    IHD_item_json[key] = value;
                }
                if(key == "tags") {
                    value.forEach(IHD_obj => {
                        for (const [key2, value2] of Object.entries(IHD_obj)) {
                            if(key2.toLowerCase() == "category") {
                                if(value2.toLowerCase() == "quality") {
                                    IHD_item_json["Quality"] = IHD_obj.name;
                                } else if(value2.toLowerCase() == "exterior") {
                                    IHD_item_json["Wear"] = IHD_obj.name;
                                }
                            }
                        }
                    });
                }
                if(key == "app_data") {
                    IHD_item_json["index"] = value.def_index;
                }
            }
            IHD_items_json[i] = JSON.parse(JSON.stringify(IHD_item_json));
            i++;
        } else {
            console.log("IHD - NO DATA FOUND FOR " + IHD_item_combinedID);
        }
    });
    //console.log(IHD_items_json);
    return IHD_items_json;
}

//Thanks stackoverflow
function IHD_download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}