const express = require("express");
const userRoutes = require("./routes/userRoutes");
const campaignRoutes = require("./routes/campaignRoutes");
const messageRoutes = require("./routes/messageRoutes");
const receiverRoutes = require("./routes/receiverRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");

const app = express();

app.use(express.json());
app.use("/users", userRoutes);
app.use("/campaigns", campaignRoutes);
app.use("/messages", messageRoutes);
app.use("/receivers", receiverRoutes);
app.use("/whatsapp", whatsappRoutes);

module.exports = app;
