const mil_per_day = 1000*3600*24;
const mil_per_hour = 1000*3600;

exports.DateDisplay = class {

	static recent( time ) {

		let dt;

		if ( time instanceof Date ) {
			dt = Date.now() - time.getTime();
		} else {
			dt = Date.now() - time;
			time = new Date(time);
		}

		if ( this.inDay(dt) ) return 'at ' + time.toLocaleTimeString();
		return 'on ' + time.toLocalDateString() + ' at ' + time.toLocaleTimeString();


	}

	// elapsed time less than day
	static inDay( dt ) {
		return Math.abs(dt) < mil_per_day;
	}

	// elapsed less than week
	static inWeek( dt ) {
		return Math.abs(dt) < 7*mil_per_day;
	}

	// elapsed less than month.
	static inMonth( dt ) {
		return Math.abs(dt) < 31*mil_per_day;
	}


}