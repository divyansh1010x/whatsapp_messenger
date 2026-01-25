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
          "--disable-web-security"
        ]
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

    client.on("ready", () => {
        console.log("🚀 WhatsApp client ready.");
        isReady = true;
        latestQR = null;
    });

    client.on("disconnected", (reason) => {
        console.error("❌ WhatsApp disconnected:", reason);
        isReady = false;
    });

    await client.initialize();
    return client;
};

const sendMessage = async (contacts) => {
    if (!isReady) {
        throw new Error("WhatsApp client not ready");
    }

    const successList = [];
    const failedList = [];

    for (const contact of contacts) {
        const chatId = `${contact.number}@c.us`;

        try {
            // Send message with timeout protection (increased to 45 seconds)
            let messageSent = false;
            
            try {
                const result = await Promise.race([
                    client.sendMessage(chatId, contact.message),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Send timeout")), 60000)
                    )
                ]);
                messageSent = true;
                console.log(`✅ Sent to ${contact.number}`);
                successList.push({ number: contact.number });
            } catch (sendError) {
                // If it's a markedUnread error, the message was actually sent
                // The error occurs in sendSeen() which runs AFTER sendMessage completes
                if (sendError.toString().includes('markedUnread')) {
                    messageSent = true;
                    console.log(`✅ Sent to ${contact.number} (markedUnread error after send - message delivered)`);
                    successList.push({ number: contact.number });
                } else {
                    throw sendError; // Re-throw non-markedUnread errors
                }
            }

        } catch (error) {
            console.error(`❌ Failed to send to ${contact.number}: ${error.message}`);
            failedList.push({ number: contact.number, error: error.message });
        }

        // Delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1200));
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
