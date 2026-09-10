import {createCatalogHandler} from '../server/catalog/handler';
import type {CatalogRepositories} from '../server/catalog/handler';
import {createCatalogRepositories} from '../server/catalog/repositories';

let repositories: CatalogRepositories | undefined;

export const handleCatalogRequest = createCatalogHandler(() => {
    repositories ??= createCatalogRepositories();
    return repositories;
});
