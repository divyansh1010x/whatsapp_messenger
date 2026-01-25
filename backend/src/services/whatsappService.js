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

            // Send message - record timestamp BEFORE sending to verify new messages
            let result;
            const sendTimeout = 20000; // 20 seconds
            const sendStartTime = Date.now(); // Record when we START sending
            
            // Get messages before sending to compare later
            let messagesBefore = [];
            try {
                const chatBefore = await client.getChatById(chatId);
                messagesBefore = await chatBefore.fetchMessages({ limit: 5 });
            } catch (e) {
                // Ignore if we can't get messages before
            }
            
            try {
                // Try page method first to avoid markedUnread error entirely
                let sendPromise;
                const page = client.pupPage;
                
                if (page) {
                    console.log(`📤 Sending via page.evaluate (direct method)...`);
                    sendPromise = page.evaluate(async (chatId, messageText) => {
                        const chat = await window.Store.Chat.get(chatId);
                        if (!chat) {
                            throw new Error("Chat not found");
                        }
                        // Send message directly using WhatsApp Web's internal API
                        // This bypasses the library's sendMessage and sendSeen functions
                        const message = await window.Store.sendMessage(chat, messageText);
                        return {
                            id: message.id,
                            body: message.body
                        };
                    }, chatId, contact.message);
                } else {
                    // Fallback to library method if page not available
                    if (chat) {
                        console.log(`📤 Sending via chat.sendMessage (fallback)...`);
                        sendPromise = chat.sendMessage(contact.message);
                    } else {
                        console.log(`📤 Sending via client.sendMessage (fallback)...`);
                        sendPromise = client.sendMessage(chatId, contact.message);
                    }
                }
                
                // Race between send and timeout
                result = await Promise.race([
                    sendPromise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Send timeout after ${sendTimeout/1000} seconds`)), sendTimeout)
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
                
                // Handle timeout specifically
                if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
                    console.error(`⏱️ Send timeout for ${contact.number} - message may still be sending`);
                    // Wait a bit and check if message was sent despite timeout
                    await new Promise(r => setTimeout(r, 3000));
                    
                    try {
                        const beforeTimeout = Date.now();
                        const verifyChat = await client.getChatById(chatId);
                        const messages = await verifyChat.fetchMessages({ limit: 10 });
                        
                        // Find message with exact match and recent timestamp
                        const found = messages.find(m => {
                            if (!m.fromMe) return false;
                            if (m.body !== contact.message) return false; // EXACT match
                            
                            const messageTime = m.timestamp * 1000;
                            const timeDiff = beforeTimeout - messageTime;
                            return timeDiff < 25000 && timeDiff > -5000; // Within 25 seconds (timeout + buffer)
                        });
                        
                        if (found) {
                            const messageId = found.id.id || found.id._serialized || found.id || 'unknown';
                            console.log(`✅ Message found after timeout - send succeeded (Message ID: ${messageId})`);
                            successList.push({ number: contact.number });
                        } else {
                            console.error(`❌ Timeout and NEW message not found`);
                            console.error(`   Looking for: "${contact.message}"`);
                            throw new Error("Timeout and message not found");
                        }
                    } catch (verifyError) {
                        console.error(`❌ Timeout and could not verify: ${verifyError.message}`);
                        throw sendError; // Re-throw to trigger retry
                    }
                } else if (errorStr.includes('markedUnread') || errorStr.includes('sendSeen')) {
                    // markedUnread error means the send likely FAILED
                    // Don't try to verify - just retry immediately with a workaround
                    console.error(`❌ markedUnread error - message likely NOT sent. Retrying with workaround...`);
                    throw sendError; // Re-throw to trigger retry in outer catch
                } else {
                    throw sendError;
                }
            }

        } catch (error) {
            const errorMsg = error.message || String(error);
            const errorString = String(error);
            
            // Handle markedUnread error specifically - use page directly to bypass library bug
            if (errorMsg.includes('markedUnread') || errorString.includes('markedUnread')) {
                console.error(`❌ markedUnread error for ${contact.number} - trying direct page method...`);
                try {
                    // Wait a moment before retry
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // Use page.evaluate to send directly, bypassing the library's sendMessage
                    const page = client.pupPage;
                    if (!page) {
                        throw new Error("Cannot access page for direct send");
                    }
                    
                    console.log(`🔄 Retry: Using page.evaluate to send directly (bypassing markedUnread)...`);
                    
                    // Send using WhatsApp Web's internal API directly
                    const pageResult = await page.evaluate(async (chatId, messageText) => {
                        const chat = await window.Store.Chat.get(chatId);
                        if (!chat) {
                            throw new Error("Chat not found");
                        }
                        // Send message directly - this bypasses sendSeen
                        const message = await window.Store.sendMessage(chat, messageText);
                        return {
                            id: message.id,
                            body: message.body
                        };
                    }, chatId, contact.message);
                    
                    if (pageResult && pageResult.id) {
                        console.log(`✅ Successfully sent via page method to ${contact.number}`);
                        successList.push({ number: contact.number });
                    } else {
                        // Verify by checking for new message
                        await new Promise(r => setTimeout(r, 3000));
                        const verifyChat = await client.getChatById(chatId);
                        const messagesAfter = await verifyChat.fetchMessages({ limit: 5 });
                        const messageIdsBefore = new Set(messagesBefore.map(m => m.id._serialized || m.id.id || String(m.id)));
                        const found = messagesAfter.find(m => {
                            if (!m.fromMe || m.body !== contact.message) return false;
                            const msgId = m.id._serialized || m.id.id || String(m.id);
                            return !messageIdsBefore.has(msgId); // Must be new
                        });
                        
                        if (found) {
                            console.log(`✅ Verified NEW message sent on retry to ${contact.number}`);
                            successList.push({ number: contact.number });
                        } else {
                            throw new Error("Message not found after page send");
                        }
                    }
                } catch (retryError) {
                    const retryErrorMsg = retryError.message || String(retryError);
                    console.error(`❌ Page method also failed for ${contact.number}: ${retryErrorMsg}`);
                    failedList.push({ number: contact.number, error: `markedUnread error - all methods failed: ${retryErrorMsg}` });
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
