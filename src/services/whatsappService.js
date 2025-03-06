const puppeteer = require("puppeteer");

const sendMessage = async (contacts) => {
    const browser = await puppeteer.launch({ headless: false, userDataDir: "./whatsapp-session" });
    const page = await browser.newPage();

    console.log("Opening WhatsApp Web...");
    await page.goto("https://web.whatsapp.com");
    await page.waitForSelector("#side", { timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 10000));

    for (let contact of contacts) {
        const whatsappURL = `https://web.whatsapp.com/send?phone=${contact.number}&text=${encodeURIComponent(contact.message)}`;
        await page.goto(whatsappURL);

        try {
            await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
            await page.click('div[contenteditable="true"]');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await page.keyboard.down("Enter");
            await page.keyboard.up("Enter");

            console.log(`✅ Message sent to ${contact.number}`);
        } catch (error) {
            console.log(`❌ Failed to send message to ${contact.number}`);
        }
    }

    console.log("✅ All messages sent!");
    setTimeout(() => {
        browser.close();
    }, 2000);    
};

module.exports = { sendMessage };
