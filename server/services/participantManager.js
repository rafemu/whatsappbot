import ParticipantStatus from '../models/ParticipantStatus.js';
import { configManager } from './configManager.js';
import winston from 'winston';
import axios from 'axios';
import { addHours } from 'date-fns';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'participant-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'participant.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class ParticipantManager {
  async getOrCreateParticipant(phoneNumber) {
    try {
      let participant = await ParticipantStatus.findOne({ phoneNumber });
      
      if (!participant) {
        participant = await ParticipantStatus.create({
          phoneNumber,
          surveyStatus: 'not_started'
        });
        logger.info(`New participant created: ${phoneNumber}`);
      }
      
      return participant;
    } catch (error) {
      logger.error(`Error getting/creating participant ${phoneNumber}:`, error);
      throw error;
    }
  }

  async canStartSurvey(phoneNumber) {
    try {
      const participant = await this.getOrCreateParticipant(phoneNumber);
      const config = await configManager.getConfig();

      if (participant.surveyStatus === 'complete' && !config.survey.allowMultipleAttempts) {
        return {
          allowed: false,
          message: "You've already completed our survey. Thank you!"
        };
      }

      if (participant.surveyStatus === 'incomplete' && config.survey.allowContinuation) {
        return {
          allowed: true,
          continuation: true,
          lastQuestionId: participant.survey.lastQuestionId
        };
      }

      return {
        allowed: true,
        continuation: false
      };
    } catch (error) {
      logger.error(`Error checking survey start eligibility for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async recordCallAttempt(phoneNumber, duration = 0) {
    try {
      const participant = await this.getOrCreateParticipant(phoneNumber);
      const config = await configManager.getConfig();

      participant.callAttempts.count += 1;
      participant.callAttempts.lastAttempt = new Date();
      participant.callAttempts.history.push({
        timestamp: new Date(),
        duration
      });

      await participant.save();

      if (config.callMonitoring.enabled && config.callMonitoring.webhook.enabled) {
        await this.notifyCallWebhook(participant);
      }

      return participant;
    } catch (error) {
      logger.error(`Error recording call attempt for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async scheduleFollowUp(phoneNumber) {
    try {
      const participant = await this.getOrCreateParticipant(phoneNumber);
      const config = await configManager.getConfig();

      if (!config.survey.followUp.enabled) return;

      const nextAttempt = addHours(new Date(), config.survey.followUp.timing);
      
      participant.followUpStatus = {
        ...participant.followUpStatus,
        nextScheduled: nextAttempt,
        status: 'pending'
      };

      await participant.save();
      logger.info(`Follow-up scheduled for ${phoneNumber} at ${nextAttempt}`);
    } catch (error) {
      logger.error(`Error scheduling follow-up for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async processFollowUps() {
    try {
      const config = await configManager.getConfig();
      if (!config.survey.followUp.enabled) return;

      const pendingFollowUps = await ParticipantStatus.find({
        'followUpStatus.status': 'pending',
        'followUpStatus.nextScheduled': { $lte: new Date() },
        'followUpStatus.attempts': { $lt: config.survey.followUp.maxAttempts }
      });

      for (const participant of pendingFollowUps) {
        await this.executeFollowUp(participant);
      }
    } catch (error) {
      logger.error('Error processing follow-ups:', error);
      throw error;
    }
  }

  async executeFollowUp(participant) {
    try {
      const config = await configManager.getConfig();

      participant.followUpStatus.attempts += 1;
      participant.followUpStatus.lastAttempt = new Date();

      if (config.survey.followUp.webhook.enabled) {
        await this.notifyFollowUpWebhook(participant);
      }

      // Schedule next attempt if needed
      if (participant.followUpStatus.attempts < config.survey.followUp.maxAttempts) {
        participant.followUpStatus.nextScheduled = addHours(
          new Date(),
          config.survey.followUp.timing
        );
        participant.followUpStatus.status = 'pending';
      } else {
        participant.followUpStatus.status = 'completed';
      }

      await participant.save();
    } catch (error) {
      logger.error(`Error executing follow-up for ${participant.phoneNumber}:`, error);
      throw error;
    }
  }

  async notifyCallWebhook(participant) {
    try {
      const config = await configManager.getConfig();
      if (!config.callMonitoring.webhook.enabled) return;

      // Replace {phone} in URL with actual phone number
      const url = config.callMonitoring.webhook.url.replace(
        '{phone}',
        participant.phoneNumber.replace('@c.us', '')
      );

      await axios.post(
        url,
        participant.formatForAPI(),
        {
          headers: Object.fromEntries(config.callMonitoring.webhook.customHeaders || [])
        }
      );
    } catch (error) {
      logger.error(`Error notifying call webhook for ${participant.phoneNumber}:`, error);
    }
  }

  async notifyFollowUpWebhook(participant) {
    try {
      const config = await configManager.getConfig();
      if (!config.survey.followUp.webhook.enabled) return;

      // Replace {phone} in URL with actual phone number
      const url = config.survey.followUp.webhook.url.replace(
        '{phone}',
        participant.phoneNumber.replace('@c.us', '')
      );

      await axios.post(
        url,
        participant.formatForAPI(),
        {
          headers: Object.fromEntries(config.survey.followUp.webhook.customHeaders || [])
        }
      );
    } catch (error) {
      logger.error(`Error notifying follow-up webhook for ${participant.phoneNumber}:`, error);
    }
  }
}

export const participantManager = new ParticipantManager();