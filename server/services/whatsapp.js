import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import BotStatus from '../models/BotStatus.js';
import { handleMessage } from './messageHandler.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = null;
let qrTimeout = null;
let initializationTimeout = null;

const cleanSessionDirectory = async () => {
  try {
    const sessionDir = path.join(__dirname, '../../.wwebjs_auth/session-client');
    await fs.rm(sessionDir, { recursive: true, force: true });
    console.log('[WhatsApp] Session directory cleaned');
  } catch (error) {
    console.error('[WhatsApp] Error cleaning session directory:', error);
  }
};

export const initializeWhatsAppClient = async (io) => {
  try {
    console.log('[WhatsApp] Starting WhatsApp client initialization...');

    // Clean up existing client and timeouts
    if (client) {
      console.log('[WhatsApp] Cleaning up existing client...');
      await client.destroy();
      client = null;
    }

    // Clean session directory before initialization
    await cleanSessionDirectory();

    if (qrTimeout) {
      clearTimeout(qrTimeout);
      qrTimeout = null;
    }

    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }

    // Reset QR code data
    qrCodeData = null;

    // Update bot status
    let status = await BotStatus.findOne();
    if (status) {
      status.isActive = false;
      status.connectedPhone = null;
      status.lastDisconnection = new Date();
      await status.save();
    }

    // Create new client with optimized puppeteer options
    console.log('[WhatsApp] Creating new WhatsApp client...');
    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'client',
        dataPath: path.join(__dirname, '../../.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        timeout: 120000
      },
      qrMaxRetries: 3,
      restartOnAuthFail: true
    });

    // Set initialization timeout - 2 minutes
    initializationTimeout = setTimeout(() => {
      if (client && !client.info) {
        console.log('[WhatsApp] Initialization timeout reached');
        io.emit('botStatus', { 
          active: false, 
          status: 'error',
          error: 'תם הזמן המוקצב לאתחול הבוט. נסה להפעיל מחדש.' 
        });
        
        client.destroy().catch(console.error);
        client = null;
        qrCodeData = null;
      }
    }, 120000);

    // Event Handlers
    client.on('qr', async (qr) => {
      console.log('[WhatsApp] QR Code received');
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        io.emit('qrCode', qrCodeData);
        io.emit('botStatus', { 
          active: false, 
          status: 'waiting_scan'
        });

        if (qrTimeout) {
          clearTimeout(qrTimeout);
        }
        
        qrTimeout = setTimeout(() => {
          if (!client?.info) {
            console.log('[WhatsApp] QR Code timeout reached');
            io.emit('botStatus', { 
              active: false, 
              status: 'error',
              error: 'קוד ה-QR פג תוקף. נסה להפעיל מחדש את הבוט.' 
            });
            
            qrCodeData = null;
            io.emit('qrCode', null);
          }
        }, 120000);
      } catch (err) {
        console.error('[WhatsApp] Error generating QR code:', err);
        io.emit('botStatus', { 
          active: false, 
          status: 'error',
          error: 'שגיאה ביצירת קוד QR: ' + err.message 
        });
      }
    });

    client.on('ready', async () => {
      console.log('[WhatsApp] Client is ready');
      if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
      }
      
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
        initializationTimeout = null;
      }

      const phoneNumber = client.info ? client.info.wid.user : null;
      console.log('[WhatsApp] Connected phone number:', phoneNumber);
      
      let status = await BotStatus.findOne();
      if (!status) {
        status = await BotStatus.create({ isActive: false });
      }
      
      status.isActive = true;
      status.connectedPhone = phoneNumber;
      status.lastConnection = new Date();
      await status.save();
      
      qrCodeData = null;
      
      io.emit('botStatus', { 
        active: true, 
        status: 'connected',
        connectedPhone: phoneNumber 
      });
      
      io.emit('qrCode', null);
    });

    client.on('authenticated', () => {
      console.log('[WhatsApp] Client authenticated');
      qrCodeData = null;
      
      io.emit('botStatus', {
        active: false,
        status: 'authenticated'
      });
      
      io.emit('qrCode', null);
    });

    client.on('auth_failure', async (error) => {
      console.error('[WhatsApp] Authentication failed:', error);
      let status = await BotStatus.findOne();
      if (status) {
        status.isActive = false;
        status.connectedPhone = null;
        status.lastDisconnection = new Date();
        await status.save();
      }
      
      io.emit('botStatus', { 
        active: false, 
        status: 'error',
        error: 'אימות נכשל: ' + (error.message || 'שגיאה לא ידועה')
      });
      
      client = null;
      qrCodeData = null;
      io.emit('qrCode', null);

      // Clean session on auth failure
      await cleanSessionDirectory();
    });

    client.on('disconnected', async (reason) => {
      console.error('[WhatsApp] Client disconnected:', reason);
      let status = await BotStatus.findOne();
      if (status) {
        status.isActive = false;
        status.connectedPhone = null;
        status.lastDisconnection = new Date();
        await status.save();
      }
      
      io.emit('botStatus', { 
        active: false, 
        status: 'disconnected',
        error: 'הבוט התנתק: ' + (reason || 'סיבה לא ידועה')
      });
      
      client = null;
      qrCodeData = null;
      io.emit('qrCode', null);
    });

    client.on('message', async (message) => {
      try {
        console.log('[WhatsApp] Message received:', {
          from: message.from,
          body: message.body,
          hasMedia: message.hasMedia,
          timestamp: new Date().toISOString()
        });

        if (!client?.info) {
          console.error('[WhatsApp] Client not ready, cannot handle message');
          return;
        }

        await handleMessage(message, client);
        console.log('[WhatsApp] Message handled successfully');
      } catch (error) {
        console.error('[WhatsApp] Error in message handler:', error);
        try {
          await client.sendMessage(
            message.from, 
            'אירעה שגיאה בעיבוד ההודעה. אנא נסה שוב מאוחר יותר.'
          );
        } catch (sendError) {
          console.error('[WhatsApp] Error sending error message:', sendError);
        }
      }
    });

    console.log('[WhatsApp] Calling client.initialize()...');
    await client.initialize();
    console.log('[WhatsApp] Client initialization completed');
    
    return client;
  } catch (error) {
    console.error('[WhatsApp] Error during client initialization:', error);
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        console.error('[WhatsApp] Error destroying client after initialization error:', err);
      }
      client = null;
      qrCodeData = null;
    }
    
    if (qrTimeout) {
      clearTimeout(qrTimeout);
      qrTimeout = null;
    }
    
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }
    
    io.emit('botStatus', {
      active: false,
      status: 'error',
      error: 'שגיאה באתחול הבוט: ' + error.message
    });
    
    io.emit('qrCode', null);
    
    throw error;
  }
};

export const getWhatsAppClient = () => client;

export const destroyWhatsAppClient = async () => {
  console.log('[WhatsApp] Destroying WhatsApp client...');
  if (qrTimeout) {
    clearTimeout(qrTimeout);
    qrTimeout = null;
  }
  
  if (initializationTimeout) {
    clearTimeout(initializationTimeout);
    initializationTimeout = null;
  }
  
  if (client) {
    await client.destroy();
    client = null;
    qrCodeData = null;
  }

  // Clean session directory
  await cleanSessionDirectory();
  
  console.log('[WhatsApp] Client destroyed');
};

export const getQRCode = () => qrCodeData;
// import pkg from 'whatsapp-web.js';
// const { Client, LocalAuth } = pkg;
// import qrcode from 'qrcode';
// import BotStatus from '../models/BotStatus.js';
// import { handleMessage } from './messageHandler.js';
// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// let client = null;
// let qrCodeData = null;
// let qrTimeout = null;
// let initializationTimeout = null;

// const cleanSessionDirectory = async () => {
//   try {
//     const sessionDir = path.join(__dirname, '../../.wwebjs_auth/session-client');
//     await fs.rm(sessionDir, { recursive: true, force: true });
//     console.log('[WhatsApp] Session directory cleaned');
//   } catch (error) {
//     console.error('[WhatsApp] Error cleaning session directory:', error);
//   }
// };

// export const initializeWhatsAppClient = async (io) => {
//   try {
//     console.log('[WhatsApp] Starting WhatsApp client initialization...');

//     // Clean up existing client and timeouts
//     if (client) {
//       console.log('[WhatsApp] Cleaning up existing client...');
//       await client.destroy();
//       client = null;
//     }

//     if (qrTimeout) {
//       clearTimeout(qrTimeout);
//       qrTimeout = null;
//     }

//     if (initializationTimeout) {
//       clearTimeout(initializationTimeout);
//       initializationTimeout = null;
//     }

//     // Reset QR code data
//     qrCodeData = null;

//     // Create new client with optimized puppeteer options
//     console.log('[WhatsApp] Creating new WhatsApp client...');
//     client = new Client({
//       authStrategy: new LocalAuth({
//         clientId: 'client',
//         dataPath: path.join(__dirname, '../../.wwebjs_auth')
//       }),
//       puppeteer: {
//         headless: true,
//         args: [
//           '--no-sandbox',
//           '--disable-setuid-sandbox',
//           '--disable-dev-shm-usage',
//           '--disable-accelerated-2d-canvas',
//           '--no-first-run',
//           '--no-zygote',
//           '--single-process',
//           '--disable-gpu',
//           '--disable-web-security',
//           '--disable-features=IsolateOrigins,site-per-process'
//         ],
//         timeout: 120000
//       },
//       qrMaxRetries: 3,
//       restartOnAuthFail: true
//     });

//     // Set initialization timeout - 2 minutes
//     initializationTimeout = setTimeout(() => {
//       if (client && !client.info) {
//         console.log('[WhatsApp] Initialization timeout reached');
//         io.emit('botStatus', { 
//           active: false, 
//           status: 'error',
//           error: 'תם הזמן המוקצב לאתחול הבוט. נסה להפעיל מחדש.' 
//         });
        
//         client.destroy().catch(console.error);
//         client = null;
//         qrCodeData = null;
//       }
//     }, 120000);

//     // Event Handlers
//     client.on('qr', async (qr) => {
//       console.log('[WhatsApp] QR Code received');
//       try {
//         qrCodeData = await qrcode.toDataURL(qr);
//         io.emit('qrCode', qrCodeData);
//         io.emit('botStatus', { 
//           active: false, 
//           status: 'waiting_scan'
//         });

//         if (qrTimeout) {
//           clearTimeout(qrTimeout);
//         }
        
//         qrTimeout = setTimeout(() => {
//           if (!client?.info) {
//             console.log('[WhatsApp] QR Code timeout reached');
//             io.emit('botStatus', { 
//               active: false, 
//               status: 'error',
//               error: 'קוד ה-QR פג תוקף. נסה להפעיל מחדש את הבוט.' 
//             });
            
//             qrCodeData = null;
//             io.emit('qrCode', null);
//           }
//         }, 120000);
//       } catch (err) {
//         console.error('[WhatsApp] Error generating QR code:', err);
//         io.emit('botStatus', { 
//           active: false, 
//           status: 'error',
//           error: 'שגיאה ביצירת קוד QR: ' + err.message 
//         });
//       }
//     });

//     client.on('ready', async () => {
//       console.log('[WhatsApp] Client is ready');
//       if (qrTimeout) {
//         clearTimeout(qrTimeout);
//         qrTimeout = null;
//       }
      
//       if (initializationTimeout) {
//         clearTimeout(initializationTimeout);
//         initializationTimeout = null;
//       }

//       const phoneNumber = client.info ? client.info.wid.user : null;
//       console.log('[WhatsApp] Connected phone number:', phoneNumber);
      
//       let status = await BotStatus.findOne();
//       if (!status) {
//         status = await BotStatus.create({ isActive: false });
//       }
      
//       status.isActive = true;
//       status.connectedPhone = phoneNumber;
//       status.lastConnection = new Date();
//       await status.save();
      
//       qrCodeData = null;
      
//       io.emit('botStatus', { 
//         active: true, 
//         status: 'connected',
//         connectedPhone: phoneNumber 
//       });
      
//       io.emit('qrCode', null);
//     });

//     client.on('authenticated', () => {
//       console.log('[WhatsApp] Client authenticated');
//       qrCodeData = null;
      
//       io.emit('botStatus', {
//         active: false,
//         status: 'authenticated'
//       });
      
//       io.emit('qrCode', null);
//     });

//     client.on('auth_failure', async (error) => {
//       console.error('[WhatsApp] Authentication failed:', error);
//       let status = await BotStatus.findOne();
//       if (status) {
//         status.isActive = false;
//         status.connectedPhone = null;
//         status.lastDisconnection = new Date();
//         await status.save();
//       }
      
//       io.emit('botStatus', { 
//         active: false, 
//         status: 'error',
//         error: 'אימות נכשל: ' + (error.message || 'שגיאה לא ידועה')
//       });
      
//       client = null;
//       qrCodeData = null;
//       io.emit('qrCode', null);

//       // Clean session on auth failure
//       await cleanSessionDirectory();
//     });

//     client.on('disconnected', async (reason) => {
//       console.error('[WhatsApp] Client disconnected:', reason);
//       let status = await BotStatus.findOne();
//       if (status) {
//         status.isActive = false;
//         status.connectedPhone = null;
//         status.lastDisconnection = new Date();
//         await status.save();
//       }
      
//       io.emit('botStatus', { 
//         active: false, 
//         status: 'disconnected',
//         error: 'הבוט התנתק: ' + (reason || 'סיבה לא ידועה')
//       });
      
//       client = null;
//       qrCodeData = null;
//       io.emit('qrCode', null);
//     });

//     client.on('message', async (message) => {
//       try {
//         console.log('[WhatsApp] Message received:', {
//           from: message.from,
//           body: message.body,
//           hasMedia: message.hasMedia,
//           timestamp: new Date().toISOString()
//         });

//         if (!client?.info) {
//           console.error('[WhatsApp] Client not ready, cannot handle message');
//           return;
//         }

//         await handleMessage(message, client);
//         console.log('[WhatsApp] Message handled successfully');
//       } catch (error) {
//         console.error('[WhatsApp] Error in message handler:', error);
//         try {
//           await client.sendMessage(
//             message.from, 
//             'אירעה שגיאה בעיבוד ההודעה. אנא נסה שוב מאוחר יותר.'
//           );
//         } catch (sendError) {
//           console.error('[WhatsApp] Error sending error message:', sendError);
//         }
//       }
//     });

//     console.log('[WhatsApp] Calling client.initialize()...');
//     await client.initialize();
//     console.log('[WhatsApp] Client initialization completed');
    
//     return client;
//   } catch (error) {
//     console.error('[WhatsApp] Error during client initialization:', error);
//     if (client) {
//       try {
//         await client.destroy();
//       } catch (err) {
//         console.error('[WhatsApp] Error destroying client after initialization error:', err);
//       }
//       client = null;
//       qrCodeData = null;
//     }
    
//     if (qrTimeout) {
//       clearTimeout(qrTimeout);
//       qrTimeout = null;
//     }
    
//     if (initializationTimeout) {
//       clearTimeout(initializationTimeout);
//       initializationTimeout = null;
//     }
    
//     io.emit('botStatus', {
//       active: false,
//       status: 'error',
//       error: 'שגיאה באתחול הבוט: ' + error.message
//     });
    
//     io.emit('qrCode', null);
    
//     throw error;
//   }
// };

// export const getWhatsAppClient = () => client;

// export const destroyWhatsAppClient = async () => {
//   console.log('[WhatsApp] Destroying WhatsApp client...');
//   if (qrTimeout) {
//     clearTimeout(qrTimeout);
//     qrTimeout = null;
//   }
  
//   if (initializationTimeout) {
//     clearTimeout(initializationTimeout);
//     initializationTimeout = null;
//   }
  
//   if (client) {
//     await client.destroy();
//     client = null;
//     qrCodeData = null;
//   }
  
//   console.log('[WhatsApp] Client destroyed');
// };

// export const getQRCode = () => qrCodeData;