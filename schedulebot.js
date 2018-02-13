var Discord = require( 'discord.js');
var auth = require('./auth.json');
var React = require( './reactions.js');
var Cmd = require( './commands.js');
var Dates = require( './datedisplay.js' );
var Dice = require( './dice.js' );

var objutils = require( './objutils.js' );
const fsj = require( './fjson.js');
const fs = require( 'fs' );
const path = require( 'path' );

const ServersDir = './servers/'
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
	console.log( 'Connection error: ' + err.message );
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

	let total = Dice.Roller.roll( dice );
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

async function sendGameTime( channel, displayName, gameName ) {
	
	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	if ( gMember.presence.game != null && gMember.presence.game.name === gameName ) {
		channel.send( displayName + ' is playing ' + gameName );
		return;
	}

	try {

		let data = await readMemberData( gMember );
		let games = data.games;

		let dateStr = Dates.DateDisplay.recent( games[gameName] );
		channel.send( displayName + ' last played ' + gameName + ' ' + dateStr );

	} catch ( err ) {
		channel.send( gameName + ': No record for ' + displayName + ' found.' );
	}

}

function cmdOffTime( chan, name ) {

	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}
	if ( !hasStatus(gMember, 'offline') ) {
		chan.send( name + ' is not offline.' );
		return;
	}

}

// send status history of user to channel.
// statuses is a single status string or array of valid statuses
// statusName is the status to display in channel.
async function sendHistory( channel, displayName, statuses, statusName ) {

	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	if ( hasStatus(gMember, statuses ) ) {

		channel.send( displayName + ' is now ' + statusName );
		return;

	}

	try {

		let memData = await readMemberData( gMember );
		let lastTime = getHistory( memData.history, statuses );

		let dateStr = Dates.DateDisplay.recent( lastTime );
		if ( statusName == null ) statusName = evtType;
		channel.send( 'Last saw ' + displayName + ' ' + statusName + ' ' + dateStr );

	} catch ( err ) {
		channel.send( 'I have no record of ' + display + ' being ' + statusName );
	}

}

function hasStatus( gMember, statuses ) {

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
async function sendSchedule( channel, displayName, activity ) {

	let gMember = findMember( channel.guild, displayName );
	if ( gMember == null ) {
		channel.send( 'User ' + displayName + ' not found.' );
		return;
	}

	let sched = await readSchedule( gMember, activity );
	if ( sched ) {
		channel.send( displayName + ' ' + activity + ': ' + sched );
	} else {
		channel.send( 'No ' + activity + ' schedule found for ' +  displayName + '.' );
	}

}

// guild member to find schedule for.
// type of schedule being checked.
// cb( scheduleString ) - string is null or empty on error
async function readSchedule( gMember, schedType ) {

	try {

		let data = await readMemberData( gMember );
		if ( data != null && data.hasOwnProperty('schedule') ) {
			return data.schedule[schedType];
		}

	} catch ( err ){
		console.log( err );
		return null;
	}

}

/// sets the schedule of a given guild member, for a given schedule type.
async function setSchedule( gMember, scheduleType, scheduleString ) {

	try {

		let newData = { schedule: { [scheduleType]:scheduleString } };
		await mergeMember( gMember, newData );

	} catch ( err ) {
		console.log( 'could not set schedule.');
	}

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
	let oldGameName = oldGame ? oldGame.name : null;
	let newGameName = newGame ? newGame.name : null;

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

	let gameName = game.name;
	let newData = { games:{
			[game.name]:Date.now()
		}
	};
	mergeMember( guildMember, newData );

}

// Log a guild member's last status within the guild.
function logStatus( guildMember, theStatus ) {

	let newData = { history:{
		[theStatus]:Date.now()
		}
	};
	mergeMember( guildMember, newData );

}

// hasMembers is an object with a members property,
// such as a Guild or a Channel.
function findMember( hasMembers, displayName ) {
	return hasMembers.members.find( 'displayName', displayName );
}

// merge with existing member data.
async function mergeMember( guildMember, newData ){

	try {

		let data = await readMemberData( guildMember );
		objutils.recurMerge( newData, data );
	
		newData = data;

	} catch ( err ){

		console.log( err );
		console.log( 'No cur data for ' + guildMember.displayName );

	} finally {

		try {
			await writeMemberData( guildMember, newData );
		} catch(err){}

	}

}

// Attempts to read the json member file for a guild member.
// cb(err,data) on complete. data is null on error.
async function readMemberData( guildMember ) {

	let filePath = getMemberPath( guildMember );
	return await fsj.readJSON( filePath );

}

// write guildMember data file to guild folder.
// cb(err) callback.
async function writeMemberData( guildMember, jsonData ) {

	let filePath = getMemberPath( guildMember );

	try {
		await fsj.mkdir( getGuildDir( guildMember.guild ) );
	} catch ( err ){}
	await fsj.writeJSON( filePath, jsonData );

}

// path to guild storage.
function getGuildDir( guild ) {
	if ( guild == null ) return ServersDir;
	return path.join( ServersDir, guild.id );
}

// Return the string path to the guild member's file for that guild.
function getMemberPath( guildMember ) {

	if ( guildMember == null ) return '';
	if ( guildMember.guild == null ) return '';

	let gid = guildMember.guild.id;

	return path.join( ServersDir, gid, (guildMember.id) + '.json' );

}