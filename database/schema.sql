CREATE DATABASE IF NOT EXISTS whatsapp_db;
USE whatsapp_db;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE campaigns (
    campaign_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    max_no_of_days INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT,
    day INT,
    message TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);

CREATE TABLE receivers (
    receiver_id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT,
    name VARCHAR(255),
    phone_number VARCHAR(15) UNIQUE,
    received BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
