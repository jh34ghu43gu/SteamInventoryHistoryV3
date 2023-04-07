# SteamInventoryHistoryV3
 Attempt #3, now for use by everyone

# How to use
 1) Install tampermonkey for your web browser, greasemonkey may also work but I have only tested for tampermonkey on firefox.
 2) Create a new userscript and copy the contents of "Tf2 Inventory History Downloader" from the script folder into the new userscript
 3) Go to https://steamcommunity.com/my/inventoryhistory?app%5B0%5D=440&l=english and click the Download as json button.
   Note: If you need to stop, or the script stops itself, make sure to save the cursor that appears in the text input, this will allow you to continue the download from where you left off.
 4) Do something with your json (stat analysis feature coming eventually).
 
 Note: I personally experienced a 429 error after about 1200 requests in ~3 hours. Open the dev console with F12 and click on the console tab to see the reason why a download stopped. If you also recieved a 429 you should make sure to save the cursor it stopped at, and if possible leave the page open so you can recieve every event in one file. I do not know what the time frame is for these rate limits, the first time it happened I was able to load again after ~6 hours, the second time I was still getting 429s even after 7 hours 54 minutes. Try refreshing the page in a new tab and if you can load it then you can resume the download.
# Versions

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

 ### 0.6.1
 * Fixed a bug with reading files that didn't have events.

 ### 0.6.2
 * CSS for stats provided by Viyzen

 ### 0.6.3
 * Stats for unbox events

 ### 0.6.4
 * Fixed issue #2 (giftapualt events) and hopefully (test download running after commit) #4 (unlocked/used crates not working)
   * Side effect of #2 is the item id list has an unused event for id 12
   * Side effect of #4 is an inverted dictionary is now kept updated while downloading
     * Minor speed boost when actually creating the download file since the dictionary doesn't need inverted?
     * At the same time doubles the memory needed for the dictionary, although my personal history only had just north of 6k entries so probably not terrible.

 ## 0.5
 * Previous downloads can be read into the script before starting a download.
   * Incompatable with any downloads prior to version 0.4.6.
     * Backwards compatability moving forward will not be enforced until after version 1.0.
   * The file that is saved after stopping will be a combination of the added files and any events that were fetched.
     * Since fetching doesn't start for 5 seconds after pressing the download button, users can combine files by starting and instantly stopping the download.
     * No duplicate event checking; possibly in a later version.
   * Large file testing after 0.5.1 (want to add 1 more change before AFKing a big file to test with).
 * Some attribute names are defined at the top of the script so they could be changed to whatever in future versions.

 ### 0.5.1
 * Added item types to the dictionary system
 * Fixed a bug causing missing entries in the dictionary (at least when combining files, possibly ever since V0.4).
 * "Type" attribute is also a variable now

 ### 0.5.2
 * Fixed some attribute setters not using the variables added in 0.5 and 0.5.1
 * Used events only count as unbox events if the item lost is listed in the `IHD_crate_items_used` array.
   * Added stockings to this list
   * Fixed a bug where things like secret saxtons could create unbox-like events with lots of items, even though you can't get items from them.
   * Possibly fixed another bug that caused a crash relating to this
 * Contract borrows properly store the item gained
   * Should stop a lot of console messages related to "+ or - not found".
 * Note: Tested a large file parse, took a few minutes for ~19mb. Probably improvements in the next version.

 ### 0.5.3
 * Massive improvements on first file loading, daisy-chaining file combinations recommended with the largest file going first.
 * More item attributes tracked
   * Spells
   * Early EOTL Supporters
   * Loaners
   * Summer 2014 Adventure
 * Fixed a bug with levels and types for limited attribute items.
 * Fixed a bug with reading the dictionary back from file(s) creating string values for any future events gathered.
 * Lil' bit of code cleanup and added some missing information to a log line.

 ## 0.4
 * Implimented a dictionary for item names to save memory/space on very large amounts of events.
 * Fixed a bug that made all "traded with" events use the same ID (Why do json objects auto sort?).
 * Fixed a bug that made all trade hold messages record as empty events.
 * Removed the "success" log message that potentially would cause lag on long runs.
 * Made the trade events offset an actual variable.
 * Only TF2 events will be queried now (issue #1 finally fixed :) ).
   * If you have other games on your first page they will still be recorded, using the link from step 3 of how to use automatically filters to tf2 events so this shouldn't be a problem.

 ### 0.4.1
 * Missing event name for "Name changed".

 ### 0.4.2
 * No longer outputs a message when "There was a problem loading your inventory history."

 ### 0.4.3
 * Minor code cleanup

 ### 0.4.4
 * Even more minor code cleanups
 * Working in VS IDE now so .gitignore update.

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

 ### 0.4.7
 * Option to store item ids
   * Sub-option to store only original item ids (ids from events that create new items)
     * Original ids are useful for getting backpack.tf item links to find out who currently owns your items (e.g. first unboxed unusual).
   * Note: Steam appears to only provide these ids when items are gained, not lost items or held items.

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

 ## 0.2
 * Retries 10 times before giving up if nothing is returned
 * Gathers items from the last result
 * If the script started on the last page it would loop back to the start, no longer does this and will stop
 * Anytime the script stops it will now save cursor progress to console and the cursor input box
 * Removed a log statement that wasn't needed and made some lag after a bit
 ### 0.2.1
 * Events are turned into ids if they are on the list
   * This obstructs trade information for privacy concerns, next version will have selector to exclude/include specific events only.

 ## 0.1
 Works...?
