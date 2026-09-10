import {createCatalogHandler} from '../server/catalog/handler';
import {createCatalogRepositories} from '../server/catalog/repositories';

export const handleCatalogRequest = createCatalogHandler(signal => createCatalogRepositories(undefined, {signal}));
