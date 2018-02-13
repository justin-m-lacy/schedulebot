var Discord = require( 'discord.js');
var auth = require('./auth.json');
var React = require( './reactions.js');
var Cmd = require( './commands.js');

const fs = require( 'fs' );
const path = require( 'path' );
const CmdPrefix = '!';

function initReactions() {

	let reactData = require('./reactions.json');
	return new React.Reactions( reactData );
}

function initCmds(){ 

	let cmds = new Cmd.Dispatch( CmdPrefix );
	
	cmds.add( 'schedule', cmdSchedule, 2, 2, '!schedule [activity] [times]', 'right');
	cmds.add( 'sleep', cmdSleep, 1, 1, '!sleep [sleep schedule]');
	cmds.add( 'when', cmdWhen, 2, 2, '!when [userName] [activity]');
	cmds.add( 'roll', cmdRoll, 1,1, '!roll [n]d[s]');
	cmds.add( 'lastplay', cmdLastPlay, 2, 2, '!lastplay [userName] [gameName]');
	cmds.add( 'laston', cmdLastOn, 1, 1, '!laston [userName]');
	cmds.add( 'lastactive', cmdLastActive, 1, 1, '!lastactive [userName]');
	cmds.add( 'lastoff', cmdLastOff, 1, 1, '!lastoff [userName]');

	cmds.add( 'test', cmdTest, 1, 1, '!test [ping message]');

	return cmds;

}

// init bot
var bot = new Discord.Client( {} );

var reactions = initReactions();
var dispatch = initCmds();

bot.on( 'ready', function(evt) {
    console.log('Scheduler Connected: ' + bot.username + ' - (' + bot.id + ')');
});

bot.on( 'message', do_msg );
bot.on( 'presenceUpdate', presenceChanged );
bot.on( 'error', doError );

bot.login( auth.token );

process.on( 'exit', onShutdown );
process.on( 'SIGINT', onShutdown );


function doError( err ) {
	console.log( 'Error connecting: ' + err.message );
	onShutdown();
}

function onShutdown() {
	if ( bot != null ) {
		bot.destroy();
		bot = null;
	}
}


function do_msg( msg ) {

	if ( msg.author.id == bot.user.id ) {
		return;
	}

	try {

		let content = msg.content;

		if ( content.substring(0,1) === CmdPrefix ) {

			doCommand( msg );

		} else {

			let reaction = reactions.react( content );
			if ( reaction != null ) {
				msg.channel.send( reaction );
			}

		}

	} catch ( exp ) {
		console.error( exp );
	}

}

function doCommand( msg ) {

	let error = dispatch.process( msg.content, [msg] );

	if ( error )
		msg.channel.send( error );

}

function cmdRoll( msg, dice ) {

	let ind = dice.indexOf( 'd' );
	let num, sides;

	if ( ind < 0 ) {

		num = 1;
		sides = parseInt(dice);

	} else {

		num = parseInt( dice.slice(0,ind) );
		if ( isNaN(num)) num = 1;
		sides = parseInt( dice.slice( ind+1 ) );

	}

	if ( isNaN(sides)) sides = 6;

	let total = 0;
	while ( num-- > 0 ) {
		total += Math.floor( sides*Math.random() ) + 1;
	}

	msg.channel.send( msg.member.displayName + ' rolled ' + total );

}

function cmdSleep( msg, when ) {
	setSchedule( msg.member, 'sleep', when );
}
function cmdSchedule( msg, activity, when ) {

	console.log( 'scheduling: ' + activity + ' at: ' + when );
	setSchedule( msg.member, activity, when );
	msg.channel.send( 'Scheduled ' + activity + ' for ' + msg.member.displayName );

}

function cmdWhen( msg, who, activity ) {
	sendSchedule( msg.channel, who, activity );
}

function cmdLastPlay( msg, who, game ){
	sendGameTime( msg.channel, who, game );
}

function cmdLastOn( msg, who ){
	sendHistory( msg.channel, who, ['online','idle','dnd'], 'online' );
}

function cmdLastActive( msg, who ){
	sendHistory( msg.channel, who, 'online', 'active' );
}

function cmdLastOff( msg, who ){
	sendHistory( msg.channel, who, 'offline', 'offline' );
}

function cmdTest( msg, reply ){
	msg.channel.send( reply + ' yourself, ' + msg.member.displayName );
}

function sendGameTime( channel, displayName, gameName ) {
	
	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	if ( gMember.presence.game != null && gMember.presence.game.name === gameName ) {
		channel.send( displayName + ' is playing ' + gameName );
		return;
	}

	readMemberData( gMember, (err,data)=>{

		if ( err == null && data.hasOwnProperty( 'games') ) {

			let games = data.games;
			if ( games.hasOwnProperty(gameName ) ) {
				let date = new Date( games[gameName] );
				channel.send( displayName + ' last played ' + gameName + ' on ' + date.toLocaleString() );
				return;
			}

		}
		channel.send( gameName + ': No record for ' + displayName + ' found.' );
		
	});

}

// send status history of user to channel.
// statuses is a single status string or array of valid statuses
// statusName is the status to display in channel.
function sendHistory( channel, displayName, statuses, statusName ) {

	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	if ( hasCurrentStatus(gMember, statuses ) ) {

		channel.send( displayName + ' is now ' + statusName );
		return;

	}

	readMemberData( gMember, (err,data)=> {

		if ( err != null || !data.hasOwnProperty( 'history' ) ) {
			channel.send( 'The requested information could not be found.' );
			return;
		}

		let lastTime = getHistory( data.history, statuses );

		if ( isNaN(lastTime) ) {

			channel.send( 'I have no record of ' + display + ' being ' + statusName );

		} else {

			let date = new Date( lastTime );
			if ( statusName == null ) { statusName = evtType; }
			channel.send( 'Last saw ' + displayName + ' ' + statusName + ' on ' + date.toLocaleString() );
		}
		
	
	});

}

function hasCurrentStatus( gMember, statuses ) {

	let status = gMember.presence.status;
	if ( statuses instanceof Array ) {

		for( let i = statuses.length-1; i >= 0; i-- ) {	

			if ( statuses[i] === status ) return true;
		}
		return false;

	}
	return statuses === status;

}

// checks json history object for last time in a given status
// or in an array of statuses.
function getHistory( history, statuses ) {

	if ( statuses instanceof Array ) {

		let status = null;
		let statusTime = null;
		
		if ( statuses.length == 0 ) { return null; }
		for( let i = statuses.length-1; i >= 0; i-- ) {

			status = statuses[i];
			if ( history.hasOwnProperty(status) ) {
				statusTime = ( statusTime==null ? history[status] : Math.max( history[status], statusTime ) );
			}

		}
		return statusTime;
	
	} else {
		if ( history.hasOwnProperty( statuses ) ) {
			return history[statuses];
		}
	}
	return null;
}

// send schedule message to channel, for user with displayName
function sendSchedule( channel, displayName, activity ) {

	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	readSchedule( gMember, activity, (sched)=>{

		if ( sched ) {
			channel.send( displayName + ' ' + activity + ': ' + sched );
		} else {
			channel.send( 'No ' + activity + ' schedule found for ' +  displayName + '.' );
		}

	});

}

// guild member to find schedule for.
// type of schedule being checked.
// cb( scheduleString ) - string is null or empty on error
function readSchedule( gMember, scheduleType, cb ) {

	readMemberData( gMember, (err,data)=> {

		if ( err == null ) {

			try {

				console.log( "DATA LOADED: " + JSON.stringify(data) );
				if ( data != null && data.hasOwnProperty('schedule') && cb != null ) {
					cb( data.schedule[scheduleType] );
					return;
				}

			} catch( exp ) {
				console.log( exp );
			}

		}

		if ( cb != null ) {
			cb( null );
		}


	});

}

/// sets the schedule of a given guild member, for a given schedule type.
function setSchedule( gMember, scheduleType, scheduleString ) {

	readMemberData( gMember, (err,data)=> {

		let newData = { schedule: { [scheduleType]:scheduleString } };
		if ( err == null ) {
			console.log( 'old file data loaded' );
			mergeRecursive( newData, data );
			writeMemberData( gMember, data );
		} else {
			console.log( 'error reading file data' );
			writeMemberData( gMember, newData );
		}

	});

}

function presenceChanged( oldMember, newMember ) {
	
	if ( oldMember.id == bot.id ) {
		// ignore bot events.
		return;
	}

	let oldStatus = oldMember.presence.status;
	let newStatus = newMember.presence.status;

	if ( newStatus != oldStatus ) {

		/// statuses: 'offline', 'online', 'idle', 'dnd'
		logStatus( oldMember, oldStatus );
		console.log( newMember.displayName + ' status changed: ' + newStatus );
		//oldMember.guild.systemChannel.send( oldMember.displayName + ' status changed: ' + newStatus );

	}

	let oldGame = oldMember.presence.game;
	let newGame = newMember.presence.game;
	let oldGameName = oldGame == null ? null : oldGame.name;
	let newGameName = newGame == null ? null : newGame.name;

	if ( oldGameName != newGameName ){

		if ( oldGame != null ) {
			logGame( oldMember, oldGame );
		}
		if ( newGame != null ) {
			console.log( newMember.displayName + ' game changed: ' + newGame.name );
		}

	}

}

function logGame( guildMember, game ) {

	readMemberData( guildMember, (err,data)=> {

		let gameName = game.name;
		let newData = { games:{
				[gameName]:Date.now()
			}
		};

		if ( err == null ) {

			mergeRecursive( newData, data );
			writeMemberData( guildMember, data );

		} else {
			writeMemberData( guildMember, newData );
		}

	});

}

// Log a guild member's last status within the guild.
function logStatus( guildMember, theStatus ) {

	readMemberData( guildMember, (err,data)=> {

		let newData = { history:{
			[theStatus]:Date.now()
			}
		};

		if ( err == null ) {

			mergeRecursive( newData, data );
			writeMemberData( guildMember, data );

		} else {
			writeMemberData( guildMember, newData );
		}

	});

}

// hasMembers is an object with a members property,
// such as a Guild or a Channel.
function findMember( hasMembers, displayName ) {
	return hasMembers.members.find( 'displayName', displayName );
}

// Attempts to read the json member file for a guild member.
// cb(err,data) on complete. data is null on error.
function readMemberData( guildMember, cb ) {

	let filePath = getMemberPath( guildMember );
	fs.readFile( filePath, (err,data)=>{

		if ( err == null ) {

			try {
				let objData = JSON.parse(data);
				if ( cb != null ) {
					cb(null, objData);
				}

			} catch ( exp ) {
				console.log( exp );
				if ( cb != null ) {
					cb(exp,null);
				}
			}
			return;

		}
		console.log( 'read err: ' + err );
		if ( cb != null ) {
			cb(err,null);
		}

	});

}

// write guildMember data file to guild folder.
// cb(err) callback.
function writeMemberData( guildMember, jsonData, cb ) {

	let filePath = getMemberPath( guildMember );
	fs.writeFile( filePath, JSON.stringify( jsonData ), {flag:'w+'}, (err)=>{

		if ( err != null ) {
			console.log( 'error writing file: ' + err );
		}
		if ( cb != null ) {
			cb(err);
		}

	});

}

function writeJsonData( filePath, jsonData ) {

	fs.writeFile( filePath, JSON.stringify( jsonData ),
		(err)=>{

		if ( err != null ) {
			console.log( 'error writing file: ' + filePath );
		}

	} );

}

// Return the string path to the guild member's file for that guild.
function getMemberPath( guildMember ) {

	if ( guildMember == null ) { return '';}
	if ( guildMember.guild == null ) { return '';}

	let guild = guildMember.guild.id;

	ensureDir( guild );

	return path.join( guild, (guildMember.id) + '.json' );

}

// Ensure a directory exists, creating it if it does not.
function ensureDir( dirPath, cb ) {
	
	fs.mkdir( dirPath, function( err ){
		if ( cb != null ) {
			cb();
		}
	});

}

// Performs a recursive merge of variables from src to dest.
// Variables from src override variables in dest.
function mergeRecursive( src, dest ) {

	for( var key in src ) {

		if ( !src.hasOwnProperty(key) ) {
			continue;
		}

		var newVal = src[key];
		var oldVal = dest[key];
		if ( oldVal != null && oldVal instanceof Object && newVal instanceof Object ) {

			mergeRecursive( newVal, oldVal );

		} else {
			dest[key] = newVal;
		}

	}

}

// merges all variables of src into dest.
// values from src overwrite dest.
function objectMerge( src, dest ) {

	for( var key in src ) {

		if ( src.hasOwnProperty( key ) ) {
			dest[key] = src[key];
		}

	}

}