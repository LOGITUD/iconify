import { config } from 'dotenv';
import { loaded } from './data/loading.js';
import { loadEnvConfig } from './misc/load-config.js';
import { initAPI } from './init.js';
import path from 'path';
import { readdir } from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
		cleanup: true,
		runUpdate: true
	});

	loaded();
})()
	.then(() => {
		console.log('API startup process complete');
	})
	.catch(console.error);
