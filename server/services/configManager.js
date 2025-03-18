import BotConfig from '../models/BotConfig.js';
import BotStatus from '../models/BotStatus.js';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class ConfigManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Wait for MongoDB connection to be ready
        if (!this.isMongoConnected()) {
          logger.info('Waiting for MongoDB connection...');
          await this.waitForMongoConnection();
        }

        this.config = await BotConfig.getConfig();
        this.initialized = true;
        logger.info('Configuration initialized successfully');
      } catch (error) {
        logger.error('Error initializing configuration:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  isMongoConnected() {
    return BotConfig.db.readyState === 1;
  }

  async waitForMongoConnection(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.isMongoConnected()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timed out waiting for MongoDB connection');
  }

  async getConfig() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.config;
  }

  async updateConfig(updates) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const config = await BotConfig.findOneAndUpdate(
        {},
        { $set: updates },
        { new: true, upsert: true }
      );
      this.config = config;
      logger.info('Configuration updated successfully');
      return config;
    } catch (error) {
      logger.error('Error updating configuration:', error);
      throw error;
    }
  }

  async validateSession() {
    try {
      const config = await this.getConfig();
      const currentSessions = await this.getCurrentSessionCount();
      
      logger.info(`Validating session - Current: ${currentSessions}, Max: ${config.maxSessions}`);
      
      return currentSessions < config.maxSessions;
    } catch (error) {
      logger.error('Error validating session:', error);
      throw error;
    }
  }

  async getCurrentSessionCount() {
    try {
      const status = await BotStatus.findOne();
      if (!status) return 0;
      return status.isActive ? 1 : 0;
    } catch (error) {
      logger.error('Error getting current session count:', error);
      return 0;
    }
  }
}

export const configManager = new ConfigManager();