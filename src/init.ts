import { getImporters } from './config/icon-sets.js';
import { iconSetsStorage } from './data/icon-set/store/storage.js';
import { setImporters, updateIconSets } from './data/icon-sets.js';
import { cleanupStorageCache } from './data/storage/startup.js';
import { Importer } from './types/importers.js';
import { saveCache, loadCache, cacheExists } from './misc/cache.js';

interface InitOptions {
	// Cleanup storage cache
	cleanup?: boolean;

	// Importers
	importers?: Importer[];
}

/**
 * Init API
 */
export async function initAPI(options: InitOptions = {}) {
	// Reset old cache
	if (options.cleanup !== false) {
		await cleanupStorageCache(iconSetsStorage);
	}

	const forceRefresh = options.cleanup === true;

	if (await cacheExists() && !forceRefresh) {
		// Charger depuis le cache
		const cache = await loadCache();
		const importers = cache.importers.map(async (data: any) => {
			// On suppose que tous les importers sont du type full
			// et possèdent la méthode fromCache
			// (adapter ici si plusieurs types d'importers)
			const base = await import('./importers/full/base.js');
			return (base.createBaseImporter as any).fromCache(data);
		});
		setImporters(await Promise.all(importers));
		updateIconSets();
		return;
	}

	// Get all importers and load data
	let importers = options.importers;
	if (!importers) {
		importers = await getImporters();
	}

	// Init importers
	for (let i = 0; i < importers.length; i++) {
		await importers[i].init();
	}

	// Update
	setImporters(importers);
	updateIconSets();

	// Sauvegarder le cache
	const cacheData = {
		importers: importers.map((imp: any) => (typeof imp.toCache === 'function' ? imp.toCache() : null)),
	};
	await saveCache(cacheData);
}
