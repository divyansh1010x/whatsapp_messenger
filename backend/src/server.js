const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const appRoutes = require("./app");
const { initializeClient } = require("./services/whatsappService");

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = express();

server.use(cors({ origin: "*" }));
server.use(express.json());
server.use("/api", appRoutes);

server.listen(PORT, async () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log("⚙️ Initializing WhatsApp client...");
    await initializeClient();
});
