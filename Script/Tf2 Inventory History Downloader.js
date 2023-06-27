﻿// ==UserScript==
// @name         Tf2 Inventory History Downloader
// @namespace    http://tampermonkey.net/
// @version      0.6.8
// @description  Download your tf2 inventory history from https://steamcommunity.com/my/inventoryhistory/?app[]=440&l=english
// @author       jh34ghu43gu
// @match        https://steamcommunity.com/*/inventoryhistory*
// @icon         https://wiki.teamfortress.com/wiki/Mann_Co._Supply_Crate_Key#/media/File:Backpack_Mann_Co._Supply_Crate_Key.png
// @require      http://code.jquery.com/jquery-latest.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM_getValue
// ==/UserScript==

//TODO store start and end cursors in the file
//TODO add tour numbers to when an aussie was dropped

//NOTE: Need a breadbox opening from someone else to make sure gifted unboxes from that are recorded right, when the data display part is done
console.log("Tf2 Inventory History Downloader Script is active.");
var IHD_json_object = {};
var IHD_file_list;
var IHD_dictionary = {};
var IHD_inverted_dictionary = {};
var IHD_loop;
var IHD_obj_counter = 0;
var IHD_dict_counter = 1; //Logic errors when reading if we start at 0 (inverse dictionary can't write a 0 key?)
var IHD_skipped_asset_counter = 0;
var IHD_ready_to_load = true;
var IHD_prev_cursor;
var IHD_retry_counter = 0;
var IHD_max_retries = 100; //Retry on errors (not 429) this many times.
//Attribute names
var IHD_items_gained_attr = "Gained";
var IHD_items_lost_attr = "Lost";
var IHD_items_hold_attr = "items_on_hold";
var IHD_items_type_attr = "Type";

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
    "descriptions", //Unusual effects, some tags, and spells in here
    "tags", //We do want some things from here but we'll specifically ask for what we want
    "app_data", //Same with this^
    "market_hash_name", //We will convert these to dictionary values
    "fraudwarnings",
    "tradable", //Record only if it's 0
    "marketable", //Record only if it's 0
    "type" //We'll split level data from this
];
//!!!IMPORTANT
//If either of these modification arrays change later only add to the bottom.
//This has modifications that use player names
//Key <name> Value
const IHD_inventory_modifications_list_special = {
    "0": {
        "You traded with": ", but the trade was placed on hold. The items will be delivered later on"// _.",
    },
    "1": {
        "Your trade with": "was on hold, and the trade has now completed."
    },
    "2": {
        "Your trade with": "failed. The items have been returned to you."
    },
    "3": {
        "You traded with": ""
    },
    "4": {
        "Gift sent to": ""
    },
    "5": {
        "Your held trade with": "was canceled. The items have been returned to you."
    },
    "6": {
        "Received a gift from": ""
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
    "Trade hold canceled, items returned",
    "Received a gift from someone"
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
    "IHD_FILLER", //This event got moved to a trade related (106) id but I am too lazy to fix all of the hard coded event ids based on the old list TODO?
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
    "Item painted",
    "Removed crafter's name",
    "Refunded",
    "Unpacked",
    "Purchased with Blood Money",
    "Unusual effects adjusted",
    "Applied a Strange Filter",
    "Card Upgrade Removed",
    "Card Upgraded", //60
    "Name changed"
];

//These are events that create items and thus would have original item ids
const IHD_creation_events = [
    "Played MvM Mann Up Mode",
    "MvM Squad Surplus bonus",
    "Unlocked a crate",
    "Purchased from the store",
    "Traded up",
    "Gift wrapped", //The actual gift item is a new item, but contains an old item
    "Recipe completed",
    "Earned a promotional item",
    "Started testing an item from the store",
    "Received a gift",
    "Completed a Contract",
    "Halloween transmute performed",
    "Earned from unlocking an achievement",
    "Earned from unlocking an achievement in a different game",
    "Earned by participating in the Halloween event",
    "Borrowed for a Contract",
    "Generated by Competitive Beta Pass",
    "Received by entering product code",
    "Found",
    "Crafted",
    "Earned",
    "Added",
    "Transmogrified",
    "Unpacked"
];

//Crate-like objects that get "used" instead of unlocked
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
    "Unlocked Creepy Spy Crate",
    "Gift-Stuffed Stocking"
]
//They started labeling all the stockings in 2017 so create some entries up through current year
for (var i = 2017; i <= new Date().getFullYear(); i++) {
    IHD_crate_items_used.push("Gift-Stuffed Stocking " + i);
}

//Exterior wears for paints/skins mapped to numbers
const IHD_wear_map = {
    "Factory New": 0,
    "Minimal Wear": 1,
    "Field-Tested": 2,
    "Well-Worn": 3,
    "Battle Scarred": 4
};


//Begin script
waitForKeyElements(".inventory_history_pagingrow", IHD_addButtons);

function IHD_addButtons(jNode) {
    var style = document.createElement("style");
    style.type = 'text/css';
    //VIYZEN HELPING CSS :)))))
    style.innerHTML = "div#IHD_stats_div { display: inline-block; color: #ddd; } div#IHD_stats_div .visible { visibility: visible;     opacity: 1;     height: fit-content;     transition: opacity 0.3s linear;     background-color: rgba(0, 0, 0, 0.3);     margin: 7px 10px 7px 10px;     padding: 7px 0px;      }  div#IHD_stats_div .visible > div {     margin: 7px 10px 7px 10px;     padding: 7px 0px; }  div#IHD_stats_div .hidden {     visibility: hidden;     opacity: 0;     height: 0; }  div#IHD_stats_div button{     min-height: 15px;     padding: 2px 4px;     background-color: #68932f;     border: 2px solid #68932f;     border-radius: 2px;     color: #d2ff96;     font-size: 14px;      margin-left: 10px; }";
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
    var IHD_file_input = document.createElement("input");
    IHD_file_input.type = "file";
    IHD_file_input.id = "IHD_file_input";
    IHD_file_input.accept = ".json";
    IHD_file_input.multiple = true;
    var IHD_file_input_label = document.createElement("label");
    IHD_file_input_label.for = "IHD_file_input";
    IHD_file_input_label.innerText = " Load in previous progress: ";
    var IHD_stats_button = document.createElement("button");
    IHD_stats_button.id = "IHD_stats_button";
    IHD_stats_button.innerText = "Generate Statistics Report";
    IHD_stats_button.disabled = true;
    var IHD_stats_progress_label = document.createElement("label"); //TODO
    IHD_stats_progress_label.for = "IHD_stats_button";
    IHD_stats_progress_label.id = "IHD_stats_progress_label";
    IHD_stats_progress_label.innerText = "";

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
    //ID filters
    var IHD_filter_ids = document.createElement("input");
    IHD_filter_ids.type = "checkbox";
    IHD_filter_ids.id = "IHD_filter_ids";
    var IHD_filter_ids_label = document.createElement("label");
    IHD_filter_ids_label.for = "IHD_filter_ids";
    IHD_filter_ids_label.innerText = "Save item ids";
    var IHD_filter_original_ids = document.createElement("input");
    IHD_filter_original_ids.type = "checkbox";
    IHD_filter_original_ids.id = "IHD_filter_original_ids";
    IHD_filter_original_ids.disabled = true;
    var IHD_filter_original_ids_label = document.createElement("label");
    IHD_filter_original_ids_label.for = "IHD_filter_original_ids";
    IHD_filter_original_ids_label.innerText = "Only original ids";
    //Add everything
    jNode[0].appendChild(style);
    jNode[0].appendChild(document.createElement("br"));
    jNode[0].appendChild(IHD_download_button);
    jNode[0].appendChild(IHD_cursor_input);
    jNode[0].appendChild(IHD_stop_button);
    jNode[0].appendChild(IHD_file_input_label);
    jNode[0].appendChild(IHD_file_input);
    jNode[0].appendChild(IHD_stats_button);
    jNode[0].appendChild(IHD_stats_progress_label);
    jNode[0].appendChild(document.createElement("br")); //Filters below this
    jNode[0].appendChild(IHD_filter_trades);
    jNode[0].appendChild(IHD_filter_trades_label);
    jNode[0].appendChild(IHD_filter_mvm);
    jNode[0].appendChild(IHD_filter_mvm_label);
    jNode[0].appendChild(IHD_filter_unbox);
    jNode[0].appendChild(IHD_filter_unbox_label);
    jNode[0].appendChild(document.createElement("br")); //Item id filters below this
    jNode[0].appendChild(IHD_filter_ids);
    jNode[0].appendChild(IHD_filter_ids_label);
    jNode[0].appendChild(IHD_filter_original_ids);
    jNode[0].appendChild(IHD_filter_original_ids_label);

    IHD_filter_ids.addEventListener("click", () => {
        if (IHD_filter_ids.checked) {
            IHD_filter_original_ids.disabled = false;
        } else {
            IHD_filter_original_ids.checked = false;
            IHD_filter_original_ids.disabled = true;
        }
    });
    IHD_file_input.addEventListener('change', async (event) => {
        IHD_json_object = {};
        IHD_dictionary = {};
        IHD_inverted_dictionary = {};
        IHD_file_list = event.target.files;
        IHD_read_file_objects(await IHD_read_files());
        IHD_stats_button.disabled = false;
    });
    IHD_stop_button.addEventListener("click", () => {
        IHD_stop_button.disabled = true;
        IHD_enableButton();
    });
    IHD_stats_button.addEventListener("click", () => {
        IHD_stats_button.disabled = true;
        IHD_file_input.disabled = true;
        IHD_download_button.disabled = true;
        //filters
        IHD_filter_unbox.hidden = true;
        IHD_filter_trades.hidden = true;
        IHD_filter_mvm.hidden = true;
        IHD_filter_ids.hidden = true;
        IHD_filter_original_ids.hidden = true;
        IHD_filter_unbox_label.hidden = true;
        IHD_filter_trades_label.hidden = true;
        IHD_filter_mvm_label.hidden = true;
        IHD_filter_ids_label.hidden = true;
        IHD_filter_original_ids_label.hidden = true;

        IHD_stats_report();
    });
    IHD_download_button.addEventListener("click", () => {
        IHD_download_button.disabled = true;
        IHD_stop_button.disabled = false;
        //Don't let filters or the file upload get changed after we start the download, these are NOT re-enabled until the page is refreshed
        IHD_file_input.disabled = true;
        IHD_filter_unbox.disabled = true;
        IHD_filter_trades.disabled = true;
        IHD_filter_mvm.disabled = true;
        IHD_filter_ids.disabled = true;
        IHD_filter_original_ids.disabled = true;
        IHD_checkForCursorInput();

        IHD_loop = setInterval(() => {
            if (IHD_ready_to_load) {
                IHD_ready_to_load = false;
                IHD_gatherVisibleItems();
                if (!Array.isArray(g_historyCursor)) { //If you are on the last page and try to download it will loop back to the start because history cursor is an empty array.
                    IHD_loadMoreItems();
                } else {
                    IHD_enableButton();
                }
            }
        }, 5000);
    });
}

//File reading section
function IHD_read_File(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            resolve(reader.result);
        }
        reader.onerror = () => reject(reader.error);
    });
}

async function IHD_read_files() {
    var jsonObjects = [];
    for (var file of IHD_file_list) {
        var fileContent = await IHD_read_File(file);
        var jsonObject = JSON.parse(fileContent);
        jsonObjects.push(jsonObject);
    }
    return jsonObjects;
}

function IHD_read_file_objects(objects) {
    for (var i = 0; i < Array.from(objects).length; i++) {
        var IHD_file_json_obj = Array.from(objects)[i];
        //First file is very simple; just copying everything and making sure to incriment our values accordingly
        if (Object.keys(IHD_dict_counter).length === 0 && Object.keys(IHD_obj_counter).length === 0) {
            IHD_json_object = IHD_file_json_obj;
            IHD_obj_counter = Object.keys(IHD_json_object).length;
            IHD_dictionary = invertDictionary(IHD_file_json_obj.dictionary);
            IHD_dict_counter = Object.keys(IHD_file_json_obj.dictionary).length + 1;
            delete IHD_json_object["dictionary"];
        } else { //2nd+ files need to change our dictionary item values and also our obj counter incriments
            var IHD_file_dictionary = IHD_file_json_obj.dictionary;
            for (var m = 0; m < Object.keys(IHD_file_json_obj).length; m++) {
                if (!(Object.keys(IHD_file_json_obj)[m] === "dictionary")) {
                    IHD_event = IHD_file_json_obj[m];
                    IHD_new_event = {};
                    for (var k = 0; k < Object.keys(IHD_event).length; k++) {
                        var key = Object.keys(IHD_event)[k];
                        if (key === IHD_items_gained_attr) {
                            IHD_new_event[IHD_items_gained_attr] = IHD_file_items_handler(IHD_event[IHD_items_gained_attr], IHD_file_dictionary);
                        } else if (key === IHD_items_lost_attr) {
                            IHD_new_event[IHD_items_lost_attr] = IHD_file_items_handler(IHD_event[IHD_items_lost_attr], IHD_file_dictionary);
                        } else if (key === IHD_items_hold_attr) {
                            IHD_new_event[IHD_items_hold_attr] = IHD_file_items_handler(IHD_event[IHD_items_hold_attr], IHD_file_dictionary);
                        } else {
                            IHD_new_event[key] = IHD_event[key];
                        }
                    }
                    IHD_json_object[IHD_obj_counter] = IHD_new_event;
                    IHD_obj_counter++;
                }
            }
        }
    }
    IHD_inverted_dictionary = invertDictionary(IHD_dictionary);
}
//Take events item groups (gain/lost/hold) from the 2nd+ files and re-assign proper dictionary values to their items
function IHD_file_items_handler(items, dictionary) {
    var IHD_temp_items = {};
    for (var i = 0; i < Object.keys(items).length; i++) {
        var IHD_temp_item = items[i];
        //Name
        if (IHD_dictionary[dictionary[items[i]["name"]]] >= 0) {
            IHD_temp_item["name"] = IHD_dictionary[dictionary[items[i]["name"]]];
        } else {
            IHD_dictionary[dictionary[items[i]["name"]]] = IHD_dict_counter;
            IHD_temp_item["name"] = IHD_dict_counter;
            IHD_dict_counter++;
        }
        //Type
        if (IHD_dictionary[dictionary[items[i][IHD_items_type_attr]]] >= 0) {
            IHD_temp_item[IHD_items_type_attr] = IHD_dictionary[dictionary[items[i][IHD_items_type_attr]]];
        } else {
            IHD_dictionary[dictionary[items[i][IHD_items_type_attr]]] = IHD_dict_counter;
            IHD_temp_item[IHD_items_type_attr] = IHD_dict_counter;
            IHD_dict_counter++;
        }
        IHD_temp_items[i] = IHD_temp_item;
    }
    return IHD_temp_items;
}
//Leaving file reading section

//Statistics generation section
/* Events of importance
    "Played MvM Mann Up Mode"       6
    "MvM Squad Surplus bonus"       7
    "Unlocked a crate"              8
    "Purchased from the store"      9
    "Traded up"                     10
    "You deleted"                   13
    "Used"                          21
    "Found"                         37
    "Crafted"                       42
    "Earned"                        43
    "Added a Spell Page"            46
    "Purchased with Blood Money"    56
 */
var IHD_events_type_sorted = {};

function hideAllChildDivs(myDiv) {
    // Get all child div elements of myDiv
    const childDivs = myDiv.querySelectorAll(".hidden,.visible");

    // Loop through each child div element
    for (let i = 0; i < childDivs.length; i++) {
        // Set the class of the child div element to "hidden"
        childDivs[i].className = "hidden";

        // Recursively hide all child div elements of the child div element
        hideAllChildDivs(childDivs[i]);
    }
}

function IHD_stats_report() {
    var IHD_stats_div = document.createElement("div");
    IHD_stats_div.id = "IHD_stats_div";
    $(".tradehistoryrow").each(IHD_clearTradeRow);
    if (document.getElementsByClassName("load_more_history_area").length > 0) {
        document.getElementsByClassName("load_more_history_area")[0].hidden = true;
    }
    document.getElementById("inventory_history_table").appendChild(IHD_stats_div);
    IHD_inverted_dictionary = invertDictionary(IHD_dictionary);
    //Go through IHD_json_object and sort events by type into their own objects
    //var IHD_obj_size = Object.entries(IHD_json_object).length;
    //var IHD_stats_counter = 0;
    //var IHD_stats_progress_label = $("#IHD_stats_progress_label");
    for (const [key, value] of Object.entries(IHD_json_object)) {
        //if (((IHD_stats_counter / IHD_obj_size) * 100) % 2 === 0) {
        //    IHD_stats_progress_label.innerText = "Progress: " + ((IHD_stats_counter / IHD_obj_size) * 100) + "%";
        //}
        if ("event" in value) {
            if (!(value["event"] in IHD_events_type_sorted)) {
                IHD_events_type_sorted[value["event"]] = {};
            }
            IHD_events_type_sorted[value["event"]][key] = value;
        }
        //IHD_stats_counter++;
    }
    IHD_mvm_stats_report();
    IHD_unbox_stats_report();
    IHD_tradeup_report();
    IHD_mannco_purchases_report();

    IHD_deleted_report();
    IHD_found_report();
    IHD_used_report();
    IHD_crafted_report();
    IHD_earned_report();
    IHD_blood_money_report();



    var IHD_collapsibles = document.getElementsByClassName("collapsible");
    for (var i = 0; i < IHD_collapsibles.length; i++) {
        IHD_collapsibles[i].addEventListener("click", function () {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            if (content.className.match(/(?:^|\s)visible(?!\S)/)) {
                content.className = "hidden";
                hideAllChildDivs(content);
            } else {
                content.className = "visible";
            }
        });
    }
}

//Incriment our item counters in obj[child] or obj[child][child2]etc
function IHD_stats_add_item_to_obj(obj, name, child, child2, child3, child4) {
    if (child4) {
        if (name in obj[child][child2][child3][child4]) {
            obj[child][child2][child3][child4][name]++;
        } else {
            obj[child][child2][child3][child4][name] = 1;
        }
    } else if (child3) {
        if (name in obj[child][child2][child3]) {
            obj[child][child2][child3][name]++;
        } else {
            obj[child][child2][child3][name] = 1;
        }
    } else if (child2) {
        if (name in obj[child][child2]) {
            obj[child][child2][name]++;
        } else {
            obj[child][child2][name] = 1;
        }
    } else if (child) {
        if (name in obj[child]) {
            obj[child][name]++;
        } else {
            obj[child][name] = 1;
        }
    } else {
        if (name in obj[child]) {
            obj[name]++;
        } else {
            obj[nmae] = 1;
        }
    }
}

//Mvm mission and surplus rewards
const IHD_mvm_parts_list = [
    "Pristine Robot Brainstorm Bulb",
    "Pristine Robot Currency Digester",
    "Reinforced Robot Bomb Stabilizer",
    "Reinforced Robot Humor Suppression Pump",
    "Reinforced Robot Emotion Detector",
    "Battle-Worn Robot Money Furnace",
    "Battle-Worn Robot Taunt Processor",
    "Battle-Worn Robot KB-808"
];
const IHD_mvm_badge_list = [
    "Operation Oil Spill Badge",
    "Operation Steel Trap Badge",
    "Operation Mecha Engine Badge",
    "Operation Two Cities Badge",
    "Operation Gear Grinder Badge"
];
const IHD_mvm_robo_hat_list = [
    "Robot Running Man",
    "Tin Pot",
    "Pyrobotics Pack",
    "Battery Bandolier",
    "U-clank-a",
    "Tin-1000",
    "Medic Mech-Bag",
    "Bolted Bushman",
    "Stealth Steeler",
    "RoBro 3000"
];
function IHD_mvm_stats_report() {
    var IHD_mvm_obj = {
        "kits": {},
        "spec": {},
        "prof": {},
        "parts": {},
        "aussies": {},
        "botkillers": {
            "os": {
                "blood": {},
                "rust": {}
            },
            "st": {
                "gold": {},
                "silver": {}
            },
            "me": {
                "gold": {},
                "silver": {}
            },
            "gg": {
                "carbonado": {},
                "diamond": {}
            }
        },
        "weapons": {},
        "tools": {
            "paint": {}
        },
        "hats": {
            "robo": {},
            "hat": {}
        },
        "badges": {}
    };
    var IHD_surplus_obj = {
        "weapons": {},
        "tools": {
            "paint": {}
        },
        "hats": {
            "robo": {},
            "hat": {}
        }
    };
    //Missions and tours
    if ("6" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["6"])) {
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    //Tally all the items into IHD_mvm_obj
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        if (name.includes("Golden Frying Pan") || name.includes("Australium")) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "aussies");
                        } else if (name.includes("Professional")) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "prof");
                        } else if (name.includes("Specialized")) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "spec");
                        } else if (name.includes("Killstreak")) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "kits");
                        } else if (IHD_mvm_parts_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "parts");
                        } else if (IHD_mvm_badge_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "badges");
                        } else if (name.includes("Botkiller")) {
                            if (name.includes("Carbonado")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "gg", "carbonado");
                            } else if (name.includes("Diamond")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "gg", "diamond");
                            } else if (name.includes("Rust")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "os", "rust");
                            } else if (name.includes("Blood")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "os", "blood");
                            } else if (name.includes("Silver") && name.includes("Mk.II")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "me", "silver");
                            } else if (name.includes("Gold") && name.includes("Mk.II")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "me", "gold");
                            } else if (name.includes("Silver")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "st", "silver");
                            } else if (name.includes("Gold")) {
                                IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "botkillers", "st", "gold");
                            }
                        } else if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "weapons");
                        } else if (IHD_tool_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "tools");
                        } else if (IHD_paint_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "tools", "paint");
                        } else if (IHD_mvm_robo_hat_list.includes(name) || IHD_mvm_robo_hat_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "hats", "robo");
                        } else if (IHD_hat_list.includes(name) || IHD_hat_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name, "hats", "hat");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_mvm_obj, name);
                        }
                    }
                }
            }
        }
    }
    //Surplus
    if ("7" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["7"])) {
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    //Tally all the items into IHD_surplus_obj
                    if ("name" in value2) {
                        name = IHD_inverted_dictionary[value2["name"]];
                        if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name, "weapons");
                        } else if (IHD_tool_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name, "tools");
                        } else if (IHD_paint_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name, "tools", "paint");
                        } else if (IHD_mvm_robo_hat_list.includes(name) || IHD_mvm_robo_hat_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name, "hats", "robo");
                        } else if (IHD_hat_list.includes(name) || IHD_hat_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name, "hats", "hat");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_surplus_obj, name);
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>MvM Loot</h2></div>" + IHD_stats_obj_to_html(IHD_mvm_obj)[0] + "<br>";
    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"surplus\"><h2>Surplus Loot</h2></div>" + IHD_stats_obj_to_html(IHD_surplus_obj)[0] + "<br>";
}

//Unboxes report
function IHD_unbox_stats_report() {
    var IHD_unbox_obj = {
        "All Unusuals": {},
        "cases": {
            "Total Uniques": 0,
            "Total Decorated Skins": 0,
            "Total Stranges": 0,
            "Total Unusuals": {},
            "Total Bonus Items": {
                "Paint": {},
                "Strange Parts": {},
                "Tools": {},
                "Unusualifiers": {}
                //Tickets, stat transfer tools
            },
            "cosmetic": {
                "Uniques": 0,
                "Stranges": 0,
                "Unusuals": {},
                "Bonus Items": {
                    "Paint": {},
                    "Strange Parts": {},
                    "Tools": {},
                    "Unusualifiers": {}
                    //Tickets, stat transfer tools
                }
            },
            "war paints": {
                "Decorated Skins": 0,
                "Uniques": 0,
                "Stranges": 0,
                "Unusuals": {},
                "Bonus Items": {
                    "Paint": {},
                    "Strange Parts": {},
                    "Tools": {},
                    "Unusualifiers": {}
                    //Tickets, stat transfer tools
                }
            },
            "weapon skins": { //Different from war paints
                "Decorated Skins": 0,
                "Uniques": 0,
                "Stranges": 0,
                "Unusuals": {},
                "Bonus Items": {
                    "Paint": {},
                    "Strange Parts": {},
                    "Tools": {},
                    "Unusualifiers": {}
                    //Tickets, stat transfer tools
                }
            }
        },
        "crates": {
            "Total Unusuals": {}
        },
        "Errors": {}
    };
    var i = 0;
    if ("8" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["8"])) {
            if (IHD_items_lost_attr in value) {
                var crate_type = IHD_get_crate_name(value[IHD_items_lost_attr], true);
                if (crate_type.length > 1) {
                    //Set crate name in appropriate object
                    if (crate_type.length > 2) { //case
                        if (!(crate_type[2] in IHD_unbox_obj["cases"][crate_type[1]])) {
                            IHD_unbox_obj["cases"][crate_type[1]][crate_type[2]] = {};
                        }
                    } else { //crate
                        if (!(crate_type[1] in IHD_unbox_obj["crates"])) {
                            IHD_unbox_obj["crates"][crate_type[1]] = {};
                        }
                    }
                    //Add items; incriment counters
                    if (IHD_items_gained_attr in value) {
                        for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                            if ("name" in value2) {
                                var name = IHD_inverted_dictionary[value2["name"]];
                                if ("Effect" in value2) {
                                    name = "★ " + value2["Effect"] + " ★ " + name;
                                }
                                var bonus = true;
                                //Add the names
                                if (crate_type.length > 2) {
                                    //Bonus items
                                    if (IHD_paint_list.includes(name)) { //Paint
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Bonus Items", "Paint");
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Bonus Items", "Paint");
                                    } else if (IHD_tool_list.includes(name)) { //Tools
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Bonus Items", "Tools");
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Bonus Items", "Tools");
                                    } else if (name.includes("Strange Part: ")) { //Strange parts
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Bonus Items", "Strange Parts");
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Bonus Items", "Strange Parts");
                                    } else if (name.includes("Unusualifier")) { //Unusualifiers
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Bonus Items", "Unusualifiers");
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Bonus Items", "Unusualifiers");
                                    } else if (name === "Tour of Duty Ticket" || name === "Strange Count Transfer Tool") { //ToD and stat transfer
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Bonus Items");
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Bonus Items");
                                    } else { //Not a bonus item
                                        IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], [crate_type[2]]);
                                        bonus = false;
                                    }
                                } else {
                                    IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "crates", crate_type[1]);
                                }
                                //Increment qualities
                                if ("Quality" in value2) {
                                    var quality = value2["Quality"];
                                    if (crate_type.length > 2) {
                                        if (quality === "6" && !bonus) {
                                            IHD_unbox_obj["cases"]["Total Uniques"]++;
                                            IHD_unbox_obj["cases"][crate_type[1]]["Uniques"]++;
                                        } else if (quality === "15") {
                                            IHD_unbox_obj["cases"]["Total Decorated Skins"]++;
                                            IHD_unbox_obj["cases"][crate_type[1]]["Decorated Skins"]++;
                                        } else if (quality === "11") {
                                            IHD_unbox_obj["cases"]["Total Stranges"]++;
                                            IHD_unbox_obj["cases"][crate_type[1]]["Stranges"]++;
                                        } else if (quality === "5" && !name.includes("Unusualifier")) { //Unusualifiers ARE NOT unusuals
                                            IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", "Total Unusuals");
                                            IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "cases", crate_type[1], "Unusuals");
                                            IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "All Unusuals");
                                        }
                                    } else {
                                        if (quality === "5" && !name.includes("Unusualifier")) { //Unusualifiers ARE NOT unusuals
                                            IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "crates", "Total Unusuals");
                                            IHD_stats_add_item_to_obj(IHD_unbox_obj, name, "All Unusuals");
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (IHD_items_gained_attr in value) {
                        IHD_unbox_obj["Errors"][i] = {};
                        IHD_unbox_obj["Errors"][i][IHD_items_lost_attr] = value[IHD_items_lost_attr];
                        IHD_unbox_obj["Errors"][i][IHD_items_gained_attr] = value[IHD_items_gained_attr];
                        i++;
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Unboxes</h2></div>" + IHD_stats_obj_to_html(IHD_unbox_obj)[0] + "<br>";

}

//TODO Show which item slots got selected for the output items
//Trade-up items report
function IHD_tradeup_report() {
    var IHD_tradeup_obj = {
        "Stat Clocks": {
            "Used Items": {
                "Strange": {},
                "Unique": {},
                "Unique Paints": {}
            },
            "Created Items": {}
        },
        "Item Grade Trade-Ups": {
            "Used Items": {
                "Strange": {},
                "Unique": {},
                "Unique Paints": {}
            },
            "Created Items": {
                "Strange": {},
                "Unique": {},
                "Unique Paints": {}
            }
        }
    }
    if ("10" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["10"])) {
            var type = "Item Grade Trade-Ups";
            if (IHD_items_lost_attr in value) {
                if (Object.keys(value[IHD_items_lost_attr]).length === 5) {
                    type = "Stat Clocks";
                } else if (Object.keys(value[IHD_items_lost_attr]).length < 10) {
                    console.log("Trade up only had " + Object.keys(value[IHD_items_lost_attr]).length + " items instead of expected 10.");
                    console.log(value["time"]);
                }

                for (const [key2, value2] of Object.entries(value[IHD_items_lost_attr])) {
                    if ("Quality" in value2) {
                        var quality = value2["Quality"];
                        if (quality === "6") {
                            quality = "Unique";
                        } else if (quality === "11") {
                            quality = "Strange";
                        } else if (quality === "15") {
                            quality = "Unique Paints";
                        } else {
                            console.log("Somehow quality for tradeup was not unique or strange and was instead: " + quality);
                            if (!("Errors" in IHD_tradeup_obj[type]["Used Items"])) {
                                IHD_tradeup_obj[type]["Used Items"]["Errors"] = {};
                            }
                            quality = "Errors";
                        }
                        if ("name" in value2) {
                            var name = IHD_inverted_dictionary[value2["name"]];
                            IHD_stats_add_item_to_obj(IHD_tradeup_obj, name, type, "Used Items", quality);
                        }
                    } else {
                        if ("name" in value2) {
                            name = IHD_inverted_dictionary[value2["name"]];
                            IHD_stats_add_item_to_obj(IHD_tradeup_obj, name, type, "Used Items");
                        }
                    }
                }
            }
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("Quality" in value2) {
                        quality = value2["Quality"];
                        if (quality === "6") {
                            quality = "Unique";
                        } else if (quality === "11") {
                            quality = "Strange";
                        } else if (quality === "15") {
                            quality = "Unique Paints";
                        } else {
                            console.log("Somehow quality for tradeup was not unique or strange and was instead: " + quality);
                            if (!("Errors" in IHD_tradeup_obj[type]["Created Items"])) {
                                IHD_tradeup_obj[type]["Created Items"]["Errors"] = {};
                            }
                            quality = "Errors";
                        }
                        if ("name" in value2) {
                            name = IHD_inverted_dictionary[value2["name"]];
                            if (type === "Stat Clocks") {
                                IHD_stats_add_item_to_obj(IHD_tradeup_obj, name, type, "Created Items");
                            } else {
                                IHD_stats_add_item_to_obj(IHD_tradeup_obj, name, type, "Created Items", quality);
                            }
                        }
                    } else {
                        if ("name" in value2) {
                            name = IHD_inverted_dictionary[value2["name"]];
                            IHD_stats_add_item_to_obj(IHD_tradeup_obj, name, type, "Created Items");
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Trade-Ups</h2></div>" + IHD_stats_obj_to_html(IHD_tradeup_obj)[0] + "<br>";

}

//Store purchases report
function IHD_mannco_purchases_report() {
    var IHD_purchases_obj = {
        "Taunts": {},
        "Keys": {},
        "Unlocked Crates": {},
        "Paints": {},
        "ToDs": {},
        "Packages": {},
        "Other": {}
    }
    if ("9" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["9"])) {
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        if (name.startsWith("Taunt")) {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Taunts");
                        } else if (name.startsWith("Unlocked")) {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Unlocked Crates");
                        } else if (name.endsWith("Key")) {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Keys");
                        } else if (name === "Squad Surplus Voucher" || name === "Tour of Duty Ticket") {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "ToDs");
                        } else if (name === "Mann Co. Store Package") {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Packages");
                        } else if (IHD_paint_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Paints");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_purchases_obj, name, "Other");
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Store Purchases</h2></div>" + IHD_stats_obj_to_html(IHD_purchases_obj)[0] + "<br>";

}

//Deleted items report
function IHD_deleted_report() {
    var IHD_deleted_obj = {
        "Weapons": {},
        "Other Deleted Items": {}
    }
    if ("13" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["13"])) {
            if (IHD_items_lost_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_lost_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_deleted_obj, name, "Weapons");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_deleted_obj, name, "Other Deleted Items");
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Deleted Items</h2></div>" + IHD_stats_obj_to_html(IHD_deleted_obj)[0] + "<br>";

}

//Used items report
//Includes spellbook pages used (event 46)
function IHD_used_report() {
    var IHD_used_obj = {
        "Used Items": {
            "Spellbook Pages Used": 0
        }
    }
    if ("21" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["21"])) {
            if (IHD_items_lost_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_lost_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        IHD_stats_add_item_to_obj(IHD_used_obj, name, "Used Items");
                    }
                }
            }
            if (IHD_items_gained_attr in value) {
                console.log(value[IHD_items_gained_attr]);
            }
        }
    }
    if ("46" in IHD_events_type_sorted) { //Track spellbook pages in here too
        for (const [key, value] of Object.entries(IHD_events_type_sorted["46"])) {
            if (IHD_items_lost_attr in value) {
                IHD_used_obj["Used Items"]["Spellbook Pages Used"]++;
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Used Items</h2></div>" + IHD_stats_obj_to_html(IHD_used_obj)[0] + "<br>";

}

//Found items report
function IHD_found_report() {
    var IHD_found_obj = {
        "Weapons": {},
        "Cases": {},
        "Crates": {},
        "Paints": {},
        "Tools": {},
        "Taunts": {},
        "Chemistry Sets": {},
        "Other": {}
    }
    if ("37" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["37"])) {
            if (IHD_items_gained_attr in value) {
                var crate_type = IHD_get_crate_name(value[IHD_items_gained_attr], false);
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        if (name.startsWith("Taunt")) {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Taunts");
                        } else if (crate_type[0] === "case") {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Cases");
                        } else if (crate_type[0] === "crate") {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Crates");
                        } else if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Weapons");
                        } else if (IHD_paint_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Paints");
                        } else if (IHD_tool_list.includes(name)) {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Tools");
                        } else if (name.includes("Chemistry Set")) {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Chemistry Sets");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_found_obj, name, "Other");
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Found Items</h2></div>" + IHD_stats_obj_to_html(IHD_found_obj)[0] + "<br>";

}

//Crafted items report
function IHD_crafted_report() {
    var IHD_crafted_obj = {
        "Used Items": {
            "Tokens": {},
            "Metal": {},
            "Weapons": {}
        },
        "Created Items": {
            "Tokens": {},
            "Metal": {},
            "Weapons": {}
        }
    }
    if ("42" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["42"])) {
            if (IHD_items_lost_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_lost_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        if (name.includes("Token")) {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Used Items", "Tokens");
                        } else if (name === "Refined Metal" || name === "Reclaimed Metal" || name === "Scrap Metal") {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Used Items", "Metal");
                        } else if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Used Items", "Weapons");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Used Items");
                        }
                    }
                }
            }
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("name" in value2) {
                        name = IHD_inverted_dictionary[value2["name"]];
                        if (name.includes("Token")) {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Created Items", "Tokens");
                        } else if (name === "Refined Metal" || name === "Reclaimed Metal" || name === "Scrap Metal") {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Created Items", "Metal");
                        } else if (IHD_weapon_list.includes(name) || IHD_weapon_list.includes(name.replace("The ", ""))) {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Created Items", "Weapons");
                        } else {
                            IHD_stats_add_item_to_obj(IHD_crafted_obj, name, "Created Items");
                        }
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Crafted Items</h2></div>" + IHD_stats_obj_to_html(IHD_crafted_obj)[0] + "<br>";

}

//Earned items report
function IHD_earned_report() {
    var IHD_earned_obj = {
        "Earned": {}
    }
    if ("43" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["43"])) {
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        IHD_stats_add_item_to_obj(IHD_earned_obj, name, "Earned");
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Earned Items</h2></div>" + IHD_stats_obj_to_html(IHD_earned_obj)[0] + "<br>";

}

//Blood money report
function IHD_blood_money_report() {
    var IHD_blood_obj = {
        "Blood Money Purchases": {}
    }
    if ("56" in IHD_events_type_sorted) {
        for (const [key, value] of Object.entries(IHD_events_type_sorted["56"])) {
            if (IHD_items_gained_attr in value) {
                for (const [key2, value2] of Object.entries(value[IHD_items_gained_attr])) {
                    if ("name" in value2) {
                        var name = IHD_inverted_dictionary[value2["name"]];
                        IHD_stats_add_item_to_obj(IHD_blood_obj, name, "Blood Money Purchases");
                    }
                }
            }
        }
    }

    document.getElementById("IHD_stats_div").innerHTML += "<br><div class=\"mvm\"><h2>Blood Money Purchases</h2></div>" + IHD_stats_obj_to_html(IHD_blood_obj)[0] + "<br>";

}

//Return an array with name data for a case/crate unbox
//Example data for case ["case", case_type, name]
//Example data for crate ["crate", name]
function IHD_get_crate_name(lost_items, bLog) {
    for (const [key, value] of Object.entries(lost_items)) {
        if ("name" in value) {
            var name = IHD_inverted_dictionary[value["name"]];
            if (name.includes("Weapons Case")) {
                return ["case", "weapon skins", name.substr(0, name.indexOf("Weapons Case")).trim()];
            } else if (name.includes("War Paint Case")) {
                return ["case", "war paints", name.substr(0, name.indexOf("War Paint Case")).trim()];
            } else if ((name.includes("War Paint") && name.includes("Keyless Case"))) {
                return ["case", "war paints", name.substr(0, name.indexOf("Keyless Case")).trim()];
            } else if (name.includes("Cosmetic Case")) {
                return ["case", "cosmetic", name.substr(0, name.indexOf("Cosmetic Case")).trim()];
            } else if (name.includes("Case") && !name.includes("Key")) { //Praying they don't put "Key" in the name of a future cosmetic case
                return ["case", "cosmetic", name.substr(0, name.indexOf("Case")).trim()];
            } else if (!name.includes("Key") && (name.includes("Supply Munition") || name.includes("Crate")
                || name.includes("Strongbox") || name.includes("Cooler") || name.includes("Reel"))) {
                return ["crate", name];
            }
        }
    }
    if (bLog) {
        console.log("Couldn't determine crate/case type for " + lost_items);
    }
    return ["Invalid"];
}

//IHD_stats_obj_to_html() will ignore keys here when doing totals (to prevent duplicates)
var IHD_ignore_key_totals = {
    "Stranges": 1,
    "Uniques": 1,
    "Unusuals": 1,
    "Decorated Skins": 1,
    "Bonus Items": 1,
    "Total Stranges": 1,
    "Total Uniques": 1,
    "Total Unusuals": 1,
    "Total Decorated Skins": 1,
    "Total Bonus Items": 1,
    "Used Items": 1 //Trade ups and crafting
}
function IHD_stats_obj_to_html(obj) {
    var html = "";
    var total = 0;
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "number") {
            html += "<div>" + key + ": " + value + "</div>";
            if (!(key in IHD_ignore_key_totals)) {
                total += value;
            }
        } else if (typeof value === "object") {
            const [childHtml, childTotal] = IHD_stats_obj_to_html(value);
            html += "<br><button class=\"collapsible\">" + key + "(" + childTotal + ")" + "</button>";
            html += "<div class=\"hidden\">" + childHtml + "</div>";
            if (!(key in IHD_ignore_key_totals)) {
                total += childTotal;
            }
        } else {
            console.warn("Unexpected data type when converting stats to html: " + typeof value);
        }
    }
    return [html, total];
}

//Leaving statistics generation section


//This function reenables the download button and stops our progress, either because the user stopped it or we had an error
//Output where we stopped at, restore the download button, disable the stop button, and prompt for download.
function IHD_enableButton() {
    clearInterval(IHD_loop);
    if (g_historyCursor && !Array.isArray(g_historyCursor)) {
        var IHD_progress = g_historyCursor.time + " " + g_historyCursor.time_frac + " " + g_historyCursor.s;
        console.log("Download stopped at cursor: " + IHD_progress);
        IHD_cursor_input.value = IHD_progress;
    } else if (IHD_prev_cursor) {
        IHD_progress = IHD_prev_cursor.time + " " + IHD_prev_cursor.time_frac + " " + IHD_prev_cursor.s;
        console.log("Download stopped at cursor: " + IHD_progress);
        IHD_cursor_input.value = IHD_progress;
    } else {
        console.log("Download was *probably* started on the last page of history and does not have a cursor to save");
    }
    IHD_download_button.disabled = false;
    IHD_stats_button.disabled = false;
    IHD_ready_to_load = true;
    IHD_json_object.dictionary = IHD_inverted_dictionary;
    IHD_download(JSON.stringify(IHD_json_object), 'inventory_history.json', 'application/json');
}

function IHD_checkForCursorInput() {
    if (document.getElementById("IHD_cursor_input").value) {
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
    if (IHD_inventory_modifications_list.includes(event)) {
        return IHD_inventory_modifications_list.indexOf(event);
    } else {
        for (var i = 0; i < Object.keys(IHD_inventory_modifications_list_special).length; i++) {
            if (event.includes(Object.keys(IHD_inventory_modifications_list_special[i])[0]) && event.includes(Object.values(IHD_inventory_modifications_list_special[i])[0])) {
                return i + IHD_special_event_modifier;
            }
        }
    }
    return event;
}

function IHD_eventIdToEvent(eventId) {
    if (eventId >= IHD_special_event_modifier) {
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
    }).done(function (data) {
        if (data.success) {
            IHD_retry_counter = 0;
            if (data.html && data.descriptions) {
                $J('#inventory_history_table').append(data.html);
                g_rgDescriptions = data.descriptions;
                //IHD_gatherVisibleItems();
            } else {
                console.warn("IHD - Data did not return an html object or descriptions object.");
                IHD_enableButton();
            }

            if (data.cursor) {
                g_historyCursor = data.cursor;
                IHD_ready_to_load = true;
            }
            else {
                console.warn("IHD - Data did not return a cursor. Probably at end of history.");
                IHD_gatherVisibleItems();
                IHD_enableButton();
            }
        } else {
            if (!(data.error && data.error === "There was a problem loading your inventory history.")) {
                console.warn("IHD - Data finished but did not succeed, dumping data object and restoring g_historyCursor.");
                console.warn(data);
            }
            g_historyCursor = IHD_prev_cursor;
            if (IHD_retry_counter > IHD_max_retries) {
                IHD_enableButton();
                IHD_retry_counter = 0;
            } else {
                IHD_retry_counter++;
                IHD_ready_to_load = true;
            }
        }
    }).fail(function (data) {
        g_historyCursor = IHD_prev_cursor;

        if (data.status === 429) {
            console.warn("IHD - Error 429 - Too many requests");
            IHD_enableButton();
        }
        else {
            console.warn("IHD - Data failed, unknown error status: " + data.status);
            console.warn("IHD - Dumping data object.");
            console.warn(data);
            IHD_enableButton();
        }
    }).always(function () {
        //$J('#inventory_history_loading').hide();
    });
}

//Function that sees if our filters want us to record an event
//This uses the eventID create function so if that has a serious change this also needs updated.
function IHD_shouldRecordEvent(eventId) {
    if (document.getElementById("IHD_filter_trades").checked) {
        if (eventId >= IHD_special_event_modifier || eventId < 6 || eventId === 9) { //Dynamic trade messages, scm and traded messages, 9 is in game store purchase
            return false;
        }
    }
    if (document.getElementById("IHD_filter_mvm").checked) {
        if (eventId === 6 || eventId === 7) {
            return true;
        } else if (!document.getElementById("IHD_filter_unbox").checked) {
            return false;
        }
    }
    if (document.getElementById("IHD_filter_unbox").checked) {
        //Unboxed, trade up, recieved a gift, used. The last two are for unlocked crates, only want recieved a gift if the last event was a used event.
        if (eventId === 8 || eventId === 10) {
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
    if ((IHD_last_event_used > 0 && eventId === 20)) {
        //We got a gift and we are currently tracking an unbox conversion so return true
        return true;
    } else if (IHD_last_event_used === 2 && eventId === 21) {
        //We were in a valid conversion and need to stop because we potentially have a new one starting so save and return true
        if (save) { IHD_saveLastEventUsed(1); }
        return true;
    } else if (eventId === 21) {
        //Potentially an unbox conversion, return true
        return true;
    } else if (IHD_last_event_used > 0) {
        //We were in a (potential) conversion but there isn't a new one coming up so we can save the event as is and reset the tracking var and return false
        if (save) { IHD_saveLastEventUsed(0); }
        return false;
    } else {
        //Passed an irrelevant event id
        return false;
    }
}

//Save the used_temp_obj, takes the arg lastEvent which IHD_last_event_used will be set to (0 for none, 1 for used, 2 for recieved gift + used before that).
function IHD_saveLastEventUsed(lastEvent) {
    if (IHD_used_temp_obj.event === 21 //Change used event to unbox event if the item we used is in the crate array IHD_crate_items_used
        && Object.keys(IHD_used_temp_obj[IHD_items_lost_attr]).length > 0
        && IHD_crate_items_used.includes(IHD_inverted_dictionary[IHD_used_temp_obj[IHD_items_lost_attr][0].name])) {
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
    if (!IHD_shouldRecordEvent(IHD_eventId)) {
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
    if (IHD_items_temp1) {
        if (IHD_items_temp1.textContent === "+") {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_gained_attr] = IHD_items_gained;
        } else if (IHD_items_temp1.textContent === "-") {
            IHD_items_lost = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_lost_attr] = IHD_items_lost;
        } else if (IHD_eventId === 100) {
            IHD_items_hold = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_hold_attr] = IHD_items_hold;
        } else if (IHD_eventId === 30) {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_gained_attr] = IHD_items_gained;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp1.textContent + " for date: " + IHD_time);
        }
    }
    if (IHD_items_temp2) {
        if (IHD_items_temp2.textContent === "+") {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp2.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_gained_attr] = IHD_items_gained;
        } else if (IHD_items_temp2.textContent === "-") {
            IHD_items_lost = IHD_itemsToJson(IHD_items_temp2.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_lost_attr] = IHD_items_lost;
        } else if (IHD_eventId === 100) {
            IHD_items_hold = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_hold_attr] = IHD_items_hold;
        } else if (IHD_eventId === 30) {
            IHD_items_gained = IHD_itemsToJson(IHD_items_temp1.nextElementSibling, IHD_eventName);
            IHD_inventory_event[IHD_items_gained_attr] = IHD_items_gained;
        } else {
            console.log("IHD - Unexpected text; not + or - instead was " + IHD_items_temp2.textContent + " for date: " + IHD_time);
        }
    }
    this.remove();
    //Used event

    if (((Object.keys(IHD_items_lost).length > 0 && IHD_crate_items_used.includes(IHD_inverted_dictionary[IHD_items_lost[0].name]))
        || (IHD_used_temp_obj[IHD_items_lost_attr] && IHD_crate_items_used.includes(IHD_inverted_dictionary[IHD_used_temp_obj[IHD_items_lost_attr][0].name])))
        && IHD_usedEventIsUnbox(IHD_eventId, true)) { //Objects lost are a crate AND valid used event

        if (IHD_eventId === 21) {
            IHD_used_temp_obj = IHD_inventory_event;
            IHD_last_event_used = 1;
        } else if (IHD_eventId === 20) {
            if (IHD_last_event_used === 2) {
                var i = Object.keys(IHD_used_temp_obj[IHD_items_gained_attr]).length;
                for (var key in IHD_inventory_event[IHD_items_gained_attr]) {
                    IHD_used_temp_obj[IHD_items_gained_attr][i] = IHD_inventory_event[IHD_items_gained_attr][key];
                    i++;
                }
            } else {
                IHD_used_temp_obj[IHD_items_gained_attr] = IHD_inventory_event[IHD_items_gained_attr];
                IHD_last_event_used = 2;
            }
        }
    } else { //Normal event
        IHD_json_object[IHD_obj_counter] = IHD_inventory_event;
        IHD_obj_counter++;
    }
}

//g_rgDescriptions is defined on the page this is meant to run on
function IHD_itemsToJson(itemDiv, event) {
    var IHD_items_json = {};
    var i = 0;
    Array.from(itemDiv.getElementsByClassName("history_item")).forEach((el) => {
        var IHD_item_json = {};
        var IHD_item_classid = el.getAttribute("data-classid");
        var IHD_item_instanceid = el.getAttribute("data-instanceid");
        var IHD_item_combinedID = IHD_item_classid + "_" + IHD_item_instanceid;
        if (IHD_filter_ids.checked && el.getAttribute("href")) {
            //Don't care about original ids OR we do care and the event is on the list of events that creates items
            if (!IHD_filter_original_ids.checked || (IHD_filter_original_ids.checked && IHD_creation_events.includes(event))) {
                IHD_item_json.id = el.getAttribute("href").split("#440_2_")[1];
            }
        }
        //This check should stop unknown asset crashes however,
        // it might be better to let the crash happen and have the
        // user retry it since we otherwise skip the event the asset was in.
        if (!g_rgDescriptions[el.getAttribute("data-appid")][IHD_item_combinedID]) {
            console.warn("Unknown asset skipped during cursor: " + g_historyCursor + " or prev cursor: " + IHD_prev_cursor);
            console.warn("Unknown asset combinedID: " + IHD_item_combinedID);
            IHD_skipped_asset_counter++;
            return;
        }
        var IHD_item_data = g_rgDescriptions[el.getAttribute("data-appid")][IHD_item_combinedID];
        if (IHD_item_data) {
            for (const [key, value] of Object.entries(IHD_item_data)) {
                if (!IHD_item_attribute_blacklist.includes(key) && value) {
                    IHD_item_json[key] = value;
                }
                //Assume tradable and marketable by default; only record if it's not
                if ((key === "tradable" || key === "marketable") && value === 0) {
                    IHD_item_json[key] = value;
                }
                if (key === "tags") {
                    value.forEach(IHD_obj => {
                        for (const [key2, value2] of Object.entries(IHD_obj)) {
                            if (key2.toLowerCase() === "category") {
                                if (value2.toLowerCase() === "exterior") {
                                    if (IHD_obj.name in IHD_wear_map) {
                                        IHD_item_json.Wear = IHD_wear_map[IHD_obj.name];
                                    } else {
                                        IHD_item_json.Wear = IHD_obj.name;
                                    }
                                }
                            }
                        }
                    });
                }
                if (key === "descriptions" && Object.keys(value).length > 0) {
                    var IHD_spells = {};
                    var IHD_spell_count = 0;
                    value.forEach(IHD_obj => {
                        if (IHD_obj.value && IHD_obj.value.includes("(spell only active during event)")) {
                            IHD_spells[IHD_spell_count] = IHD_obj.value;
                            IHD_spell_count++;
                        } else if (IHD_obj.value && IHD_obj.value === "Rewarded for participating in the 2014 Summer Adventure") {
                            IHD_item_json.Summer2014 = 1;
                        } else if (IHD_obj.value && IHD_obj.value === "Early Supporter of End of the Line Community Update") {
                            IHD_item_json.EOTL = 1;
                        } else if (IHD_obj.value && IHD_obj.value === "( Loaner - Cannot be traded, marketed, crafted, or modified )") {
                            IHD_item_json.Loaner = 1;
                        }
                    });
                    if (IHD_spell_count > 0) {
                        IHD_item_json.Spells = IHD_spells;
                    }
                }
                if (key === "app_data") {
                    IHD_item_json.Quality = value.quality;
                }
                if (key === "market_hash_name") {
                    if (IHD_dictionary[value]) {
                        IHD_item_json.name = IHD_dictionary[value];
                    } else {
                        IHD_dictionary[value] = IHD_dict_counter;
                        IHD_inverted_dictionary[IHD_dict_counter] = value;
                        IHD_item_json.name = IHD_dict_counter;
                        IHD_dict_counter++;
                    }
                }
                if (key === "type" && value.length > 0) {
                    if (value.includes("Level")) {
                        var splitVal = value.split(" ");
                        for (var o = 0; o < splitVal.length; o++) {
                            if (splitVal[o].trim() === "Level") {
                                IHD_item_json.Level = splitVal[o + 1].trim();
                                break;
                            }
                        }
                        var type = value.slice(value.indexOf(IHD_item_json.Level) + IHD_item_json.Level.length).trim();
                        if (IHD_dictionary[type]) {
                            IHD_item_json[IHD_items_type_attr] = IHD_dictionary[type];
                        } else {
                            IHD_dictionary[type] = IHD_dict_counter;
                            IHD_inverted_dictionary[IHD_dict_counter] = type;
                            IHD_item_json[IHD_items_type_attr] = IHD_dict_counter;
                            IHD_dict_counter++;
                        }
                    } else {
                        if (IHD_dictionary[value]) {
                            IHD_item_json[IHD_items_type_attr] = IHD_dictionary[value];
                        } else {
                            IHD_dictionary[value] = IHD_dict_counter;
                            IHD_inverted_dictionary[IHD_dict_counter] = value;
                            IHD_item_json[IHD_items_type_attr] = IHD_dict_counter;
                            IHD_dict_counter++;
                        }
                    }
                }
            }
            //If it's unusual we want to grab the effect
            if (IHD_item_json.Quality === "5") {
                IHD_item_data.descriptions.every(IHD_obj => {
                    for (const [key2, value2] of Object.entries(IHD_obj)) {
                        if (typeof value2 === "string" && value2.includes("★ Unusual Effect: ")) {
                            IHD_item_json.Effect = value2.split(": ")[1];
                            break;
                        }
                    }
                    if (IHD_item_json.Effect) {
                        return false;
                    }
                    return true;
                });
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
    var file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    console.log("Total skipped assets: " + IHD_skipped_asset_counter);
}
//Return a dictionary with the keys and values reversed
function invertDictionary(dict) {
    var invertedDictionary = {};
    for (const [key, value] of Object.entries(dict)) {
        invertedDictionary[value] = (Number(key)) ? parseInt(key) : key;
    }

    return invertedDictionary;
}


const IHD_weapon_list = [
    "Scattergun",
    "Force-A-Nature",
    "Shortstop",
    "Soda Popper",
    "Baby Face's Blaster",
    "Back Scatter",
    "Pistol",
    "Lugermorph",
    "C.A.P.P.E.R",
    "Winger",
    "Pretty Boy's Pocket Pistol",
    "Flying Guillotine",
    "Bonk! Atomic Punch",
    "Crit-a-Cola",
    "Mad Milk",
    "Bat",
    "Holy Mackerel",
    "Unarmed Combat",
    "Batsaber",
    "Sandman",
    "Candy Cane",
    "Boston Basher",
    "Three-Rune Blase",
    "Fan O'War",
    "Atomizer",
    "Wrap Assassin",
    "Rocket Launcher",
    "Original",
    "Direct Hit",
    "Black Box",
    "Rocket Jumper",
    "Liberty Launcher",
    "Cow Mangler 5000",
    "Beggar's Bazooka",
    "Air Strike",
    "Shotgun",
    "Reserve Shooter",
    "Buff Banner",
    "Gunboats",
    "Battalion's Backup",
    "Concheror",
    "Mantreads",
    "Righteous Bison",
    "B.A.S.E. Jumper",
    "Panic Attack",
    "Shovel",
    "Equalizer",
    "Pain Train",
    "Half-Zatoichi",
    "Disciplinary Action",
    "Market Gardener",
    "Escape Plan",
    "Flame Thrower",
    "Rainblower",
    "Nostromo Napalmer",
    "Backburner",
    "Degreaser",
    "Phlogistinator",
    "Dragon's Fury",
    "Flare Gun",
    "Detonator",
    "Manmelter",
    "Scorch Shot",
    "Thermal Thruster",
    "Gas Passer",
    "Fire Axe",
    "Lollichop",
    "Axtinguisher",
    "Postal Pummeler",
    "Homewrecker",
    "Maul",
    "Powerjack",
    "Back Scratcher",
    "Sharpened Volcano Fragment",
    "Third Degree",
    "Neon Annihilator",
    "Hot Hand",
    "Grenade Launcher",
    "Loch-n-Load",
    "Ali Baba's Wee Booties",
    "Bootlegger",
    "Loose Cannon",
    "Iron Bomber",
    "Stickybomb Launcher",
    "Scottish Resistance",
    "Chargin' Targe",
    "Sticky Jumper",
    "Splendid Screen",
    "Tide Turner",
    "Quickiebomb Launcher",
    "Bottle",
    "Scottish Handshake",
    "Eyelander",
    "Nessie's Nine Iron",
    "Scotsman's Skullcutter",
    "Pain Train",
    "Ullapool Caber",
    "Claidheamh Mòr",
    "Persian Persuader",
    "Minigun",
    "Iron Curtain",
    "Natascha",
    "Brass Beast",
    "Tomislav",
    "Huo-Long Heater",
    "Family Business",
    "Sandvich",
    "Dalokohs Bar",
    "Buffalo Steak Sandvich",
    "Second Banana",
    "Fists",
    "Apoco-Fists",
    "Killing Gloves of Boxing",
    "Gloves of Running Urgently",
    "Bread Bite",
    "Warrior's Spirit",
    "Fists of Steel",
    "Eviction Notice",
    "Holiday Punch",
    "Frontier Justice",
    "Widowmaker",
    "Pomson 6000",
    "Rescue Ranger",
    "Panic Attack",
    "Wrangler",
    "Short Circuit",
    "Wrench",
    "Gunslinger",
    "Southern Hospitality",
    "Jag",
    "Eureka Effect",
    "Syringe Gun",
    "Blutsauger",
    "Crusader's Crossbow",
    "Overdose",
    "Medi Gun",
    "Quick-Fix",
    "Kritzkrieg",
    "Vaccinator",
    "Bonesaw",
    "Ubersaw",
    "Vita-Saw",
    "Amputator",
    "Solemn Vow",
    "Sniper Rifle",
    "AWPer Hand",
    "Huntsman",
    "Fortified Compound",
    "Sydney Sleeper",
    "Bazaar Bargain",
    "Machina",
    "Shooting Star",
    "Hitman's Heatmaker",
    "Classic",
    "Submachine Gun",
    "Cleaner's Carbine",
    "Jarate",
    "Razorback",
    "Darwin's Danger Shield",
    "Cozy Camper",
    "Kukri",
    "Tribalman's Shiv",
    "Bushwacka",
    "Shahanshah",
    "Revolver",
    "Big Kill",
    "Ambassador",
    "L'Etranger",
    "Enforcer",
    "Diamondback",
    "Knife",
    "Sharp Dresser",
    "Black Rose",
    "Your Eternal Reward",
    "Wanga Prick",
    "Conniver's Kunai",
    "Big Earner",
    "Spy-cicle",
    "Cloak and Dagger",
    "Dead Ringer",
    "Red-Tape Recorder",
    "Frying Pan",
    "Conscientious Objector",
    "Freedom Staff",
    "Bat Outta Hell",
    "Ham Shank",
    "Sun-on-a-Stick"
];

const IHD_tool_list = [
    "Name Tag",
    "Description Tag",
    "Decal Tool",
    "Giftapult",
    "Dueling Mini-Game",
    "Enchantment: Eternaween"
];

const IHD_paint_list = [
    "A Color Similar to Slate",
    "A Deep Commitment to Purple",
    "A Distinctive Lack of Hue",
    "A Mann's Mint",
    "After Eight",
    "Aged Moustache Grey",
    "An Extraordinary Abundance of Tinge",
    "Australium Gold",
    "Color No. 216-190-216",
    "Dark Salmon Injustice",
    "Drably Olive",
    "Indubitably Green",
    "Mann Co. Orange",
    "Muskelmannbraun",
    "Noble Hatter's Violet",
    "Peculiarly Drab Tincture",
    "Pink as Hell",
    "Radigan Conagher Brown",
    "The Bitter Taste of Defeat and Lime",
    "The Color of a Gentlemann's Business Pants",
    "Ye Olde Rustic Colour",
    "Zepheniah's Greed",
    "An Air of Debonair",
    "Balaclavas Are Forever",
    "Cream Spirit",
    "Operator's Overalls",
    "Team Spirit",
    "The Value of Teamwork",
    "Waterlogged Lab Coat"
];

const IHD_hat_list = [
    "Human Cannonball",
    "Champ Stamp",
    "Triad Trinket",
    "Marxman",
    "Bonk Helm",
    "Ye Olde Baker Boy",
    "Baseball Bill's Sports Shine",
    "Troublemaker's Tossle Cap",
    "Whoopee Cap",
    "Milkman",
    "Bombing Run",
    "Flipped Trilby",
    "Bonk Boy",
    "El Jefe",
    "Backwards Ballcap",
    "Stereoscopic Shades",
    "Hermes",
    "Big Elfin Deal",
    "Bootie Time",
    "Boston Boom-Bringer",
    "Fast Learner",
    "Front Runner",
    "Fed-Fightin' Fedora",
    "Dillinger's Duffel",
    "Track Terrorizer",
    "Spooky Shoes",
    "Digit Divulger",
    "Bigg Mann on Campus",
    "Cool Cat Cardigan",
    "Greased Lightning",
    "Caffeine Cooler",
    "Half-Pipe Hurdler",
    "Delinquent's Down Vest",
    "Flapjack",
    "Chucklenuts",
    "Little Drummer Mann",
    "Scout Shako",
    "Runner's Warm-Up",
    "Frickin' Sweet Ninja Hood",
    "Southie Shinobi",
    "Red Socks",
    "Paisley Pro",
    "Argyle Ace",
    "Pomade Prince",
    "Bootenkhamuns",
    "Orion's Belt",
    "Stainless Pot",
    "Tyrant's Helm",
    "Killer's Kabuto",
    "Sergeant's Drill Hat",
    "Grenadier's Softcap",
    "Chieftain's Challenge",
    "Stout Shako",
    "Exquisite Rack",
    "Defiant Spartan",
    "Honcho's Headgear",
    "Furious Fukaamigasa",
    "Jumper's Jeepcap",
    "Brain Bucket",
    "Lord Cockswain's Pith Helmet",
    "Lord Cockswain's Novelty Mutton Chops and Pipe",
    "Armored Authority",
    "Fancy Dress Uniform",
    "Infernal Impaler",
    "Kringle Collection",
    "Lucky Shot",
    "Conquistador",
    "Captain's Cocktails",
    "Helmet Without a Home",
    "War Pig",
    "Soldier's Stogie",
    "Soldier's Slope Scopers",
    "Gilded Guard",
    "Cloud Crasher",
    "Valley Forge",
    "Compatriot",
    "Caribbean Conqueror",
    "Colonial Clogs",
    "Whirly Warrior",
    "Rebel Rouser",
    "Shogun's Shoulder Guard",
    "Hornblower",
    "Lieutenant Bites",
    "Brawling Buccaneer",
    "Founding Father",
    "Slo-Poke",
    "Antarctic Parka",
    "Marshall's Mutton Chops",
    "Classified Coif",
    "Spook Specs",
    "Man in Slacks",
    "Respectless Rubber Glove",
    "Brigade Helm",
    "Triboniophorus Tyrannus",
    "Whiskered Gentleman",
    "Vintage Merryweather",
    "Attendant",
    "Old Guadalajara",
    "Napper's Respite",
    "Handyman's Handle",
    "Pyromancer's Mask",
    "Prancer's Pride",
    "Madame Dixie",
    "Hottie's Hoodie",
    "Sight for Sore Eyes",
    "Connoisseur's Cap",
    "Dead Cone",
    "Stately Steel Toe",
    "Last Breath",
    "Apparition's Aspect",
    "Moonman Backpack",
    "Bubble Pipe",
    "Little Buddy",
    "Birdcage",
    "Flamboyant Flamenco",
    "Cremator's Conscience",
    "Head Warmer",
    "Jingle Belt",
    "Infernal Orchestrina",
    "Burning Bongos",
    "Waxy Wayfinder",
    "Pyrotechnic Tote",
    "Wraith Wrap",
    "Coffin Kit",
    "Winter Wonderland Wrap",
    "Mair Mask",
    "El Muchacho",
    "Backpack Broiler",
    "Burning Bandana",
    "Soot Suit",
    "Hive Minder",
    "Pampered Pyro",
    "Bone Dome",
    "Air Raider",
    "Trickster's Turnout Gear",
    "Pop-Eyes",
    "Blizzard Breather",
    "Trail-Blazer",
    "Tiny Timber",
    "Toy Tailor",
    "Sengoku Scorcher",
    "Gas Guzzler",
    "Smoking Skid Lid",
    "Lunatic's Leathers",
    "Employee of the Mmmph",
    "Frymaster",
    "Combustible Kabuto",
    "Glengarry Bonnet",
    "Scotsman's Stove Pipe",
    "Hustler's Hallmark",
    "Tippler's Tricorne",
    "Rimmed Raincatcher",
    "Sober Stuntman",
    "Carouser's Capotain",
    "Scotch Bonnet",
    "Prince Tavish's Crown",
    "Samur-Eye",
    "Reggaelator",
    "Sultan's Ceremonial",
    "Conjurer's Cowl",
    "Tam O' Shanter",
    "Mask of the Shaman",
    "Tavish DeGroot Experience",
    "Buccaneer's Bicorne",
    "A Whiff of the Old Brimstone",
    "Aladdin's Private Reserve",
    "Snapped Pupil",
    "Liquor Locker",
    "Bird-Man of Aberdeen",
    "Bearded Bombardier",
    "Voodoo JuJu (Slight Return)",
    "Cool Breeze",
    "Dark Age Defender",
    "Glasgow Great Helm",
    "Black Watch",
    "Tartan Spartan",
    "Gaelic Golf Bag",
    "Whiskey Bib",
    "Stormin' Norman",
    "Gaelic Garb",
    "Hurt Locher",
    "Pirate Bandana",
    "Highland High Heels",
    "Tartan Tyrolean",
    "Razor Cut",
    "Frontier Djustice",
    "Allbrero",
    "Seeing Double",
    "Six Pack Abs",
    "Officer's Ushanka",
    "Tough Guy's Toque",
    "Hound Dog",
    "Heavy Duty Rag",
    "Pugilist's Protector",
    "Hard Counter",
    "Cadaver's Cranium",
    "Big Chief",
    "Magnificent Mongolian",
    "Coupe D'isaster",
    "Dread Knot",
    "Large Luchadore",
    "Capo's Capper",
    "Copper's Hard Top",
    "Security Shades",
    "Big Steel Jaw of Summer Fun",
    "Pilotka",
    "Dragonborn Helmet",
    "Purity Fist",
    "One-Man Army",
    "Outdoorsman",
    "Gym Rat",
    "Sandvich Safe",
    "Toss-Proof Towel",
    "Apparatchik's Apparel",
    "Soviet Gentleman",
    "Heavy's Hockey Hair",
    "Der Maschinensoldaten-Helm",
    "Die Regime-Panzerung",
    "Little Bear",
    "Tyurtlenek",
    "Red Army Robin",
    "Heavy-Weight Champ",
    "Tsarboosh",
    "Katyusha",
    "Borscht Belt",
    "Bear Necessities",
    "Bolshevik Biker",
    "Gabe Glasses",
    "Minnesota Slick",
    "Mann of the House",
    "Yuri's Revenge",
    "Jungle Booty",
    "Texas Ten Gallon",
    "Engineer's Cap",
    "Texas Slim's Dome Shine",
    "Hotrod",
    "Safe'n'Sound",
    "Buckaroo's Hat",
    "Industrial Festivizer",
    "Western Wear",
    "Big Country",
    "Professor's Peculiarity",
    "Teddy Roosebelt",
    "Googly Gazer",
    "Ol' Geezer",
    "Hetman's Headpiece",
    "Prairie Heel Biters",
    "Pip-Boy",
    "Wingstick",
    "Brainiac Hairpiece",
    "Brainiac Goggles",
    "Pencil Pusher",
    "Builder's Blueprints",
    "Virtual Reality Headset",
    "Stocking Stuffer",
    "Texas Half-Pants",
    "Idea Tube",
    "Pocket Purrer",
    "Barnstormer",
    "Mister Bubbles",
    "Pocket Pyro",
    "Trash Toter",
    "Dry Gulch Gulp",
    "Pardner's Pompadour",
    "Flared Frontiersman",
    "Gold Digger",
    "Face Full of Festive",
    "Dogfighter",
    "Tools of the Trade",
    "Joe-on-the-Go",
    "Peacenik's Ponytail",
    "Level Three Chin",
    "Egghead's Overalls",
    "Lonesome Loafers",
    "Endothermic Exowear",
    "Danger",
    "Vintage Tyrolean",
    "Otolaryngologist's Mirror",
    "Ze Goggles",
    "Gentleman's Gatsby",
    "Berliner's Bucket Helm",
    "Blighted Beak",
    "German Gonzila",
    "Geisha Boy",
    "Medic's Mountain Cap",
    "Grimm Hatte",
    "Doctor's Sack",
    "Surgeon's Stahlhelm",
    "Couvre Corner",
    "Surgeon's Stethoscope",
    "Nine-Pipe Problem",
    "Surgeon's Side Satchel",
    "Gentleman's Ushanka",
    "Medi-Mask",
    "Archimedes",
    "Der Wintermantel",
    "Doc's Holiday",
    "Das Hazmattenhatten",
    "Das Feelinbeterbager",
    "Das Ubersternmann",
    "Das Metalmeatencasen",
    "Das Naggenvatcher",
    "Das Maddendoktor",
    "Das Gutenkutteharen",
    "Baron von Havenaplane",
    "Das Fantzipantzen",
    "Medical Mystery",
    "A Brush with Death",
    "Slick Cut",
    "Ward",
    "Nunhood",
    "Angel of Death",
    "Mann of Reason",
    "Ruffled Ruprecht",
    "Ze Übermensch",
    "Medicine Manpurse",
    "Chronoscarf",
    "Professional's Panama",
    "Master's Yellow Belt",
    "Ritzy Rick's Hair Fixative",
    "Shooter's Sola Topi",
    "Bloke's Bucket Hat",
    "Ol' Snaggletooth",
    "Larrikin Robin",
    "Crocleather Slouch",
    "Villain's Veil",
    "Desert Marauder",
    "Anger",
    "Your Worst Nightmare",
    "Crocodile Smile",
    "Swagman's Swatter",
    "Outback Intellectual",
    "Fruit Shoot",
    "Liquidator's Lid",
    "Koala Compact",
    "Sir Hootsalot",
    "Cold Killer",
    "Criminal Cloak",
    "Dread Hiding Hood",
    "Birdman of Australiacatraz",
    "Cobber Chameleon",
    "Falconer",
    "Wet Works",
    "Chronomancer",
    "Brim-Full of Bullets",
    "Li'l Snaggletooth",
    "Snow Scoper",
    "Five-Month Shadow",
    "Golden Garment",
    "Extra Layer",
    "Scoper's Smoke",
    "Triggerman's Tacticals",
    "Camera Beard",
    "Backbiter's Billycock",
    "Magistrate's Mullet",
    "Frenchman's Beret",
    "Familiar Fez",
    "Détective Noir",
    "Le Party Phantom",
    "Noh Mercy",
    "Charmer's Chapeau",
    "Janissary Ketche",
    "Cosa Nostra Cap",
    "Made Man",
    "Rogue's Col Roule",
    "Nanobalaclava",
    "Counterfeit Billycock",
    "L'Inspecteur",
    "Spectre's Spectacles",
    "Sneaky Spats of Sneaking",
    "Business Casual",
    "Hat of Cards",
    "Scarecrow",
    "Cut Throat Concierge",
    "Pom-Pommed Provocateur",
    "Harmburg",
    "Rogue's Brogues",
    "Belgian Detective",
    "Blood Banker",
    "After Dark",
    "L'homme Burglerre",
    "Escapist",
    "Rogue's Robe",
    "Aviator Assassin",
    "Sky Captain",
    "Au Courant Assassin",
    "Team Captain",
    "Private Eye",
    "Pocket Medic",
    "Hat With No Name",
    "Dr. Whoa",
    "Ornament Armament",
    "Itsy Bitsy Spyer",
    "All-Father",
    "Teufort Tooth Kicker",
    "HazMat Headcase",
    "Bonedolier",
    "Spooky Sleeves",
    "Exorcizor",
    "Powdered Practitioner",
    "Macho Mann",
    "Viking Braider",
    "Cuban Bristle Crisis",
    "Beep Boy",
    "Special Eyes",
    "Weight Room Warmer",
    "Frenchman's Formals",
    "Sub Zero Suit",
    "Toy Soldier",
    "Towering Pillar of Hats",
    "Noble Amassment of Hats",
    "Modest Pile of Hat",
    "Dr's Dapper Topper",
    "Horrific Headsplitter",
    "A Rather Festive Tree",
    "Deus Specs",
    "Company Man",
    "Killer Exclusive",
    "Salty Dog",
    "Hot Dogger",
    "Flair!",
    "Clan Pride",
    "Brown Bomber",
    "Balloonicorn",
    "Rump-o'-Lantern",
    "Crone's Dome",
    "Executioner",
    "Tuxxy",
    "Tough Stuff Muffs",
    "Merc's Muffler",
    "Antlers",
    "Baronial Badge",
    "Brotherhood of Arms",
    "Well-Rounded Rifleman",
    "Breakneck Baggies",
    "Graybanns",
    "Federal Casemaker",
    "Virtual Viewfinder",
    "Cotton Head",
    "Hong Kong Cone",
    "Dictator",
    "Neckwear Headwear",
    "Dead of Night",
    "Kiss King",
    "Polar Pullover",
    "Bruiser's Bandanna",
    "Merc's Mohawk",
    "Eye-Catcher",
    "Vive La France",
    "Tipped Lid",
    "Crown of the Old Kingdom",
    "Tomb Readers"
];