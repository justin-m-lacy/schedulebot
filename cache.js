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

	store( key, value ) {

		this.dict[key] = value;
		if ( backup ) {
			backup( key, value );
		}

	}

	has( key ) {
		return this.dict.hasOwnProperty(key);
	}


}