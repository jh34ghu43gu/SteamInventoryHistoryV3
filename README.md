# SteamInventoryHistoryV3
 Attempt #3, now for use by everyone

# How to use
 1) Install tampermonkey for your web browser, greasemonkey may also work but I have only tested for tampermonkey on firefox.
 2) Create a new userscript and copy the contents of "Tf2 Inventory History Downloader" from the script folder into the new userscript
 3) Go to https://steamcommunity.com/my/inventoryhistory?app%5B0%5D=440&l=english and click the Download as json button.
   Note: If you need to stop, or the script stops itself, make sure to save the cursor that appears in the text input, this will allow you to continue the download from where you left off.
 4) Do something with your json (stat analysis feature coming eventually).
 
# Versions

 ### 0.2.1
 * Events are turned into ids if they are on the list
 * * This obstructs trade information for privacy concerns, next version will have selector to exclude/include specific events only.
 ## 0.2
 * Retries 10 times before giving up if nothing is returned
 * Gathers items from the last result
 * If the script started on the last page it would loop back to the start, no longer does this and will stop
 * Anytime the script stops it will now save cursor progress to console and the cursor input box
 * Removed a log statement that wasn't needed and made some lag after a bit

 ## 0.1
 Works...?
