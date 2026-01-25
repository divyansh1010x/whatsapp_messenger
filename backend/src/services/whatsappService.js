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
      // Disable auto-download and other features that might cause chat object issues
      restartOnCrash: true
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
        let retries = 0;
        const maxRetries = 2;

        while (retries < maxRetries) {
            try {
                // ⏱️ Hard timeout protection
                const sendPromise = client.sendMessage(chatId, contact.message);

                const result = await Promise.race([
                    sendPromise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Send timeout")), 15000)
                    )
                ]);

                // Message sent successfully
                if (result && result.id) {
                    console.log(`✅ Sent to ${contact.number} (Message ID: ${result.id.id})`);
                    successList.push({ number: contact.number, messageId: result.id.id });
                    break; // Exit retry loop on success
                } else {
                    console.log(`✅ Sent to ${contact.number}`);
                    successList.push({ number: contact.number });
                    break; // Exit retry loop on success
                }

            } catch (error) {
                const errorStr = error.toString();
                
                // Check for markedUnread error - retry once
                if (errorStr.includes('markedUnread') && retries < maxRetries - 1) {
                    retries++;
                    console.warn(`⚠️ markedUnread error for ${contact.number}, retrying... (attempt ${retries})`);
                    await new Promise(r => setTimeout(r, 1000)); // Wait before retry
                    continue;
                }
                
                // If it's the markedUnread error after retries, consider it sent
                if (errorStr.includes('markedUnread')) {
                    console.warn(`⚠️ markedUnread error for ${contact.number}, but message likely sent`);
                    successList.push({ number: contact.number, markedUnreadError: true });
                    break;
                }

                // Other errors = failed
                console.error(`❌ Failed to send to ${contact.number}:`);
                console.error(`Error Message: ${error.message}`);
                failedList.push({ number: contact.number, error: error.message });
                break; // Exit retry loop on non-markedUnread error
            }
        }

        // ⚠️ Keep delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1200));
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
