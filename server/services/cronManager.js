import cron from 'node-cron';
import { participantManager } from './participantManager.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'cron-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'cron.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class CronManager {
  constructor() {
    this.jobs = new Map();
  }

  initialize() {
    this.setupFollowUpJob();
    logger.info('Cron jobs initialized');
  }

  setupFollowUpJob() {
    // Run every 15 minutes
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('Starting follow-up processing');
        await participantManager.processFollowUps();
        logger.info('Follow-up processing completed');
      } catch (error) {
        logger.error('Error in follow-up cron job:', error);
      }
    });

    this.jobs.set('followUp', job);
  }

  stopAll() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    }
    this.jobs.clear();
  }
}

export const cronManager = new CronManager();