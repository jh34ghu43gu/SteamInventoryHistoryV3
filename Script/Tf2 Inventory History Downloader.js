// ==UserScript==
// @name         Tf2 Inventory History Downloader
// @namespace    http://tampermonkey.net/
// @version      0.4.3
// @description  Download your tf2 inventory history from https://steamcommunity.com/my/inventoryhistory/?app[]=440&l=english
// @author       jh34ghu43gu
// @match        https://steamcommunity.com/*/inventoryhistory*
// @icon         https://wiki.teamfortress.com/wiki/Mann_Co._Supply_Crate_Key#/media/File:Backpack_Mann_Co._Supply_Crate_Key.png
// @require      http://code.jquery.com/jquery-latest.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM_getValue
// ==/UserScript==


//NOTE: Need a breadbox opening from someone else to make sure gifted unboxes from that are recorded right, when the data display part is done
console.log("Tf2 Inventory History Downloader Script is active.");
var IHD_json_object = {};
var IHD_dictionary = {};
var IHD_loop;
var IHD_obj_counter = 0;
var IHD_dict_counter = 0;
var IHD_skipped_asset_counter = 0;
var IHD_ready_to_load = true;
var IHD_prev_cursor;
var IHD_retry_counter = 0;
var IHD_max_retries = 100; //Retry on errors (not 429) this many times.

//Valve decided to make some item uses a multiple-event thing so these vars will help us track that between event calls
var IHD_used_temp_obj = {};
var IHD_last_event_used = 0; //0 means no event, 1 is the last even was used, 2 is last event was a gift AFTER a used event.

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
    "market_hash_name", //We will convert these to dictionary values
    "fraudwarnings"
];
//!!!IMPORTANT
//If either of these modification arrays change later only add to the bottom.
//This has modifications that use player names
//Key <name> Value
const IHD_inventory_modifications_list_special = {
    "0": {
        "You traded with": ", but the trade was placed on hold. The items will be delivered later on",// _.",
    },
    "1": {
        "Your trade with": "was on hold, and the trade has now completed.",
    },
    "2": {
        "Your trade with": "failed. The items have been returned to you.",
    },
    "3": {
        "You traded with": "",
    },
    "4": {
        "Gift sent to": "",
    },
    "5": {
        "Your held trade with": "was canceled. The items have been returned to you.",
    }
}

const IHD_special_event_modifier = 100; //Offset that we will add to the location of the special lists when creating ids
//Special name for the specials when converting back from IDs
const IHD_inventory_modifications_list_special_names = [
    "Trade placed on hold",
    "Trade hold completed",
    "Trade hold failed",
    "Traded",
    "Gift sent",
    "Trade hold canceled, items returned"
]

//Regular modifications
//Original length is 61, if it goes past 100 backwards compatability will be lost
const IHD_inventory_modifications_list = [
    "You purchased an item on the Community Market.",
    "Received from the Steam Community Market",
    "You listed an item on the Community Market.",
    "Listed on the Steam Community Market",
    "You canceled a listing on the Community Market. The item was returned to you.",
    "Traded",
    "Played MvM Mann Up Mode",
    "MvM Squad Surplus bonus",
    "Unlocked a crate",
    "Purchased from the store",
    "Traded up", //10
    "Gift wrapped",
    "Received a gift from",
    "You deleted",
    "Used as input to recipe",
    "Recipe completed",
    "Strangified an item",
    "Earned a promotional item",
    "Started testing an item from the store",
    "Preview period ended",
    "Received a gift", //20
    "Used",
    "Completed a Contract",
    "Halloween transmute performed",
    "Earned from unlocking an achievement",
    "Earned from unlocking an achievement in a different game",
    "Antique Halloween Goodie Cauldron",
    "Earned by participating in the Halloween event",
    "Level upgraded by defeating Merasmus",
    "Took the Strange scores from one item and added them on to another",
    "Borrowed for a Contract", //30
    "Generated by Competitive Beta Pass",
    "Texture customized",
    "Received by entering product code",
    "Periodic score system reward",
    "Periodic score system reward was removed",
    "Strange score reset",
    "Found",
    "Removed gifter's name",
    "Removed Killstreak effects",
    "Removed a Strange Part", //40
    "Unwrapped",
    "Crafted",
    "Earned",
    "Removed a Strange Part",
    "Applied a Strange Part",
    "Added a Spell Page",
    "Custom name removed",
    "Removed or modified",
    "Added",
    "Expired", //50
    "Transmogrified",
    "Item Painted",
    "Removed crafter's name",
    "Refunded",
    "Unpacked",
    "Purchased with Blood Money",
    "Unusual effects adjusted",
    "Applied a Strange Filter",
    "Card Upgrade Removed",
    "Card Upgraded", //60
    "Name changed"
]

//Crate objects that get "used" instead of unlocked
const IHD_crate_items_used = [
    "Unlocked Cosmetic Crate Multi-Class",
    "Unlocked Cosmetic Crate Scout",
    "Unlocked Cosmetic Crate Soldier",
    "Unlocked Cosmetic Crate Pyro",
    "Unlocked Cosmetic Crate Demo",
    "Unlocked Cosmetic Crate Heavy",
    "Unlocked Cosmetic Crate Engineer",
    "Unlocked Cosmetic Crate Medic",
    "Unlocked Cosmetic Crate Sniper",
    "Unlocked Cosmetic Crate Spy",
    "Unlocked Creepy Scout Crate",
    "Unlocked Creepy Soldier Crate",
    "Unlocked Creepy Pyro Crate",
    "Unlocked Creepy Demo Crate",
    "Unlocked Creepy Heavy Crate",
    "Unlocked Creepy Engineer Crate",
    "Unlocked Creepy Medic Crate",
    "Unlocked Creepy Sniper Crate",
    "Unlocked Creepy Spy Crate"
]
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
    //Filter buttons
    var IHD_filter_trades = document.createElement("input");
    IHD_filter_trades.type = "checkbox";
    IHD_filter_trades.id = "IHD_filter_trades";
    IHD_filter_trades.checked = true;
    var IHD_filter_trades_label = document.createElement("label");
    IHD_filter_trades_label.for = "IHD_filter_trades";
    IHD_filter_trades_label.innerText = "Ignore trades and SCM events";
    var IHD_filter_mvm = document.createElement("input");
    IHD_filter_mvm.type = "checkbox";
    IHD_filter_mvm.id = "IHD_filter_mvm";
    var IHD_filter_mvm_label = document.createElement("label");
    IHD_filter_mvm_label.for = "IHD_filter_mvm";
    IHD_filter_mvm_label.innerText = "Only MvM events";
    var IHD_filter_unbox = document.createElement("input");
    IHD_filter_unbox.type = "checkbox";
    IHD_filter_unbox.id = "IHD_filter_unbox";
    var IHD_filter_unbox_label = document.createElement("label");
    IHD_filter_unbox_label.for = "IHD_filter_unbox";
    IHD_filter_unbox_label.innerText = "Only Unbox events";
    //Add everything
    jNode[0].appendChild(document.createElement("br"));
    jNode[0].appendChild(IHD_download_button);
    jNode[0].appendChild(IHD_cursor_input);
    jNode[0].appendChild(IHD_stop_button);
    jNode[0].appendChild(document.createElement("br")); //Filters below this
    jNode[0].appendChild(IHD_filter_trades);
    jNode[0].appendChild(IHD_filter_trades_label);
    jNode[0].appendChild(IHD_filter_mvm);
    jNode[0].appendChild(IHD_filter_mvm_label);
    jNode[0].appendChild(IHD_filter_unbox);
    jNode[0].appendChild(IHD_filter_unbox_label);

    IHD_stop_button.addEventListener("click", () => {
        IHD_stop_button.disabled = true;
        IHD_enableButton();
    });
    IHD_download_button.addEventListener("click", () => {
        IHD_download_button.disabled = true;
        IHD_stop_button.disabled = false;
        //Don't let filters get changed after we start the download, these are NOT re-enabled until the page is refreshed
        IHD_filter_unbox.disabled = true;
        IHD_filter_trades.disabled = true;
        IHD_filter_mvm.disabled = true;
        IHD_checkForCursorInput();

        IHD_loop = setInterval(()=>{
            if(IHD_ready_to_load) {
                IHD_ready_to_load = false;
                IHD_gatherVisibleItems();
                if(!Array.isArray(g_historyCursor)) { //If you are on the last page and try to download it will loop back to the start because history cursor is an empty array.
                    IHD_loadMoreItems();
                } else {
                    IHD_enableButton();
                }
            }
        }, 5000);
    });
}

//This function reenables the download button and stops our progress, either because the user stopped it or we had an error
//Output where we stopped at, restore the download button, disable the stop button, and prompt for download.
function IHD_enableButton() {
    clearInterval(IHD_loop);
    if(g_historyCursor && !Array.isArray(g_historyCursor)) {
        var IHD_progress = g_historyCursor.time + " " + g_historyCursor.time_frac + " " + g_historyCursor.s;
        console.log("Download stopped at cursor: " + IHD_progress);
        IHD_cursor_input.value = IHD_progress;
    } else if(IHD_prev_cursor) {
        IHD_progress = IHD_prev_cursor.time + " " + IHD_prev_cursor.time_frac + " " + IHD_prev_cursor.s;
        console.log("Download stopped at cursor: " + IHD_progress);
        IHD_cursor_input.value = IHD_progress;
    } else {
        console.log("Download was *probably* started on the last page of history and does not have a cursor to save");
    }
    IHD_download_button.disabled = false;
    IHD_ready_to_load = true;
    IHD_json_object.dictionary = invertDictionary();
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
}

//Translate events into ids, events that have dynamic player names recieve an id of 100 something
function IHD_eventToEventId(event) {
    if(IHD_inventory_modifications_list.includes(event)) {
        return IHD_inventory_modifications_list.indexOf(event);
    } else {
        for(var i = 0; i < Object.keys(IHD_inventory_modifications_list_special).length; i++) {
            if(event.includes(Object.keys(IHD_inventory_modifications_list_special[i])[0]) && event.includes(Object.values(IHD_inventory_modifications_list_special[i])[0])) {
               return i + IHD_special_event_modifier;
            }
        }
    }
    return event;
}

function IHD_eventIdToEvent(eventId) {
    if(eventId >= IHD_special_event_modifier) {
        eventId - IHD_special_event_modifier;
        return Object.keys(IHD_inventory_modifications_list_special_names)[eventId];
    } else {
        return Object.keys(IHD_inventory_modifications_list)[eventId];
    }
}

//g_historyCursor & g_sessionID is defined on the page this is meant to run on
//This function basically uses the same code as steam's load more button but with modified instructions
function IHD_loadMoreItems() {
    var request_data = {
        ajax: 1,
        cursor: g_historyCursor,
        sessionid: g_sessionID,
        app: [440]
    };

    IHD_prev_cursor = g_historyCursor;
    g_historyCursor = null;

    $J.ajax({
        type: "GET",
        url: g_strProfileURL + "/inventoryhistory/",
        data: request_data
    }).done( function( data ) {
        if ( data.success )
        {
            //console.log("IHD - Data was retrieved successfully."); //This was possibly causing a lot of lag after a long time
            IHD_retry_counter = 0;
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
                console.warn("IHD - Data did not return a cursor. Probably at end of history.");
                IHD_gatherVisibleItems();
                IHD_enableButton();
            }
        } else {
            if(!(data.error && data.error == "There was a problem loading your inventory history.")) {
                console.warn("IHD - Data finished but did not succeed, dumping data object and restoring g_historyCursor.");
                console.warn(data);
            }
            g_historyCursor = IHD_prev_cursor;
            if(IHD_retry_counter > IHD_max_retries) {
                IHD_enableButton();
                IHD_retry_counter = 0;
            } else {
                IHD_retry_counter++;
                IHD_ready_to_load = true;
            }
        }
    }).fail( function( data ) {
        g_historyCursor = IHD_prev_cursor;

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

//Function that sees if our filters want us to record an event
//This uses the eventID create function so if that has a serious change this also needs updated.
function IHD_shouldRecordEvent(eventId) {
    if(document.getElementById("IHD_filter_trades").checked) {
       if(eventId >= IHD_special_event_modifier || eventId < 6 || eventId == 9) { //Dynamic trade messages, scm and traded messages, 9 is in game store purchase
           return false;
       }
    }
    if(document.getElementById("IHD_filter_mvm").checked) {
        if(eventId == 6 || eventId == 7) {
            return true;
        } else if(!document.getElementById("IHD_filter_unbox").checked) {
            return false;
        }
    }
    if(document.getElementById("IHD_filter_unbox").checked) {
        //Unboxed, trade up, recieved a gift, used. The last two are for unlocked crates, only want recieved a gift if the last event was a used event.
        if(eventId == 8 || eventId == 10) {
            return true;
        } else {
            return IHD_usedEventIsUnbox(eventId, false);
        }
    }

    return true;
}

//Deals with the used event -> unbox event logic
//Returns false if not an unbox event and true if it is an unbox event or potentially could become one
function IHD_usedEventIsUnbox(eventId, save) {
    if((IHD_last_event_used > 0 && eventId == 20)) {
        //We got a gift and we are currently tracking an unbox conversion so return true
        //console.log("TRUE Event is a gift and we are an unbox event " + eventId);
        return true;
    } else if (IHD_last_event_used == 2 && eventId == 21) {
        //We were in a valid conversion and need to stop because we potentially have a new one starting so save and return true
        //console.log("TRUE Event is a used and we just left an unbox event " + eventId);
        if(save) { IHD_saveLastEventUsed(1); }
        return true;
    } else if (eventId == 21) {
        //Potentially an unbox conversion, return true
        //console.log("TRUE Event is a used and we are possibly an unbox event " + eventId);
        return true;
    } else if(IHD_last_event_used > 0) {
        //We were in a (potential) conversion but there isn't a new one coming up so we can save the event as is and reset the tracking var and return false
        //console.log("FALSE Event is irrelevant and we were an unbox event " + eventId);
        if(save) { IHD_saveLastEventUsed(0); }
        return false;
    } else {
        //Passed an irrelevant event id
        //console.log("FALSE Event is irrelevant " + eventId);
        return false;
    }
}

//Save the used_temp_obj, takes the arg lastEvent which IHD_last_event_used will be set to (0 for none, 1 for used, 2 for recieved gift + used before that).
function IHD_saveLastEventUsed(lastEvent) {
    if(IHD_used_temp_obj.event == 21 //Change used event to unbox event if the item we used is in the crate array IHD_crate_items_used
       && IHD_used_temp_obj.items_lost
       && IHD_crate_items_used.includes(IHD_used_temp_obj.items_lost[0].market_hash_name)) {
        IHD_used_temp_obj.event = 8;
    }
    IHD_json_object[IHD_obj_counter] = IHD_used_temp_obj;
    IHD_obj_counter++;
    IHD_last_event_used = lastEvent;
    IHD_used_temp_obj = {};
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

*/
function IHD_tradeHistoryRowToJson() {
    var IHD_inventory_event = {};

    //Event
    var IHD_eventName = this.getElementsByClassName("tradehistory_event_description")[0].textContent.trim();
    var IHD_eventId = IHD_eventToEventId(IHD_eventName);
    if(!IHD_shouldRecordEvent(IHD_eventId)) {
        this.remove();
        return;
    }
    IHD_inventory_event.event = IHD_eventToEventId(IHD_eventName);
    //Time
    var IHD_time = this.getElementsByClassName("tradehistory_date")[0].textContent.trim();
    IHD_time = IHD_time.replace(/\s\s+/g, ' ');
    IHD_inventory_event.time = IHD_time;
    //Items
    var IHD_items_temp1 = this.getElementsByClassName("tradehistory_items_plusminus")[0];
    var IHD_items_temp2 = this.getElementsByClassName("tradehistory_items_plusminus")[1];
    var IHD_items_gained = {};
    var IHD_items_lost = {};
    var IHD_items_hold = {};
    if(IHD_items_temp1) {
        if(IHD_items_temp1.textContent == "+") {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp1.nextElementSibling);
            IHD_inventory_event.items_gained = IHD_items_gained;
        } else if (IHD_items_temp1.textContent == "-") {
            IHD_items_lost = IHD_itemsToJson(IHD_items_temp1.nextElementSibling);
            IHD_inventory_event.items_lost = IHD_items_lost;
        } else if (IHD_eventId == 100) {
            IHD_items_hold = IHD_itemsToJson(IHD_items_temp1.nextElementSibling);
            IHD_inventory_event.items_on_hold = IHD_items_hold;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp1.textContent + " for date: " + IHD_time);
        }
    }
    if(IHD_items_temp2) {
        if(IHD_items_temp2.textContent == "+") {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp2.nextElementSibling);
            IHD_inventory_event.items_gained = IHD_items_gained;
        } else if (IHD_items_temp2.textContent == "-") {
            IHD_items_lost = IHD_itemsToJson(IHD_items_temp2.nextElementSibling);
            IHD_inventory_event.items_lost = IHD_items_lost;
        } else if (IHD_eventId == 100) {
            IHD_items_hold = IHD_itemsToJson(IHD_items_temp1.nextElementSibling);
            IHD_inventory_event.items_on_hold = IHD_items_hold;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp2.textContent);
        }
    }
    this.remove();
    //Used event
    if(IHD_usedEventIsUnbox(IHD_eventId, true)) {
       if(IHD_eventId == 21) {
           IHD_used_temp_obj = IHD_inventory_event;
           IHD_last_event_used = 1;
       } else if(IHD_eventId == 20) {
           if(IHD_last_event_used == 2) {
               var i = Object.keys(IHD_used_temp_obj.items_gained).length;
               for(var key in IHD_inventory_event.items_gained) { //For loop might be overkill since we only get 1 object gained
                   IHD_used_temp_obj.items_gained[i] = IHD_inventory_event.items_gained[key];
                   i++;
               }
           } else {
               IHD_used_temp_obj.items_gained = IHD_inventory_event.items_gained;
               IHD_last_event_used = 2;
           }
       }
    } else { //Normal event
        IHD_json_object[IHD_obj_counter] = IHD_inventory_event;
        IHD_obj_counter++;
    }
}

//g_rgDescriptions is defined on the page this is meant to run on
function IHD_itemsToJson(itemDiv) {
    var IHD_items_json = {};
    var i = 0;
    Array.from(itemDiv.getElementsByClassName("history_item")).forEach((el) => {
        var IHD_item_json = {};
        var IHD_item_classid = el.getAttribute("data-classid")
        var IHD_item_instanceid = el.getAttribute("data-instanceid")
        var IHD_item_combinedID = IHD_item_classid + "_" + IHD_item_instanceid;
        //This check should stop unknown asset crashes however,
        // it might be better to let the crash happen and have the
        // user retry it since we otherwise skip the event the asset was in.
        if(!g_rgDescriptions[el.getAttribute("data-appid")][IHD_item_combinedID]) {
            console.warn("Unknown asset skipped during cursor: " + g_historyCursor + " or prev cursor: " + IHD_prev_cursor);
            console.warn("Unknown asset combinedID: " + IHD_item_combinedID);
            IHD_skipped_asset_counter++;
            return;
        }
        var IHD_item_data = g_rgDescriptions[el.getAttribute("data-appid")][IHD_item_combinedID];
        if(IHD_item_data) {
            for (const [key, value] of Object.entries(IHD_item_data)) {
                if(!IHD_item_attribute_blacklist.includes(key) && value) {
                    IHD_item_json[key] = value;
                }
                if(key == "tags") {
                    value.forEach(IHD_obj => {
                        for (const [key2, value2] of Object.entries(IHD_obj)) {
                            if(key2.toLowerCase() == "category") {
                                if(value2.toLowerCase() == "quality") {
                                    IHD_item_json.Quality = IHD_obj.name;
                                } else if(value2.toLowerCase() == "exterior") {
                                    IHD_item_json.Wear = IHD_obj.name;
                                }
                            }
                        }
                    });
                }
                if(key == "app_data") {
                    IHD_item_json.index = value.def_index;
                }
                if(key == "market_hash_name") {
                   if(IHD_dictionary[value]) {
                       IHD_item_json.name = IHD_dictionary[value];
                   } else {
                       IHD_dictionary[value] = IHD_dict_counter;
                       IHD_item_json.name = IHD_dict_counter;
                       IHD_dict_counter++;
                   }
                }
            }
            IHD_items_json[i] = JSON.parse(JSON.stringify(IHD_item_json));
            i++;
        } else {
            console.log("IHD - NO DATA FOUND FOR " + IHD_item_combinedID);
        }
    });
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
    console.log("Total skipped assets: " + IHD_skipped_asset_counter);
}
//Return our dicetionary with the numbers as keys instead of the names as keys
function invertDictionary() {
    var invertedDictionary = {};
    for (const [key, value] of Object.entries(IHD_dictionary)) {
        invertedDictionary[value] = key;
    }

    return invertedDictionary;
}

//Ignore these blanks, adding things at the very bottom makes my browser's editor freak out



























