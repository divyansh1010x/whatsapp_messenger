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
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
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
        throw new Error("WhatsApp client not ready. Please log in first.");
    }

    const successList = [];
    const failedList = [];

    for (const contact of contacts) {
        const chatId = `${contact.number}@c.us`;

        try {
            // 1️⃣ Check if number exists on WhatsApp
            const isRegistered = await client.isRegisteredUser(chatId);
            if (!isRegistered) {
                console.log(`❌ ${contact.number} is not on WhatsApp`);
                failedList.push({ number: contact.number, reason: "Not on WhatsApp" });
                continue;
            }

            // 2️⃣ Force chat creation (IMPORTANT)
            await client.sendMessage(chatId, " "); // invisible bootstrap
            await new Promise(r => setTimeout(r, 1000));

            // 3️⃣ Send actual message
            await client.sendMessage(chatId, contact.message);

            successList.push({ number: contact.number });
            console.log(`✅ Sent to ${contact.number}`);

        } catch (error) {
            console.error(`❌ Failed to send to ${contact.number}:`, error.message);
            failedList.push({ number: contact.number, reason: error.message });
        }

        // 4️⃣ Rate-limit (avoid ban)
        await new Promise(r => setTimeout(r, 2000));
    }

    return { sent: successList, failed: failedList };
};

module.exports = { initializeClient, sendMessage, getStatus };
