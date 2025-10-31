'use client';

import { useState, useEffect } from 'react';
import { User, BarChart3, FileText, Calendar, Settings, LogOut, Shield } from 'lucide-react';
import DowntimeTracker from './DowntimeTracker';
import PWAInstaller from './PWAInstaller';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

export default function MainApp() {
  return (
    <div className="min-h-screen">
      <DowntimeTracker />
      
      {/* PWA Installer */}
      <PWAInstaller />
      
      {/* Service Worker Registration */}
      <ServiceWorkerRegistration />
    </div>
  );
}

