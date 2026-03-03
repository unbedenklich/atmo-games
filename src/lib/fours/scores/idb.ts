import type { LocalScoreEntry } from './types';

const DB_NAME = 'fours-scores';
const DB_VERSION = 1;
const STORE_NAME = 'scores';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'puzzleUri' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveScoreLocal(entry: LocalScoreEntry): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(entry);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getScoreLocal(puzzleUri: string): Promise<LocalScoreEntry | undefined> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const request = tx.objectStore(STORE_NAME).get(puzzleUri);
		request.onsuccess = () => resolve(request.result ?? undefined);
		request.onerror = () => reject(request.error);
	});
}

export async function getAllLocalScores(): Promise<LocalScoreEntry[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const request = tx.objectStore(STORE_NAME).getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function deleteScoreLocal(puzzleUri: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).delete(puzzleUri);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function deleteAllLocalScores(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
