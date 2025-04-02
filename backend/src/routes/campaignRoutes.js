const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/start-campaign", async (req, res) => {
    const campaignData = req.body;

    if (!campaignData || !campaignData.id || !campaignData.details || !campaignData.contacts) {
        return res.status(400).json({ message: "Invalid campaign data. Ensure 'id', 'details', and 'contacts' are present." });
    }

    console.log("Received campaign data:", campaignData);

    const { contacts, details } = campaignData;
    const messageTemplate = details.messageTemplate;
    const countryCode = campaignData.countryCode || "91";

    // Convert to required format
    const formattedContacts = contacts
        .map(contact => {
            const messageData = messageTemplate.find(m => m.day === contact.count.toString());

            if (!messageData) {
                console.warn(`No message found for count (day) ${contact.count} - Skipping contact: ${contact.phoneNumber}`);
                return null; // Skip contacts with missing messages
            }

            return {
                number: countryCode + contact.phoneNumber, // Add country code
                message: messageData.message
            };
        })
        .filter(contact => contact !== null); // Remove invalid contacts

    if (formattedContacts.length === 0) {
        return res.status(400).json({ message: "No valid contacts found for this campaign." });
    }

    const payload = { contacts: formattedContacts };

    try {
        // Send the formatted payload to the WhatsApp API
        const response = await axios.post("http://localhost:5000/api/whatsapp/send", payload);
        console.log("WhatsApp API response:", response.data);

        res.json({ message: "Campaign processed and messages sent!", data: response.data });
    } catch (error) {
        console.error("Error sending WhatsApp messages:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to send messages", error: error.response?.data || error.message });
    }
});

module.exports = router;
