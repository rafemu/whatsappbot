import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import BotStatus from '../models/BotStatus.js';
import { handleMessage } from './messageHandler.js';

let client = null;
let qrCodeData = null;
let qrTimeout = null;
let initializationTimeout = null;

export const initializeWhatsAppClient = async (io) => {
  try {
    console.log('Starting WhatsApp client initialization...');

    // Clean up existing client and timeouts
    if (client) {
      console.log('Cleaning up existing client...');
      await client.destroy();
      client = null;
    }

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

    // Create new client with optimized puppeteer options
    console.log('Creating new WhatsApp client...');
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Set initialization timeout - 2 minutes
    initializationTimeout = setTimeout(() => {
      if (client && !client.info) {
        console.log('Initialization timeout reached');
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
      console.log('QR Code received');
      try {
        // Generate QR code
        qrCodeData = await qrcode.toDataURL(qr);
        
        // Emit QR code and status update
        io.emit('qrCode', qrCodeData);
        io.emit('botStatus', { 
          active: false, 
          status: 'waiting_scan'
        });

        // Set QR timeout - 2 minutes
        if (qrTimeout) {
          clearTimeout(qrTimeout);
        }
        
        qrTimeout = setTimeout(() => {
          if (!client?.info) {
            console.log('QR Code timeout reached');
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
        console.error('Error generating QR code:', err);
        io.emit('botStatus', { 
          active: false, 
          status: 'error',
          error: 'שגיאה ביצירת קוד QR: ' + err.message 
        });
      }
    });

    client.on('ready', async () => {
      console.log('WhatsApp client is ready');
      // Clear timeouts
      if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
      }
      
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
        initializationTimeout = null;
      }

      const phoneNumber = client.info ? client.info.wid.user : null;
      console.log('Connected phone number:', phoneNumber);
      
      // Update status in database
      let status = await BotStatus.findOne();
      if (!status) {
        status = await BotStatus.create({ isActive: false });
      }
      
      status.isActive = true;
      status.connectedPhone = phoneNumber;
      status.lastConnection = new Date();
      await status.save();
      
      qrCodeData = null; // Clear QR code once connected
      
      io.emit('botStatus', { 
        active: true, 
        status: 'connected',
        connectedPhone: phoneNumber 
      });
      
      io.emit('qrCode', null); // Clear QR code from UI
    });

    client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
      qrCodeData = null; // Clear QR code once authenticated
      
      io.emit('botStatus', {
        active: false,
        status: 'authenticated'
      });
      
      io.emit('qrCode', null);
    });

    client.on('auth_failure', async (error) => {
      console.error('Authentication failed:', error);
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
    });

    client.on('disconnected', async (reason) => {
      console.log('WhatsApp client disconnected:', reason);
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

    // Register message handler
    client.on('message', async (message) => {
      try {
        console.log('Message received:', message.body);
        await handleMessage(message, client);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });

    // Initialize the client
    console.log('Calling client.initialize()...');
    await client.initialize();
    console.log('Client initialization completed');
    
    return client;
  } catch (error) {
    console.error('Error during WhatsApp client initialization:', error);
    // Clean up on error
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        console.error('Error destroying client after initialization error:', err);
      }
      client = null;
      qrCodeData = null;
    }
    
    // Clear timeouts
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
  console.log('Destroying WhatsApp client...');
  // Clear timeouts
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
  console.log('WhatsApp client destroyed');
};

export const getQRCode = () => qrCodeData;