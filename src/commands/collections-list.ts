// @ts-nocheck
import { apiGet } from '../api-client.js';
import { formatDate, formatTable } from '../format.js';

export async function fetchCollections(config) {
  return apiGet('/api/me/collections', config);
}

export function formatCollectionRow(collection) {
  return [
    collection.slug,
    collection.name,
    collection.type,
    collection.isPublic ? 'public' : 'private',
    collection._count?.items ?? collection.items?.length,
    formatDate(collection.createdAt),
  ];
}

export function formatCollectionsTable(collections) {
  return formatTable(
    ['SLUG', 'NAME', 'TYPE', 'VISIBILITY', 'ITEMS', 'CREATED'],
    collections.map(formatCollectionRow),
  );
}

export async function runCollectionsList(config, { json = false } = {}) {
  const collections = await fetchCollections(config);
  if (json) {
    return JSON.stringify(collections, null, 2);
  }
  if (collections.length === 0) {
    return 'No collections yet.';
  }
  return formatCollectionsTable(collections);
}
