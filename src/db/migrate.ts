import { runMigrations } from './index.js';
import { logger } from '../lib/logger.js';

runMigrations();
logger.info('All migrations complete.');
