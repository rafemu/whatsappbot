import mongoose from 'mongoose';

const botConfigSchema = new mongoose.Schema({
  maxSessions: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  autoRestart: {
    enabled: {
      type: Boolean,
      default: true
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    delayBetweenAttempts: {
      type: Number,
      default: 60000 // 1 minute in milliseconds
    }
  },
  survey: {
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    allowContinuation: {
      type: Boolean,
      default: true
    },
    followUp: {
      enabled: {
        type: Boolean,
        default: true
      },
      timing: {
        type: Number,
        default: 24,
        min: 1,
        max: 72
      },
      maxAttempts: {
        type: Number,
        default: 3
      },
      webhook: {
        url: String,
        enabled: {
          type: Boolean,
          default: false
        },
        customHeaders: {
          type: Map,
          of: String
        }
      }
    }
  },
  callMonitoring: {
    enabled: {
      type: Boolean,
      default: true
    },
    webhook: {
      url: String,
      enabled: {
        type: Boolean,
        default: false
      },
      customHeaders: {
        type: Map,
        of: String
      }
    },
    notifications: {
      email: {
        enabled: {
          type: Boolean,
          default: false
        },
        recipients: [String]
      }
    }
  },
  dataRetention: {
    surveyResponses: {
      type: Number,
      default: 90, // days
      min: 1
    },
    callLogs: {
      type: Number,
      default: 30, // days
      min: 1
    }
  },
  rateLimiting: {
    enabled: {
      type: Boolean,
      default: true
    },
    maxRequestsPerMinute: {
      type: Number,
      default: 60
    },
    blockDuration: {
      type: Number,
      default: 300 // 5 minutes in seconds
    }
  }
}, {
  timestamps: true
});

// Ensure single config instance
botConfigSchema.statics.getConfig = async function() {
  const config = await this.findOne();
  if (config) return config;
  
  return await this.create({});
};

export default mongoose.model('BotConfig', botConfigSchema);