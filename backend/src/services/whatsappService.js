const puppeteer = require("puppeteer");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const sendMessage = async (contacts) => {
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: "./whatsapp-session",
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null,
    });

    const page = await browser.newPage();

    console.log("Opening WhatsApp Web...");
    await page.goto("https://web.whatsapp.com");

    try {
        await page.waitForSelector("#side", { timeout: 60000 });
        console.log("WhatsApp Web Loaded.");
    } catch (err) {
        console.error("Failed to load WhatsApp Web (Timeout waiting for sidebar).");
        await browser.close();
        return { sent: [], failed: contacts };
    }

    await delay(10000); // Give extra time for session to settle

    let successList = [];
    let failedList = [];

    for (let contact of contacts) {
        const whatsappURL = `https://web.whatsapp.com/send?phone=${contact.number}`;
        await page.goto(whatsappURL);
        console.log(`\🚀 Opening chat with ${contact.number}...`);
        await delay(5000);

        try {
            const dialog = await page.$("div[role='dialog']");
            if (dialog) {
                console.error(`Invalid number or error opening chat for ${contact.number}`);
                failedList.push({ number: contact.number });
                continue;
            }

            await page.waitForSelector("footer div[contenteditable='true']", { visible: true, timeout: 15000 });
            const inputBox = await page.$("footer div[contenteditable='true']");
            if (!inputBox) throw new Error("Message input box not found");

            await inputBox.focus();
            await delay(500);

            await page.keyboard.type(contact.message);
            await delay(500);

            await page.keyboard.press("Enter");
            await delay(3000);

            const messageSent = await page.evaluate(() => {
                const messages = document.querySelectorAll("div.message-out");
                return messages.length > 0 && messages[messages.length - 1].innerText.trim().length > 0;
            });

            if (messageSent) {
                console.log(`Message successfully sent to ${contact.number}`);
                successList.push({ number: contact.number });
            } else {
                throw new Error("Message was typed but may not have been sent.");
            }

        } catch (error) {
            console.error(`Failed to send message to ${contact.number}: ${error.message}`);
            failedList.push({ number: contact.number });
        }

        await delay(5000);
    }

    console.log("\n Messaging process completed!");
    console.log(`Sent: ${successList.length}, Failed: ${failedList.length}`);

    setTimeout(() => {
        browser.close();
    }, 5000);

    return { sent: successList, failed: failedList };
};

module.exports = { sendMessage };
