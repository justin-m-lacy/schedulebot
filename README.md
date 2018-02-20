# schedulebot

View user discord activity within a Server, and set general schedules for other users to read.
More advanced bot development has been moved to: https://github.com/lerpinglemur/archbot

NOTE:

The bot only knows about game, logoff, and logon events that it sees while online. If the bot goes offline, it can miss events and misreport offline times, online times, etc. Also the bot will not know any user's time information until it sees them come online for the first time. The bot works best when running 24/7 or with only short downtimes.

INSTALLATION:

Requires node.js and discord.js to run.

Install node.js, create a directory for your ScheduleBot and run npm install discord.js on the install directory.

Create an 'auth.json' file with the contents: { "token":"YOUR_BOT_TOKEN_HERE"}
This token is private and should not be shared.

Open a command terminal and type: node schedulebot.js
A path to node.js must be in your command path for this to work. 

On Windows you can create a shortcut to command.exe, select Properties, and add '/k node schedulebot.js' to the target.
Then I change the "Start In" directory to the bot directory. This makes for an easy quickstart.

You can optionally create a "reactions.json" file with the following format:

{ "match string1":{"r":"automated response1"}, { "match string2":{"r":"automated response 2" }, ... }

Whenever users type a message which matches one of the substrings, the bot will return the automated response.
a delay is placed between responses to prevent spam.
