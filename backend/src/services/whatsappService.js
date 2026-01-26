const { Client, LocalAuth } = require("whatsapp-web.js");

/**
 * WHY sendSeen() IS CALLED INTERNALLY:
 * 
 * whatsapp-web.js's sendMessage() function internally calls sendSeen() AFTER successfully sending a message.
 * This is to mark the chat as "read" (blue checkmarks) on your side.
 * 
 * THE PROBLEM:
 * sendSeen() tries to access chat.markedUnread property, but when:
 * - The chat object is undefined
 * - The chat hasn't been fully initialized
 * - WhatsApp Web's internal state is inconsistent
 * 
 * It throws: "Cannot read properties of undefined (reading 'markedUnread')"
 * 
 * THE SOLUTION:
 * We monkey-patch window.WWebJS.sendSeen to catch this error and ignore it.
 * Since the error happens AFTER the message is sent, we can safely ignore it.
 */

let client;
let isReady = false;
let latestQR = null; // Store latest QR as base64 for frontend
let isInitializing = false; // Prevent multiple simultaneous initializations
let keepAliveInterval = null; // Keep-alive interval to prevent idle disconnects

/**
 * MONKEY-PATCH FUNCTION: Safely patches sendSeen to prevent markedUnread crashes
 * 
 * This function patches window.WWebJS.sendSeen in the browser context to catch
 * and ignore markedUnread errors. The error occurs AFTER the message is sent,
 * so we can safely ignore it without affecting message delivery.
 */
const applySendSeenPatch = async (page) => {
    if (!page) return false;
    
    try {
        await page.evaluate(() => {
            if (window.WWebJS && typeof window.WWebJS.sendSeen === 'function') {
                // Store original function
                const originalSendSeen = window.WWebJS.sendSeen;
                
                // Replace with patched version
                window.WWebJS.sendSeen = async function(chatId) {
                    try {
                        // Try to call original function
                        return await originalSendSeen.call(this, chatId);
                    } catch (error) {
                        // Check if it's a markedUnread error
                        const errorStr = error?.message || String(error) || '';
                        const isMarkedUnreadError = 
                            errorStr.includes('markedUnread') || 
                            errorStr.includes('Cannot read properties of undefined');
                        
                        if (isMarkedUnreadError) {
                            // Message was already sent successfully, ignore this error
                            // This happens because sendSeen is called AFTER sendMessage
                            return; // Return successfully, don't throw
                        }
                        
                        // Re-throw other errors (network issues, authentication, etc.)
                        throw error;
                    }
                };
                
                // Mark that patch was applied
                window.__sendSeenPatched = true;
                return true;
            }
            return false;
        });
        return true;
    } catch (error) {
        console.warn('⚠️ Failed to apply sendSeen patch:', error.message);
        return false;
    }
};

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
        
        // Apply sendSeen patch as backup (in case it wasn't applied during initialize)
        try {
            const page = client.pupPage;
            if (page && await applySendSeenPatch(page)) {
                console.log('✅ sendSeen patch applied in ready event');
            }
        } catch (patchError) {
            console.warn('⚠️ Could not apply sendSeen patch in ready event:', patchError.message);
        }
        
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
            console.log(`⚠️ Disconnect reason: ${reason} - attempting to reconnect...`);
            // For other disconnect reasons (like idle timeout), try to reconnect
            setTimeout(() => {
                if (client && reason !== 'LOGOUT') {
                    console.log(`🔄 Attempting to reconnect after ${reason} disconnect...`);
                    client.initialize().catch(err => {
                        console.error("Failed to reconnect:", err);
                    });
                }
            }, 5000);
        }
        
        // Restart keep-alive after reconnection
        if (reason !== 'LOGOUT') {
            setTimeout(() => {
                if (client) {
                    startKeepAlive();
                }
            }, 10000); // Wait 10 seconds after disconnect before restarting keep-alive
        } else {
            // Stop keep-alive on LOGOUT
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
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
    
    // KEEP-ALIVE MECHANISM: Prevent idle disconnects
    const startKeepAlive = () => {
        // Clear any existing interval
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }
        
        // Check connection every 5 minutes and ping to keep alive
        keepAliveInterval = setInterval(async () => {
            if (!client) return;
            
            try {
                const state = await Promise.race([
                    client.getState(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 5000))
                ]);
                
                if (state === 'CONNECTED') {
                    // Ping WhatsApp by getting a simple property to keep connection alive
                    try {
                        // Just check if we can access the page - this keeps the connection active
                        const page = await client.pupPage;
                        if (page) {
                            // Execute a minimal script to keep the page active
                            await page.evaluate(() => {
                                // Just touch the page to keep it alive
                                return window.location.href;
                            }).catch(() => {
                                // Ignore errors - connection might be fine
                            });
                        }
                        console.log('💓 Keep-alive ping successful - connection active');
                    } catch (pingError) {
                        console.warn('⚠️ Keep-alive ping failed:', pingError.message);
                    }
                } else if (state !== 'LOGOUT') {
                    // Not connected but not logged out - try to reconnect
                    console.warn(`⚠️ Keep-alive detected disconnect (state: ${state}). Attempting reconnect...`);
                    isReady = false;
                    try {
                        await client.initialize();
                        await new Promise(r => setTimeout(r, 3000));
                        const newState = await Promise.race([
                            client.getState(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 5000))
                        ]);
                        if (newState === 'CONNECTED') {
                            console.log('✅ Keep-alive reconnection successful');
                            isReady = true;
                        }
                    } catch (reconnectError) {
                        console.error('❌ Keep-alive reconnection failed:', reconnectError.message);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Keep-alive check failed:', error.message);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
        
        console.log('✅ Keep-alive mechanism started (checks every 5 minutes)');
    };
    
    // Start keep-alive after client is ready
    client.once('ready', () => {
        startKeepAlive();
    });
    
    try {
    await client.initialize();
        
        // MONKEY-PATCH: Apply sendSeen patch to prevent markedUnread crashes
        // This must be done after initialize() so the page is available
        try {
            const page = await client.pupPage;
            if (page && await applySendSeenPatch(page)) {
                console.log('✅ sendSeen monkey-patch applied successfully');
            }
        } catch (patchError) {
            console.warn('⚠️ Could not apply sendSeen patch (non-critical):', patchError.message);
        }
        
        isInitializing = false;
        
        // Start keep-alive after successful initialization
        // (also started on 'ready' event, but this ensures it starts even if event fires before this)
        setTimeout(() => {
            if (client && isReady) {
                startKeepAlive();
            }
        }, 2000);
        
    return client;
    } catch (error) {
        isInitializing = false;
        console.error("❌ Failed to initialize client:", error);
        client = null;
        throw error;
    }
};

const sendMessage = async (contacts) => {
    console.log(`\n🔍 === SEND MESSAGE STATUS CHECK ===`);
    console.log(`📋 isReady flag: ${isReady}`);
    console.log(`📋 client exists: ${!!client}`);
    
    if (!client) {
        throw new Error("WhatsApp client not initialized");
    }

    // Check if client is ready - if not, wait a bit and check state
    if (!isReady) {
        console.warn(`⚠️ isReady is false, checking actual client state...`);
        try {
            const actualState = await Promise.race([
                client.getState(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 5000))
            ]);
            console.log(`📊 Actual client state: ${actualState}`);
            
            if (actualState === 'CONNECTED') {
                console.log(`✅ Client is actually CONNECTED, setting isReady=true`);
                isReady = true;
            } else {
                throw new Error(`WhatsApp client not ready. State: ${actualState}, isReady: ${isReady}`);
            }
        } catch (stateCheckError) {
            console.error(`❌ Client state check failed: ${stateCheckError.message}`);
            throw new Error(`WhatsApp client not ready. ${stateCheckError.message}`);
        }
    }

    // Verify client is actually connected with timeout
    let clientState = 'UNKNOWN';
    try {
        console.log(`🔍 Verifying client connection state...`);
        clientState = await Promise.race([
            client.getState(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("State check timeout")), 5000)
            )
        ]);
        console.log(`📊 Current client state: ${clientState}`);
        if (clientState !== 'CONNECTED') {
            console.warn(`⚠️ Client state is ${clientState}, not CONNECTED. Attempting to send anyway...`);
        } else {
            console.log(`✅ Client confirmed CONNECTED - ready to send messages`);
        }
    } catch (stateError) {
        console.error("❌ Error checking client state:", stateError.message);
        console.warn("⚠️ Proceeding despite state check failure...");
    }
    
    console.log(`🔍 === END STATUS CHECK ===\n`);

    // If we get multiple timeouts, mark client as not ready
    let consecutiveTimeouts = 0;

    const successList = [];
    const failedList = [];
    
    // Track same-number sends for progressive delay
    const numberSendCount = new Map(); // number -> count of sends in this batch
    const lastSendTime = new Map(); // number -> timestamp of last send

    for (const contact of contacts) {
        // Check connection state before each send - reconnect if needed
        try {
            const currentState = await Promise.race([
                client.getState(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 5000))
            ]);
            
            if (currentState !== 'CONNECTED') {
                console.warn(`⚠️ Client disconnected (state: ${currentState}) during campaign. Attempting to reconnect...`);
                isReady = false;
                
                // ACTIVE RECONNECTION: Try to reconnect if not LOGOUT
                if (currentState !== 'LOGOUT' && client) {
                    try {
                        console.log(`🔄 Attempting to reinitialize client...`);
                        await client.initialize();
                        
                        // Wait for ready event or check state
                        await new Promise(r => setTimeout(r, 3000));
                        
                        const recheckState = await Promise.race([
                            client.getState(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 5000))
                        ]);
                        
                        if (recheckState === 'CONNECTED') {
                            console.log(`✅ Client reconnected successfully`);
                            isReady = true;
                        } else {
                            console.error(`❌ Reconnection failed - state: ${recheckState}`);
                            // Add remaining contacts to failed list
                            const remainingIndex = contacts.indexOf(contact);
                            for (let i = remainingIndex; i < contacts.length; i++) {
                                failedList.push({ 
                                    number: contacts[i].number, 
                                    error: `Client disconnected during campaign (state: ${recheckState})` 
                                });
                            }
                            break; // Exit loop
                        }
                    } catch (reconnectError) {
                        console.error(`❌ Reconnection attempt failed: ${reconnectError.message}`);
                        // Add remaining contacts to failed list
                        const remainingIndex = contacts.indexOf(contact);
                        for (let i = remainingIndex; i < contacts.length; i++) {
                            failedList.push({ 
                                number: contacts[i].number, 
                                error: `Reconnection failed: ${reconnectError.message}` 
                            });
                        }
                        break; // Exit loop
                    }
                } else {
                    // LOGOUT or no client - cannot reconnect
                    console.error(`❌ Cannot reconnect - state: ${currentState}. Skipping remaining messages.`);
                    const remainingIndex = contacts.indexOf(contact);
                    for (let i = remainingIndex; i < contacts.length; i++) {
                        failedList.push({ 
                            number: contacts[i].number, 
                            error: `Client logged out during campaign (state: ${currentState})` 
                        });
                    }
                    break; // Exit loop
                }
            }
        } catch (stateCheckError) {
            console.error(`❌ Error checking state during send: ${stateCheckError.message}`);
            // Continue anyway - might be temporary
        }
        const chatId = `${contact.number}@c.us`;
        console.log(`📤 Attempting to send to ${contact.number}...`);

        // Store chat in outer scope for retry logic
        let chat = null;
        let messagesBefore = [];

        try {
            // Get or create chat first to avoid markedUnread errors
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
            
            // Get messages before sending to compare later (wrap in try-catch to avoid markedUnread)
            try {
                const chatBefore = await client.getChatById(chatId);
                try {
                    messagesBefore = await chatBefore.fetchMessages({ limit: 5 });
                } catch (fetchError) {
                    // If fetchMessages fails with markedUnread, just use empty array
                    if (String(fetchError).includes('markedUnread')) {
                        console.log(`⚠️ Could not get messages before (markedUnread), continuing anyway...`);
                        messagesBefore = [];
                    } else {
                        throw fetchError;
                    }
                }
            } catch (e) {
                // Ignore if we can't get messages before
                messagesBefore = [];
            }
            
            try {
                // Use chat.sendMessage if available, it handles markedUnread better
                let sendPromise;
                if (chat) {
                    console.log(`📤 Sending via chat.sendMessage...`);
                    sendPromise = chat.sendMessage(contact.message);
                } else {
                    console.log(`📤 Sending via client.sendMessage...`);
                    sendPromise = client.sendMessage(chatId, contact.message);
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
                    // markedUnread error - check if message was actually sent before the error
                    console.log(`⚠️ markedUnread error - checking if message was sent before error...`);
                    
                    // Wait a moment for message to appear
                    await new Promise(r => setTimeout(r, 3000));
                    
                    try {
                        const verifyChat = await client.getChatById(chatId);
                        let messagesAfter = [];
                        try {
                            messagesAfter = await verifyChat.fetchMessages({ limit: 10 });
                        } catch (fetchError) {
                            // If fetchMessages also fails with markedUnread, assume message was sent
                            if (String(fetchError).includes('markedUnread')) {
                                console.log(`⚠️ Cannot verify (markedUnread in fetchMessages) - assuming message was sent`);
                                // Since we can't verify, and markedUnread happens AFTER sending,
                                // assume the message was sent successfully
                                successList.push({ number: contact.number });
                                continue; // Skip to next contact
                            } else {
                                throw fetchError;
                            }
                        }
                        
                        const messageIdsBefore = new Set(messagesBefore.map(m => m.id._serialized || m.id.id || String(m.id)));
                        
                        // Find NEW message with exact match
                        const found = messagesAfter.find(m => {
                            if (!m.fromMe || m.body !== contact.message) return false;
                            const msgId = m.id._serialized || m.id.id || String(m.id);
                            return !messageIdsBefore.has(msgId); // Must be new
                        });
                        
                        if (found) {
                            const messageId = found.id.id || found.id._serialized || found.id || 'unknown';
                            console.log(`✅ Message WAS sent before markedUnread error (Message ID: ${messageId})`);
                            successList.push({ number: contact.number });
                        } else {
                            console.error(`❌ markedUnread error and message NOT found - will retry`);
                            throw sendError; // Re-throw to trigger retry
                        }
                    } catch (verifyError) {
                        // If verification fails with markedUnread, assume message was sent
                        if (String(verifyError).includes('markedUnread')) {
                            console.log(`⚠️ Verification failed with markedUnread - assuming message was sent`);
                            successList.push({ number: contact.number });
                        } else {
                            console.error(`❌ Could not verify: ${verifyError.message}`);
                            throw sendError; // Re-throw to trigger retry
                        }
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
                console.error(`❌ markedUnread error for ${contact.number} - retrying...`);
                try {
                    // Wait a moment before retry
                    await new Promise(r => setTimeout(r, 3000));
                    
                    // Get chat if we don't have it (chat is in outer scope now)
                    if (!chat) {
                        try {
                            chat = await client.getChatById(chatId);
                        } catch (e) {
                            console.error(`❌ Could not get chat for retry: ${e.message}`);
                            throw error; // Re-throw original error
                        }
                    }
                    
                    // Try using chat.sendMessage if we have chat, otherwise client.sendMessage
                    console.log(`🔄 Retry: Using ${chat ? 'chat.sendMessage' : 'client.sendMessage'}...`);
                    const retryResult = await Promise.race([
                        chat ? chat.sendMessage(contact.message) : client.sendMessage(chatId, contact.message),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Retry timeout")), 30000)
                        )
                    ]);
                    
                    if (retryResult && retryResult.id) {
                        const messageId = retryResult.id.id || retryResult.id._serialized || retryResult.id || 'unknown';
                        console.log(`✅ Successfully sent on retry to ${contact.number} (Message ID: ${messageId})`);
                        successList.push({ number: contact.number });
                    } else {
                        // Verify by checking for new message
                        await new Promise(r => setTimeout(r, 3000));
                        const verifyChat = await client.getChatById(chatId);
                        const messagesAfter = await verifyChat.fetchMessages({ limit: 10 });
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
                            throw new Error("Message not found after retry");
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
                
                // Check actual client state before marking as not ready
                try {
                    const actualState = await Promise.race([
                        client.getState(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("State check timeout")), 3000))
                    ]);
                    
                    // Only mark as not ready if we get 3+ timeouts AND client is actually disconnected
                    if (consecutiveTimeouts >= 3 && actualState !== 'CONNECTED') {
                        console.error(`🚨 Multiple timeouts (${consecutiveTimeouts}) and client disconnected (${actualState}). Marking as not ready.`);
                        isReady = false;
                    } else if (consecutiveTimeouts >= 3) {
                        console.warn(`⚠️ Multiple timeouts (${consecutiveTimeouts}) but client still connected. Continuing...`);
                        // Reset counter if client is still connected - might be temporary network issue
                        consecutiveTimeouts = 0;
                    }
                } catch (stateError) {
                    // If we can't check state, be conservative - only mark not ready after 4+ timeouts
                    if (consecutiveTimeouts >= 4) {
                        console.error("🚨 Multiple timeouts and cannot verify state. Marking client as not ready.");
                        isReady = false;
                    }
                }
                
                failedList.push({ number: contact.number, error: errorMsg });
            } else {
                consecutiveTimeouts = 0; // Reset on non-timeout errors
                console.error(`❌ Failed to send to ${contact.number}: ${errorMsg}`);
                failedList.push({ number: contact.number, error: errorMsg });
            }
        }

        // PROGRESSIVE DELAY: Increase delay for same-number sends to avoid spam detection
        const sendCount = numberSendCount.get(contact.number) || 0;
        numberSendCount.set(contact.number, sendCount + 1);
        
        const lastTime = lastSendTime.get(contact.number);
        const timeSinceLastSend = lastTime ? Date.now() - lastTime : Infinity;
        
        // Calculate delay based on same-number send count
        let delay = 2000; // Base 2 seconds
        if (sendCount > 1) {
            // Progressive delay: 2s, 5s, 10s, 15s for 2nd, 3rd, 4th, 5th+ sends to same number
            delay = Math.min(2000 + (sendCount - 1) * 3000, 15000);
        }
        
        // If sending to same number again, ensure minimum time gap
        if (lastTime && timeSinceLastSend < delay) {
            const additionalWait = delay - timeSinceLastSend;
            console.log(`⏳ Progressive delay: Waiting ${additionalWait}ms before next send to ${contact.number} (send #${sendCount + 1} to this number)`);
            await new Promise(r => setTimeout(r, additionalWait));
        } else if (contacts.indexOf(contact) < contacts.length - 1) {
            // Different number or first send - use base delay
            await new Promise(r => setTimeout(r, delay));
        }
        
        lastSendTime.set(contact.number, Date.now());
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
