const { Client, LocalAuth } = require("whatsapp-web.js");

let client;
let isReady = false;
let latestQR = null; // Store latest QR as base64 for frontend

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
    if (client) return client;

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
        try {
            const state = await client.getState();
            console.log(`📊 Client state: ${state}`);
            if (state === 'CONNECTED') {
                isReady = true;
                latestQR = null;
            } else {
                console.warn(`⚠️ Client ready but state is ${state}, not CONNECTED`);
                isReady = false;
            }
        } catch (error) {
            console.error("Error checking state on ready:", error);
            isReady = true; // Assume ready if we can't check
            latestQR = null;
        }
    });

    client.on("disconnected", (reason) => {
        console.error("❌ WhatsApp disconnected:", reason);
        isReady = false;
        // Try to reinitialize if disconnected
        if (reason === 'NAVIGATION') {
            console.log("Attempting to reconnect...");
            setTimeout(() => {
                if (client) {
                    client.initialize().catch(err => {
                        console.error("Failed to reconnect:", err);
                    });
                }
            }, 5000);
        }
    });

    client.on("auth_failure", (msg) => {
        console.error("❌ WhatsApp authentication failed:", msg);
        isReady = false;
        latestQR = null;
    });

    await client.initialize();
    return client;
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

            // Send message - use chat.sendMessage if available, otherwise use client.sendMessage
            let result;
            if (chat) {
                // Use chat's sendMessage method which handles markedUnread better
                result = await Promise.race([
                    chat.sendMessage(contact.message),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Send timeout after 30 seconds")), 30000)
                    )
                ]);
            } else {
                // Use client.sendMessage - chat will be created automatically
                result = await Promise.race([
                    client.sendMessage(chatId, contact.message),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Send timeout after 30 seconds")), 30000)
                    )
                ]);
            }
            
            // Verify we got a valid result
            if (result && result.id) {
                const messageId = result.id.id || result.id._serialized || result.id || 'unknown';
                console.log(`✅ Successfully sent to ${contact.number} (Message ID: ${messageId})`);
                successList.push({ number: contact.number });
            } else {
                // Even if no ID, if no error was thrown, consider it success
                console.log(`✅ Message sent to ${contact.number} (no ID returned but no error)`);
                successList.push({ number: contact.number });
            }

        } catch (error) {
            const errorMsg = error.message || String(error);
            const errorString = String(error);
            
            // Handle markedUnread error specifically - this happens when chat is undefined
            if (errorMsg.includes('markedUnread') || errorString.includes('markedUnread')) {
                console.error(`❌ markedUnread error for ${contact.number} - retrying with chat creation...`);
                try {
                    // Wait a moment
                    await new Promise(r => setTimeout(r, 1500));
                    
                    // Force get/create chat first
                    let retryChat;
                    try {
                        retryChat = await Promise.race([
                            client.getChatById(chatId),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("Chat lookup failed")), 8000))
                        ]);
                    } catch {
                        // If chat doesn't exist, send a message to create it
                        // First message to a new number creates the chat
                        console.log(`Creating new chat for ${contact.number}...`);
                    }
                    
                    // Retry sending - if chat exists, use it; otherwise use client method
                    const retryResult = await Promise.race([
                        retryChat ? retryChat.sendMessage(contact.message) : client.sendMessage(chatId, contact.message),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Retry timeout")), 30000)
                        )
                    ]);
                    
                    if (retryResult && retryResult.id) {
                        const messageId = retryResult.id.id || retryResult.id._serialized || retryResult.id || 'unknown';
                        console.log(`✅ Successfully sent to ${contact.number} on retry (Message ID: ${messageId})`);
                        successList.push({ number: contact.number });
                    } else {
                        // Even without ID, if no error, consider success
                        console.log(`✅ Message sent to ${contact.number} on retry (no ID but no error)`);
                        successList.push({ number: contact.number });
                    }
                } catch (retryError) {
                    const retryErrorMsg = retryError.message || String(retryError);
                    console.error(`❌ Retry also failed for ${contact.number}: ${retryErrorMsg}`);
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
