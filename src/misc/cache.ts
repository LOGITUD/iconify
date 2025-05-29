import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_PATH = path.resolve(__dirname, '../iconify.cache.json');

export async function saveCache(data: any) {
    await fs.writeFile(CACHE_PATH, JSON.stringify(data), 'utf-8');
}

export async function loadCache() {
    const content = await fs.readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(content);
}

export async function cacheExists() {
    try {
        await fs.access(CACHE_PATH);
        return true;
    } catch {
        return false;
    }
} 