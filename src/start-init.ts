import { config } from 'dotenv';
import { loaded } from './data/loading.js';
import { loadEnvConfig } from './misc/load-config.js';
import { initAPI } from './init.js';

(async () => {
	// Configure environment
	config();
	loadEnvConfig();

	// Init API
	await initAPI({
		cleanup: true
	});

	loaded();
})()
	.then(() => {
		console.log('API startup process complete');
	})
	.catch(console.error);
