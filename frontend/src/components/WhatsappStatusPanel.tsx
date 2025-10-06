import { useEffect, useState } from "react";

type WhatsAppStatus = {
  loggedIn: boolean;
  qr?: string | null;
  message?: string;
};

export default function WhatsAppStatusPanel() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/whatsapp/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch WhatsApp status:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (!status) return <p>Loading WhatsApp status...</p>;

  if (status.loggedIn) {
    return <p className="text-green-600 font-semibold">✅ WhatsApp is ready!</p>;
  }

  if (status.qr) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <p className="text-yellow-600 font-semibold">📱 Scan this QR code with WhatsApp</p>
        <img src={status.qr} alt="WhatsApp QR Code" className="w-48 h-48" />
        {status.message && <p className="text-gray-600">{status.message}</p>}
      </div>
    );
  }

  return <p className="text-gray-600 font-medium">{status.message || "⏳ Waiting for WhatsApp client..."}</p>;
}
