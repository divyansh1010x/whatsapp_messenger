const express = require("express");
const { sendMessage, getStatus } = require("../services/whatsappService");

const router = express.Router();

router.post("/start-campaign", async (req, res) => {
    const campaignData = req.body;

    if (!campaignData || !campaignData.id || !campaignData.details || !campaignData.contacts) {
        return res.status(400).json({ message: "Invalid campaign data. Ensure 'id', 'details', and 'contacts' are present." });
    }

    console.log("Received campaign data:", campaignData);

    const { contacts, details } = campaignData;
    const messageTemplate = details.messageTemplate;
    const rawCountry = campaignData.countryCode || "91";
    const countryDigits = String(rawCountry).replace(/\D/g, "");

    // Convert contacts to required format
    const formattedContacts = contacts
  .map(contact => {
    const messageData = details.messageTemplate.find(
      m => m.day === contact.count.toString()
    );

    if (!messageData) return null;

    const localDigits = String(contact.number || "").replace(/\D/g, "");
    const fullNumber = localDigits.startsWith(countryDigits)
      ? localDigits
      : countryDigits + localDigits;

    return {
      number: fullNumber,
      message: messageData.message
    };
  })
  .filter(c => c !== null);

    console.log("Formatted contacts:", formattedContacts);

    if (formattedContacts.length === 0) {
        return res.status(400).json({ message: "No valid contacts found for this campaign." });
    }

    try {
        // Verify WhatsApp client readiness just before sending
        const status = await getStatus();
        if (!status?.loggedIn) {
            return res.status(400).json({ message: status?.message || "WhatsApp client not ready. Please log in first." });
        }

        const result = await sendMessage(formattedContacts);

        console.log("Sent numbers:", result.sent);
        const sentCount = result?.sent?.length ?? 0;
        const failedContacts = result?.failed ?? [];
        const totalContacts = formattedContacts.length;

        console.log(`Campaign processed. Sent: ${sentCount}/${totalContacts}`);

        res.json({
            message: `Campaign processed. Sent: ${sentCount}/${totalContacts}`,
            sentCount,
            failedContacts,
            totalContacts,
            data: result
        });
    } catch (error) {
        // Log full error details for debugging in deployment logs
        console.error("Error sending WhatsApp messages:", error);
        res.status(500).json({
            message: "Failed to send messages",
            error: error?.message || String(error),
            stack: error?.stack
        });
    }    
});

module.exports = router;
