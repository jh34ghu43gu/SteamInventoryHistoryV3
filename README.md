# SteamInventoryHistoryV3
 Attempt #3, now for use by everyone

# How to use (first time)
 Note: In these instructions, unless otherwise specified, "upload" refers to the button by the label "Load in previous progress:" and allows the script to load previous json(s); you are not actually uploading the file to any remote computer or server.
 1) Install [tampermonkey](https://www.tampermonkey.net/) for your web browser, greasemonkey may also work but I have only tested for tampermonkey on (a) firefox (branch).
 2) [Install the script](https://github.com/jh34ghu43gu/SteamInventoryHistoryV3/raw/main/Script/Tf2%20Inventory%20History%20Downloader.user.js) by opening the raw .user.js file in the script folder (or click the link).
 3) If you have any extensions or scripts (History Bastard) that run on the inventory history page you should disable them in case the scripts conflict.
 4) Go to your Steam [inventory history](https://steamcommunity.com/my/inventoryhistory?app%5B0%5D=440&l=english)
 5) Select the options for your situation. By default your trades and SCM events will not be saved, if you are downloading this for personal reasons you may want to unselect this. If you are submitting this to me for data analysis and are concerned about anonymity, you may want to select "Only MvM events" or "Only Unbox events" or both. Although I will not share any specific data given to me, these 2 options are the hardest to have linked back to your account (although it would not be impossible; for example: 1 of 1 unusuals may be found via backpack.tf). If you are submitting this to me and are less concerned about anonymity, please check the "Save item ids" option as this will allow me to fabricate an item id timeline similar to what [tf2tools](https://web.archive.org/web/20180515034133/http://www.tf2tools.net/articles/itemids) used to have. If you are downloading for personal reasons you will find item ids helpful in locating your old items on backpack.tf or other sites that track ids; selecting "Only original ids" will cut down on the file size and will only include ids for items that you created (from unboxing, tours, item drops, etc..).
 6) Click the "Download as json" button. Download times and size will vary based on how much inventory interaction you have. Extremely active accounts will receive an error 429 (Too many requests) before the full history can be downloaded; from my tests this happens after about 1.5-2 hours. If you are rate limited, save the file from the prompt and wait a day before continuing. You can continue by re-opening the page and uploading or by leaving the tab open and clicking "Download as json" again. If you continue via uploading make sure to reselect your options! None of my tests have gone above 1GB of memory usage (that I have observed), but still very hefty amounts above 600MB. Try not to starve the tab of resources or you may skip dates, the easiest way to avoid this is to leave the tab active and go touch grass :)
 7) When the download is finished you will be prompted to save the json file. If you accidentally do not save it, hit "Download as json" again and hit "Stop download" right after and it should prompt you again.
 8) Open your browser's console (F12) and check the log to verify that the download ended because it ran out of events and not an Error 429. If the download ended from Error 429 see step 5. If it ended for some other reason or you see an error, please report it in the issues tab and I will try my best to fix it.
 9) Click "Generate Statistics Report" to scroll through the various stats.

### How to use (returning)
 * If you want to view your stats again
   *  Upload the json you downloaded and click the "Generate Statistics Report" button when it appears.
 * If you want to continue a download you ended early
   * Upload the json you downloaded, set the options again, and click "Download as json". The json you downloaded before has stored what time you left off at and will automatically resume from that point.
 * If you want to download newer events
   * DO NOT upload the previous json.
   * Start a new download (make sure to set your options!).
   * Monitor the events as they appear and stop the download once you see repeat dates. Save the new json as a different file name.
   * Reload the page.
   * Upload both json files (use ctrl to select multiple files, you must select them both at the same time). Select the larger file first to save some processing time.
   * Click "Download as json" and immediately click "Stop download". Save the new json which has both files combined. Feel free to delete the old files (although I would recommend keeping them in case there was a bug as this combining feature is not well tested).
   
# Versions

 ## 0.9.4
 * Attempted fix for when history loading stalls at the end of steam's cache (#25)
 * Fixed bug where no data returned would trigger the download twice

 ### 0.9.3
 * Downloads now save what missions have been completed on each mvm badge
   * 0.9.4 will use these stats for #30
 * Spells are stored in an array now using the other_dictionary for names and uses the proper names (instead of including "Halloween:  (spell only active during event)")

 ### 0.9.2
 * Unknown assets now trigger X amount of retries (currently 10, defined by IHD_max_event_retries) for the cursor that they were located within
 * Skipped/Missing asset counter removed
   * Replaced by a skipped cursors attribute in the main JSON object which logs which cursors were skipped if retrying X times failed

 ### 0.9.1
 * Fixed an error when combining files where one day had more events than the other file
 * Fixed comparing events to actually use the same dictionary
 * Updated a debug statement to report a date instead of a useless internal event id

 ## 0.9 (NOT BACKWARDS COMPATABILE WITH PRIOR DOWNLOADS)
 * File size improvements (#27)
   * Major keys are assigned abbreviations for the download
   * Quality and levels are properly parsed and stored as numbers now instead of strings
 * Events are now stored in day blocks instead of single list (#32)
   * Day blocks use unix timestamps based on the user's timezone
   * Rewrite to most of the multiple-file loading logic, should result in much faster load times
     * Fixed a bug in file combining where events would always return non-dupe if they had the same event type+time (undocumented)
     * Fixed a bug in file combining where items that didn't have a type attribute would recieve an undefined one, also leading to always returning non-dupe status (undocumented)
     * Dupe checking appears to be working (#8)
 * Warning for error mvm missions now includes what tour
 * Some additional debug statements for combining files
 * Additional check for missing item errors to hopefully prevent a crash
   * Fixed the warning message to actually display the cursor data
 * Fixed a typo with the General Stats header
 * Added MvM robot part distribution stats 

 ## 0.8.2
 * Global items created actually counts items not just events (#23)
 * Update file extension

 ### 0.8.1
 * Added missing 'Festivizer removed' event which was causing issue #22
 * Global stats counts total items created (events that create original ids)

 ## 0.8 (NOT BACKWARDS COMPATABILE WITH PRIOR DOWNLOADS - although you can easily fix this by surrounding the events with "Events" { ... })
 * Events use their own object instead of the main object
 * Loading files now puts the ending cursor of the last file in the input box to automatically start the download where it was left off
 * Remove some dead comments
 * Unusual drystreaks in unboxing stats


 ## 0.7.5
 * Fix decorated weapons not having their grade captured (#20)
 * Add some global stats
   * Total events
   * Item dictionary count
   * Events breakdown

 ### 0.7.4
 * More detailed stats for tradeups
   * All 5 types of grade trade-ups have their own stats and each specific trade-up is also stored

 ### 0.7.3
 * Fix crash when trying to make a stats report due to the timezone data
 * Correct tour counts in 'MvM Tours' stat report

 ### 0.7.2 (NOT BACKWARDS COMPATABILE WITH PRIOR DOWNLOADS)
 * Prep for some global stats (#15)
   * Item types and names use seperate dictionaries
   * Additional other dictionary, currently stores sheen and killstreakers
 * User's local timezone is stored in the download file to help with data crunching in the future (#19)

 ### 0.7.1
 * Confirmation popup when trying to leave/close page after download starts (Issue #10)
 * Unbox stats includes stockings now (previously this was populating the 'error' category)
 * Made a debug statement actually output useful text (Issue #13)
 * Debug statement to output the starting cursor (Attempting to find cause of #14, could not duplicate on 2nd attempt)
 * Auto-stops will now actually disable the stop download button (Issue #12)


 ## 0.7
 * Flipped version ordering for zeus
 * Removed graded item maps in favor of saving the attribute at download. 
 * Added the new SF XV bonus items 
 * Proper casing and more descriptive names for mvm stuff and some crate names; space between names and totals (on the stats report)
 * Don't report unique items from war paint and skin cases anymore (they don't exist probably)
 * Reordered the wear and rarity stat buttons under cases to go above everything else
 * Debug variable to turn on extra log statements
 * Made a few log statements warn statements instead
 * Fixed a bug in IHD_stats_add_item_to_obj() when we didn't have children
 * Record all tours in a stats div
   * If a mission was missed or corruptued (item details didnt load), or a badge was deleted without finishing the tour, then the stats will be somewhat unreliable.
     * Tour Loot Amount Distribution under Two Cities will ignore potentially corrupted tours
   * In-progress tours are not included but the missions are still counted to the total
   * Main feature: See what tour number you got your aussies on!
     * Also drystreak tracking!



 ## 0.6.10
 * Item wear counter

 ### 0.6.9
 * Fix issue #6
   * All bonus items should be properly accounted for and halloween cosmetics have their own count stat.
 * Cases have a graded item totals
   * Currently using arrays, will update in the future to have downloads save the grade as a tag (issue #7).
 * File downloads save a start and end cursor which is used to cross check duplicate entries in multiple files 
   * IHD_duplicate_entry_checker isn't complete iirc.
 * Nice

  ### 0.6.8
 * Fix issue #5

 ### 0.6.7
 * Stats for trade-ups, blood money purchases, and spellbook pages added (under used item stats).
   * Would like to add more stats to trade-ups in the future such as which slot(s) were selected. This would require some dictionary of skins in X collection so massive CBA on it rn.
 * Should be the final events that needed tracking.

 ### 0.6.6
 * Made a function to cutdown the if-else spam in the stat report methods.
 * Deleted items report filters weapons into its own div.
 * Stats for used items, crafted items (both used for crafting and created by crafting), and earned items (holiday items).
   * Used items revealed that 0.6.4 fix for issue #4 wasn't complete as there's still 2 unlocked 2016 cases in the results :(
     * Probably due to unknown items so maybe fixed when handling for those is added.

 ### 0.6.5
 * Stats for in-game purchases, deleted items, and found items.

 ### 0.6.4
 * Fixed issue #2 (giftapualt events) and hopefully (test download running after commit) #4 (unlocked/used crates not working)
   * Side effect of #2 is the item id list has an unused event for id 12
   * Side effect of #4 is an inverted dictionary is now kept updated while downloading
     * Minor speed boost when actually creating the download file since the dictionary doesn't need inverted?
     * At the same time doubles the memory needed for the dictionary, although my personal history only had just north of 6k entries so probably not terrible.

 ### 0.6.3
 * Stats for unbox events

 ### 0.6.2
 * CSS for stats provided by Viyzen

 ### 0.6.1
 * Fixed a bug with reading files that didn't have events.

 ## 0.6
 * Started adding data analysis.
   * Stats button that can be pressed after a download is stopped or a file is added.
   * Currently only reports stats for mvm and surplus events with the worst CSS buttons you've ever seen.
     * Important stats (as noted above IHD_stats_report()) will be added in the following version 0.6.X's.
     * 0.7 will probably make the buttons look pretty, if anyone is activly following and using this, enjoy the pain.
   * Generating stats stops any other features from working until the page is refreshed.
 * Bug fix: Item painted events weren't being assigned an id since I had the casing wrong.
 * Bug noted: Received a gift from events aren't being assigned an id because they have unique steam names. Will fix later.
 * Minor optimization for some attribute tagging.
 * Bug(?) with spell attribute tagging fixed.
 * Doubled the file size :gentleman:

 ## 0.5.3
 * Massive improvements on first file loading, daisy-chaining file combinations recommended with the largest file going first.
 * More item attributes tracked
   * Spells
   * Early EOTL Supporters
   * Loaners
   * Summer 2014 Adventure
 * Fixed a bug with levels and types for limited attribute items.
 * Fixed a bug with reading the dictionary back from file(s) creating string values for any future events gathered.
 * Lil' bit of code cleanup and added some missing information to a log line.

 ### 0.5.2
 * Fixed some attribute setters not using the variables added in 0.5 and 0.5.1
 * Used events only count as unbox events if the item lost is listed in the `IHD_crate_items_used` array.
   * Added stockings to this list
   * Fixed a bug where things like secret saxtons could create unbox-like events with lots of items, even though you can't get items from them.
   * Possibly fixed another bug that caused a crash relating to this
 * Contract borrows properly store the item gained
   * Should stop a lot of console messages related to "+ or - not found".
 * Note: Tested a large file parse, took a few minutes for ~19mb. Probably improvements in the next version.

 ### 0.5.1
 * Added item types to the dictionary system
 * Fixed a bug causing missing entries in the dictionary (at least when combining files, possibly ever since V0.4).
 * "Type" attribute is also a variable now

 ## 0.5
 * Previous downloads can be read into the script before starting a download.
   * Incompatable with any downloads prior to version 0.4.6.
     * Backwards compatability moving forward will not be enforced until after version 1.0.
   * The file that is saved after stopping will be a combination of the added files and any events that were fetched.
     * Since fetching doesn't start for 5 seconds after pressing the download button, users can combine files by starting and instantly stopping the download.
     * No duplicate event checking; possibly in a later version.
   * Large file testing after 0.5.1 (want to add 1 more change before AFKing a big file to test with).
 * Some attribute names are defined at the top of the script so they could be changed to whatever in future versions.

 ## 0.4.7
 * Option to store item ids
   * Sub-option to store only original item ids (ids from events that create new items)
     * Original ids are useful for getting backpack.tf item links to find out who currently owns your items (e.g. first unboxed unusual).
   * Note: Steam appears to only provide these ids when items are gained, not lost items or held items.

 ### 0.4.5
 * Store effects now
 * Some more compression
   * Assumes items are tradable and marketable by default so it will only store that data if they aren't.
   * No more def indexes
   * Wears are numbered 0-4 now (FN -> BS)
   * Using the quality ids instead of names now
 * Levels and type are isolated from the same key when applicable

 ### 0.4.6
 * A bit more compression
   * Gained and Lost fields instead of items_gained and items_lost. items_on_hold field unchanged.

 ### 0.4.4
 * Even more minor code cleanups
 * Working in VS IDE now so .gitignore update.

 ### 0.4.3
 * Minor code cleanup

 ### 0.4.2
 * No longer outputs a message when "There was a problem loading your inventory history."

 ### 0.4.1
 * Missing event name for "Name changed".

 ### 0.4
 * Implimented a dictionary for item names to save memory/space on very large amounts of events.
 * Fixed a bug that made all "traded with" events use the same ID (Why do json objects auto sort?).
 * Fixed a bug that made all trade hold messages record as empty events.
 * Removed the "success" log message that potentially would cause lag on long runs.
 * Made the trade events offset an actual variable.
 * Only TF2 events will be queried now (issue #1 finally fixed :) ).
   * If you have other games on your first page they will still be recorded, using the link from step 3 of how to use automatically filters to tf2 events so this shouldn't be a problem.

 ## 0.3
 * Filters!
   * Cannot be changed after the download is started until the page is refreshed.
   * Trade filter
     * Does not capture any trade events, SCM events, or in game purchase events.
     * Checked by default
   * MvM filter
     * Only captures mvm or surplus events. 
     * Works with the unbox filter if both are checked.
   * Unbox filter
     * Only captures unboxes, trade ups, and certain used events that resulted in items being granted.
       * Unlocked crates and a few other package items use a "Used" and "Gift recieved" event for some reason.
     * Works with the mvm filter if both are checked.
 * Used events followed by a gift recieved event will be recorded as a single event.
   * Primarily for unlocked cosmetic crates, these, along with spooky unlocked crates, will be recored as unboxes.
   * A few other items used this, such as stockings, and will be recorded as used events.
 * Fixed a crash if an unknown asset appears.
 * Retries 100 times before giving up now; made this a variable easily findable near the top of the script.
 * Next version will have some compression features as the page begins to lag (for me) after it gets into extreme amounts of events (>50k?).

 ## 0.2.1
 * Events are turned into ids if they are on the list
   * This obstructs trade information for privacy concerns, next version will have selector to exclude/include specific events only.
 ### 0.2
 * Retries 10 times before giving up if nothing is returned
 * Gathers items from the last result
 * If the script started on the last page it would loop back to the start, no longer does this and will stop
 * Anytime the script stops it will now save cursor progress to console and the cursor input box
 * Removed a log statement that wasn't needed and made some lag after a bit

 ## 0.1
 Works...?
