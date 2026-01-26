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

    // DEDUPLICATION: Remove duplicate messages to the same number
    // Keep only unique number+message combinations, and limit max 5 messages per number
    const seen = new Map(); // number -> array of messages sent
    const deduplicatedContacts = [];
    
    for (const contact of formattedContacts) {
        const key = contact.number;
        if (!seen.has(key)) {
            seen.set(key, []);
        }
        
        const messagesForNumber = seen.get(key);
        
        // Skip if we've already sent this exact message to this number
        if (messagesForNumber.includes(contact.message)) {
            console.log(`⚠️ Skipping duplicate: "${contact.message}" already sent to ${contact.number}`);
            continue;
        }
        
        // Limit to max 5 messages per number per campaign to avoid spam detection
        if (messagesForNumber.length >= 5) {
            console.log(`⚠️ Skipping: Already sent 5 messages to ${contact.number} (spam protection)`);
            continue;
        }
        
        messagesForNumber.push(contact.message);
        deduplicatedContacts.push(contact);
    }

    console.log(`📊 Deduplication: ${formattedContacts.length} → ${deduplicatedContacts.length} contacts`);
    console.log("Formatted contacts:", deduplicatedContacts);

    if (deduplicatedContacts.length === 0) {
        return res.status(400).json({ message: "No valid contacts found for this campaign after deduplication." });
    }

    try {
        // Verify WhatsApp client readiness just before sending
        const status = await getStatus();
        if (!status?.loggedIn) {
            return res.status(400).json({ message: status?.message || "WhatsApp client not ready. Please log in first." });
        }

        const result = await sendMessage(deduplicatedContacts);

        console.log("Sent numbers:", result.sent);
        const sentCount = result?.sent?.length ?? 0;
        const failedContacts = result?.failed ?? [];
        const totalContacts = deduplicatedContacts.length;

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
