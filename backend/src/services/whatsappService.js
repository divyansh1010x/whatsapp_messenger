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
        headless: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security"
        ]
      },
      webVersion: "2.2409.2",
      webVersionCache: {
        type: "remote"
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

        try {
            // ⏱️ Hard timeout protection (VERY IMPORTANT)
            const sendPromise = client.sendMessage(chatId, contact.message).catch(err => {
                // If it's a "markedUnread" error, the message likely still sent
                if (err.message?.includes('markedUnread') || err.toString()?.includes('markedUnread')) {
                    console.warn(`⚠️ Message sent to ${contact.number} but post-send operation failed`);
                    return { partialSuccess: true };
                }
                throw err;
            });

            const result = await Promise.race([
                sendPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Send timeout")), 15000)
                )
            ]);

            // Check if message was sent (either fully or partially)
            if (result?.partialSuccess || (result && result.id)) {
                if (result.id) {
                    console.log(`✅ Sent to ${contact.number} (Message ID: ${result.id.id})`);
                    successList.push({ number: contact.number, messageId: result.id.id });
                } else {
                    console.log(`✅ Sent to ${contact.number} (partial)`);
                    successList.push({ number: contact.number, partial: true });
                }
            } else {
                console.log(`✅ Sent to ${contact.number}`);
                successList.push({ number: contact.number });
            }

        } catch (error) {
            console.error(`❌ Failed to send to ${contact.number}: ${error.message}`);
            failedList.push({ number: contact.number, error: error.message });
        }

        // ⚠️ Keep delay small but safe
        await new Promise(r => setTimeout(r, 1200));
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
