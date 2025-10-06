const express = require("express");
const dbRoutes = require("./routes/dbRoute");
const whatsappRoutes = require("./routes/whatsappRoutes");
const campaignRoutes = require("./routes/campaignRoutes");

const app = express();

app.use(express.json());

// Main route mappings
app.use("/db", dbRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/campaign", campaignRoutes);

module.exports = app;
