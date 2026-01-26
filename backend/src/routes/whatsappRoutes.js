const express = require("express");
const router = express.Router();
const { getStatus, sendMessage } = require("../services/whatsappService");

// GET status (includes QR if not logged in)
router.get("/status", async (req, res) => {
    try {
        const status = await getStatus();
        res.json(status);
    } catch (err) {
        console.error("Error fetching WhatsApp status:", err);
        res.status(500).json({ error: "Failed to get WhatsApp status" });
    }
});

// POST send message
router.post("/send", async (req, res) => {
    try {
        const result = await sendMessage(req.body.contacts);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


// const express = require('express');
// const { getQR, sendMessage, isReady } = require('../whatsappClient');

// const router = express.Router();

// // Get QR code for login
// router.get('/qr', async (req, res) => {
//     try {
//         const qrDataUrl = await getQR();
//         if (!qrDataUrl) {
//             return res.json({ loggedIn: true, qr: null });
//         }
//         res.json({ loggedIn: false, qr: qrDataUrl });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Send message endpoint
// router.post('/send', async (req, res) => {
//     const { contacts } = req.body;

//     if (!contacts || !Array.isArray(contacts)) {
//         return res.status(400).json({ error: "Invalid contacts format. Must be an array." });
//     }

//     if (!isReady()) return res.status(400).json({ error: "WhatsApp is not ready yet." });

//     let successList = [];
//     let failedList = [];

//     for (let contact of contacts) {
//         try {
//             await sendMessage(contact.number, contact.message);
//             successList.push({ number: contact.number });
//         } catch (err) {
//             failedList.push({ number: contact.number });
//         }
//     }

//     res.json({ sent: successList, failed: failedList });
// });

// module.exports = router;
