import { useEffect, useState } from "react";

type WhatsAppStatus = {
  loggedIn: boolean;
  qr?: string | null;
  message?: string;
};

export default function WhatsAppStatusPanel() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL;

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/status`);
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
        <p className="text-yellow-600 font-semibold">Scan the QR code with your WhatsApp app to connect this device.</p>
        <img src={status.qr} alt="WhatsApp QR Code" className="w-48 h-48" />
        <p className="text-gray-600">After scanning, please wait a moment while we securely connect your account.</p>
      </div>
    );
  }

  // Show loading bar when QR is scanned but not ready yet
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex items-center justify-center mb-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-whatsapp-primary mr-2"></div>
        <span className="text-sm text-gray-600">Connecting...</span>
      </div>
    </div>
  );
}
