import { config } from 'dotenv';
import { loaded } from './data/loading.js';
import { loadEnvConfig } from './misc/load-config.js';
import { initAPI } from './init.js';
import path from 'path';
import { readdir } from 'fs/promises';

(async () => {
	// Configure environment
	config();
	loadEnvConfig();

	console.log('Starting API initialization...');

	// List files in icons directory
	const files = await readdir(path.join(__dirname, 'icons'));
	console.log(files);

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
