const fs = require( 'fs');

exports.readJSON = path => new Promise( (res,rej)=>{

	fs.readFile( path, (err,data)=>{

		if ( err ) rej(err);
		let json = JSON.parse( data );
		res( json );

	});

});

exports.writeJSON = (path,data) => new Promise( (res, rej)=>{

	fs.writeFile( path, JSON.stringify(data), (err)=>{

		if ( err ) rej(err);
		res();

	});

});