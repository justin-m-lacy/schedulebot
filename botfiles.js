const path = require( 'path');
const fsj = require( './fjson.js');

const ServersDir = './servers/'
const GamesDir = 'games'
const PluginsDir = 'plugins/'

// Read the json file for a guild member.
async function readMemberData( guildMember ) {

	let filePath = getMemberPath( guildMember );
	return await fsj.readJSON( filePath );

}

// write guildMember data file to guild folder.
async function writeMemberData( guildMember, jsonData ) {

	let filePath = getMemberPath( guildMember );

	try {
		await fsj.mkdir( getGuildDir( guildMember.guild ) );
	} catch ( err ){}
	await fsj.writeJSON( filePath, jsonData );

}

function getPluginDir( guild ) {
	if ( guild == null ) return PluginsDir;
	return path.join( ServersDir, PluginsDir );
}

// path to guild storage.
function getGuildDir( guild ) {
	if ( guild == null ) return ServersDir;
	return path.join( ServersDir, guild.id );
}

// path to member's base guild file.
function getMemberPath( guildMember ) {

	if ( guildMember == null ) return '';
	if ( guildMember.guild == null ) return '';

	let gid = guildMember.guild.id;

	return path.join( ServersDir, gid, (guildMember.id) + '.json' );

}