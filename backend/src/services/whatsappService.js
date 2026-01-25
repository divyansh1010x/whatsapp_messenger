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

        try {
            // Get the chat object first to verify it exists
            const chat = await client.getChatById(chatId);
            
            if (!chat) {
                throw new Error("Chat not found or cannot be accessed");
            }

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
            } else {
                console.log(`✅ Sent to ${contact.number}`);
                successList.push({ number: contact.number });
            }

        } catch (error) {
            console.error(`❌ Failed to send to ${contact.number}: ${error.message}`);
            failedList.push({ number: contact.number, error: error.message });
        }

        // ⚠️ Keep delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1200));
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
