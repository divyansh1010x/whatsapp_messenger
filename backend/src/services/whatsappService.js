const { Client, LocalAuth } = require("whatsapp-web.js");

let client;
let isReady = false;
let latestQR = null; // Store latest QR as base64 for frontend
let isInitializing = false; // Prevent multiple simultaneous initializations

const getStatus = async () => {
    if (!client) {
        return { loggedIn: false, qr: null, message: "Client not initialized yet" };
    }

    if (isReady) {
        return { loggedIn: true, message: "WhatsApp is ready!" };
    }

    return {
        loggedIn: false,
        qr: latestQR,
        message: latestQR ? "Scan the QR code with WhatsApp" : "Waiting for WhatsApp client...",
    };
};

const initializeClient = async () => {
    // Prevent multiple simultaneous initializations
    if (isInitializing) {
        console.log("⚠️ Client initialization already in progress, waiting...");
        // Wait for existing initialization to complete
        while (isInitializing) {
            await new Promise(r => setTimeout(r, 1000));
        }
        return client;
    }
    
    // Prevent multiple initializations
    if (client) {
        console.log("⚠️ Client already exists, returning existing client");
        return client;
    }
    
    // If client was destroyed due to LOGOUT, we need to create a new one
    console.log("🔄 Creating new WhatsApp client instance...");
    isInitializing = true;

    client = new Client({
      authStrategy: new LocalAuth({ clientId: "main" }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-web-security",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection"
        ],
        // Timeout settings for cloud environments
        timeout: 60000,
        // Ignore HTTPS errors (sometimes needed for cloud)
        ignoreHTTPSErrors: true
      },
      webVersionCache: {
        type: "local"
      },
      messageRingtonePath: null,
      restartOnCrash: true,
      skipBrokenMethodsCheck: true,
      // Disable automatic seen marking to avoid markedUnread error
      autoMarkAsReadOnMessage: false,
      // Use default browser without extra features
      defaultLanguage: "en"
    });


    client.on("qr", async (qr) => {
        const QRCode = require("qrcode");
        latestQR = await QRCode.toDataURL(qr); // Convert to base64 image string
        console.log("📲 New QR code generated for frontend.");
    });

    client.on("authenticated", () => {
        console.log("✅ WhatsApp authenticated. Session saved.");
        latestQR = null;
    });

    client.on("ready", async () => {
        console.log("🚀 WhatsApp client ready.");
        
        // Wait for CONNECTED state - it might take a moment after "ready" event
        const waitForConnected = async () => {
            const maxAttempts = 30; // 30 attempts = 30 seconds max
            const delayMs = 1000; // Check every second
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const state = await client.getState();
                    console.log(`📊 Client state (attempt ${attempt}/${maxAttempts}): ${state}`);
                    
                    if (state === 'CONNECTED') {
                        console.log(`✅ Client is now CONNECTED!`);
                        isReady = true;
                        latestQR = null;
                        return;
                    } else if (state === 'OPENING') {
                        console.log(`⏳ Still opening... waiting for CONNECTED state...`);
                        // Wait before next check
                        await new Promise(r => setTimeout(r, delayMs));
                    } else {
                        console.warn(`⚠️ Unexpected state: ${state}, waiting...`);
                        await new Promise(r => setTimeout(r, delayMs));
                    }
                } catch (error) {
                    console.error(`Error checking state (attempt ${attempt}):`, error.message);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
            
            // If we get here, we timed out waiting for CONNECTED
            console.error("❌ Timeout waiting for CONNECTED state. Client may not be fully ready.");
            // Still set as ready to allow attempts, but log warning
            isReady = true;
            latestQR = null;
        };
        
        await waitForConnected();
    });

    client.on("disconnected", (reason) => {
        console.error(`❌ WhatsApp disconnected: ${reason}`);
        isReady = false;
        latestQR = null;
        
        // Handle different disconnect reasons
        if (reason === 'LOGOUT') {
            console.error("🚨 WhatsApp logged out the session. This usually means:");
            console.error("   - Multiple sessions detected on the same account");
            console.error("   - Session was logged out from another device");
            console.error("   - WhatsApp detected suspicious activity");
            console.error("   - You may have WhatsApp Web open in another browser/tab");
            console.error("   You will need to scan QR code again to reconnect.");
            // Don't auto-reconnect on LOGOUT - require manual re-auth
            // Destroy the client to allow fresh initialization
            if (client) {
                try {
                    client.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
            }
            client = null;
            isInitializing = false; // Allow re-initialization
        } else if (reason === 'NAVIGATION') {
            console.log("⚠️ Navigation disconnect - attempting to reconnect...");
            setTimeout(() => {
                if (client) {
                    client.initialize().catch(err => {
                        console.error("Failed to reconnect:", err);
                    });
                }
            }, 5000);
        } else {
            console.log(`⚠️ Disconnect reason: ${reason} - will require manual reconnection`);
        }
    });

    client.on("auth_failure", (msg) => {
        console.error("❌ WhatsApp authentication failed:", msg);
        isReady = false;
        latestQR = null;
    });

    // Listen for state changes as backup
    // Note: whatsapp-web.js doesn't have a direct state change event,
    // but we can check periodically or rely on the ready event polling
    
    try {
        await client.initialize();
        isInitializing = false;
        return client;
    } catch (error) {
        isInitializing = false;
        console.error("❌ Failed to initialize client:", error);
        client = null;
        throw error;
    }
};

const sendMessage = async (contacts) => {
    if (!client) {
        throw new Error("WhatsApp client not initialized");
    }

    if (!isReady) {
        throw new Error("WhatsApp client not ready");
    }

    // Verify client is actually connected with timeout
    let clientState = 'UNKNOWN';
    try {
        clientState = await Promise.race([
            client.getState(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("State check timeout")), 5000)
            )
        ]);
        console.log(`📊 Current client state: ${clientState}`);
        if (clientState !== 'CONNECTED') {
            console.warn(`⚠️ Client state is ${clientState}, not CONNECTED. Attempting to send anyway...`);
        }
    } catch (stateError) {
        console.error("❌ Error checking client state:", stateError.message);
        console.warn("⚠️ Proceeding despite state check failure...");
    }

    // If we get multiple timeouts, mark client as not ready
    let consecutiveTimeouts = 0;

    const successList = [];
    const failedList = [];

    for (const contact of contacts) {
        const chatId = `${contact.number}@c.us`;
        console.log(`📤 Attempting to send to ${contact.number}...`);

        try {
            // Get or create chat first to avoid markedUnread errors
            let chat;
            try {
                chat = await Promise.race([
                    client.getChatById(chatId),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Chat lookup timeout")), 10000))
                ]);
                console.log(`✅ Chat found for ${contact.number}`);
            } catch (chatError) {
                // Chat doesn't exist yet - it will be created when we send
                console.log(`ℹ️ Chat doesn't exist yet for ${contact.number}, will be created on send`);
                chat = null;
            }

            // Send message - patch sendSeen to prevent markedUnread error
            let result;
            try {
                // Get the page and patch sendSeen function before sending
                const page = client.pupPage;
                
                // Patch the sendSeen function to catch markedUnread errors
                await page.evaluate(() => {
                    if (window.WWebJS && window.WWebJS.sendSeen) {
                        const originalSendSeen = window.WWebJS.sendSeen;
                        window.WWebJS.sendSeen = async function(chatId) {
                            try {
                                return await originalSendSeen.call(this, chatId);
                            } catch (error) {
                                // Ignore markedUnread errors
                                if (error.message && error.message.includes('markedUnread')) {
                                    console.log('Ignored markedUnread error in sendSeen');
                                    return; // Return successfully even if error
                                }
                                throw error; // Re-throw other errors
                            }
                        };
                    }
                });
                
                // Now send the message
                result = await Promise.race([
                    client.sendMessage(chatId, contact.message),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Send timeout after 30 seconds")), 30000)
                    )
                ]);
                
                // Success - message sent
                if (result && result.id) {
                    const messageId = result.id.id || result.id._serialized || result.id || 'unknown';
                    console.log(`✅ Successfully sent to ${contact.number} (Message ID: ${messageId})`);
                    successList.push({ number: contact.number });
                } else {
                    console.log(`✅ Message sent to ${contact.number} (no ID returned but no error)`);
                    successList.push({ number: contact.number });
                }
                
            } catch (sendError) {
                const errorStr = String(sendError);
                const errorMsg = sendError.message || errorStr;
                
                // Even with patching, markedUnread might still occur
                if (errorStr.includes('markedUnread') || errorStr.includes('sendSeen')) {
                    console.log(`⚠️ markedUnread error occurred - checking if message was sent anyway...`);
                    
                    // Wait and verify
                    await new Promise(r => setTimeout(r, 3000));
                    
                    try {
                        const verifyChat = await client.getChatById(chatId);
                        const messages = await verifyChat.fetchMessages({ limit: 5 });
                        const found = messages.find(m => m.fromMe && (m.body === contact.message || contact.message.includes(m.body)));
                        
                        if (found) {
                            console.log(`✅ Message verified as sent despite markedUnread error`);
                            successList.push({ number: contact.number });
                        } else {
                            console.error(`❌ markedUnread error and message NOT found - send failed`);
                            throw sendError; // Re-throw to trigger retry
                        }
                    } catch (verifyError) {
                        console.error(`❌ Could not verify: ${verifyError.message}`);
                        throw sendError; // Re-throw to trigger retry
                    }
                } else {
                    throw sendError;
                }
            }

        } catch (error) {
            const errorMsg = error.message || String(error);
            const errorString = String(error);
            
            // Handle markedUnread error specifically - retry with different approach
            if (errorMsg.includes('markedUnread') || errorString.includes('markedUnread')) {
                console.error(`❌ markedUnread error for ${contact.number} - retrying with alternative method...`);
                try {
                    // Wait a moment before retry
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // Try sending using the page directly to bypass markedUnread
                    // Use a simpler approach - just retry with client.sendMessage
                    console.log(`🔄 Retry attempt 1: Using client.sendMessage...`);
                    const retryResult = await Promise.race([
                        client.sendMessage(chatId, contact.message),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Retry timeout")), 30000)
                        )
                    ]);
                    
                    if (retryResult && retryResult.id) {
                        const messageId = retryResult.id.id || retryResult.id._serialized || retryResult.id || 'unknown';
                        console.log(`✅ Successfully sent to ${contact.number} on retry (Message ID: ${messageId})`);
                        successList.push({ number: contact.number });
                    } else {
                        // Verify by checking chat
                        await new Promise(r => setTimeout(r, 2000));
                        try {
                            const verifyChat = await client.getChatById(chatId);
                            const messages = await verifyChat.fetchMessages({ limit: 5 });
                            const found = messages.find(m => m.fromMe && (m.body === contact.message || contact.message.includes(m.body)));
                            if (found) {
                                console.log(`✅ Verified message sent on retry to ${contact.number}`);
                                successList.push({ number: contact.number });
                            } else {
                                throw new Error("Message not found after retry");
                            }
                        } catch {
                            console.error(`❌ Could not verify retry send for ${contact.number}`);
                            throw new Error("Retry failed - message not verified");
                        }
                    }
                } catch (retryError) {
                    const retryErrorMsg = retryError.message || String(retryError);
                    console.error(`❌ Retry failed for ${contact.number}: ${retryErrorMsg}`);
                    failedList.push({ number: contact.number, error: `markedUnread error - retry failed: ${retryErrorMsg}` });
                }
            } else if (errorMsg.includes('timeout')) {
                consecutiveTimeouts++;
                console.error(`⚠️ Timeout #${consecutiveTimeouts} - client may be disconnected. Current state: ${clientState}, ready: ${isReady}`);
                
                // If we get 2+ consecutive timeouts, mark client as not ready
                if (consecutiveTimeouts >= 2) {
                    console.error("🚨 Multiple timeouts detected. Marking client as not ready.");
                    isReady = false;
                }
                failedList.push({ number: contact.number, error: errorMsg });
            } else {
                consecutiveTimeouts = 0; // Reset on non-timeout errors
                console.error(`❌ Failed to send to ${contact.number}: ${errorMsg}`);
                failedList.push({ number: contact.number, error: errorMsg });
            }
        }

        // Delay to avoid rate limiting (increased to 2 seconds)
        if (contacts.indexOf(contact) < contacts.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
