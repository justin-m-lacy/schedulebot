exports.Cache = class {

	constructor( max_entries, resolver, backup ) {

		this.max_size = max_entries;
		this.resolver = resolver;

		this.dict = {};

	}

	async get( key ) {

		if ( this.dict.hasOwnProperty(key)){
			return this.dict[key];
		}
		return await resolver(key);

	}

	async store( key, value ) {

		this.dict[key] = value;
		if ( backup ) {
			await backup( key, value );
		}

	}

	free( key ){
		delete this.dict[key];
	}

	has( key ) {
		return this.dict.hasOwnProperty(key);
	}


}