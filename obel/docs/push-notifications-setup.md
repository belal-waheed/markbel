# 🔔 Web Push Notification System Implementation Guide

This document provides a step-by-step guide to understanding, configuring, and implementing the Web Push Notification system for **Obel**. Follow this structure if you need to reconstruct or re-implement notifications from scratch.

---

## 🏗️ Architectural Overview
Web Push notifications operate using a three-way interaction:
1. **The Client (PWA Browser):** Requests permission from the user, retrieves a unique `PushSubscription` containing an endpoint URL and security keys from the browser's push server (e.g. Google FCM), and uploads it to the backend.
2. **The Database (MongoDB):** Stores subscription credentials mapped to `userId` so we know where to direct notifications.
3. **The Backend Server (Next.js App):** Triggered by a cron scheduler, matches upcoming items (tasks, habits) to target users, reads their active subscriptions, encrypts the payload using `web-push` (with VAPID keys), and sends it to the push service.
4. **The Service Worker (`sw.js`):** Runs persistently in the background on the client's device, catches the `push` event, shows a rich system notification, and handles `notificationclick` redirects.

---

## 🔑 Step 1: VAPID Key Generation
VAPID (Voluntary Application Server Identification) keys authenticate your server to the push services.
Generate a valid pair using the `web-push` command line tool:
```bash
npx web-push generate-vapid-keys
```
Add the generated keys to your `.env.local`:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

---

## 🗄️ Step 2: Database Schema
Store active subscription endpoints in MongoDB. Ensure you prune inactive/expired endpoints on response error (`410 Gone` or `404 Not Found`).

### Schema Definition (`src/models/PushSubscription.model.ts`)
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPushSubscription extends Document {
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  deviceType?: string;
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>({
  userId: { type: String, required: true, index: true },
  subscription: {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  deviceType: { type: String },
  createdAt: { type: Date, default: Date.now, expires: '30d' } // Automatically clean stale endpoints after 30 days
});

export const PushSubscription = mongoose.models.PushSubscription || 
  mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
```

---

## 🛠️ Step 3: Service Worker Handler
Add event listeners to catch incoming push notifications even when the browser is closed.

### Implementation (`worker/index.ts`)
```typescript
/// <reference lib="webworker" />

const swSelf = self as any;

// ─── Catch Push Events from Server ───
swSelf.addEventListener('push', (event: any) => {
  try {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        data = { body: event.data.text() };
      }
    }
    
    const title = (data as any).title || 'Obel';
    const options = {
      icon: '/obel.png',
      badge: '/obel.png', // Defaults to fallback logo if not overwritten
      vibrate: [200, 100, 200],
      ...data,
      data: { url: (data as any).data?.url || (data as any).url || '/' },
    } as NotificationOptions;

    event.waitUntil(swSelf.registration.showNotification(title, options));
  } catch (err) {
    console.error('[ServiceWorker] Push event error:', err);
  }
});

// ─── Handle Notification Clicks (Navigation / Focus) ───
swSelf.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen });
          return;
        }
      }
      return swSelf.clients.openWindow(urlToOpen);
    })
  );
});
```

---

## 📡 Step 4: Client Subscription Flow
Use this logic on the client side to request permission, subscribe to the browser push network, and upload the token.

### Helper Functions (`src/lib/notifications.ts`)
```typescript
// Helper to convert base64 VAPID public key to Uint8Array for registration
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser.');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key is missing in environment variables');
  }

  // Subscribe to the push service
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  // Save subscription credentials to MongoDB
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subscription }),
  });

  return subscription;
}
```

---

## 💻 Step 5: Backend Endpoint & Cron Matches
When reminders are triggered, encrypt payloads and push them to matching devices.

### Subscribe Endpoint (`src/app/api/notifications/subscribe/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { PushSubscription } from '@/models/PushSubscription.model';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { userId, subscription } = await req.json();
    
    if (!userId || !subscription) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Update or insert subscription
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      { userId, subscription, createdAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Cron Trigger Scanner (`src/app/api/cron/reminders/route.ts`)
Initialize `web-push` and match tasks/habits at scheduled intervals (e.g. every minute via `cron-job.org`).

```typescript
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import dbConnect from '@/lib/db';
import { PushSubscription } from '@/models/PushSubscription.model';
import { Task } from '@/models/Task.model';
import { Habit } from '@/models/Habit.model';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

webpush.setVapidDetails(
  'mailto:support@obel.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(req: Request) {
  // Ensure cron key validation here to secure the endpoint
  await dbConnect();

  const subscriptions = await PushSubscription.find({});
  
  for (const sub of subscriptions) {
    // 1. Determine target local time based on client timezone
    const userTimezone = sub.timezone || 'UTC';
    const localNow = dayjs().tz(userTimezone);
    const localTodayStr = localNow.format('YYYY-MM-DD');
    const localTimeStr = localNow.format('HH:mm');

    // 2. Scan and match tasks
    const tasks = await Task.find({
      userId: sub.userId,
      status: { $ne: 'done' },
      dueDate: { $regex: new RegExp(`^${localTodayStr}`) },
      scheduledTime: localTimeStr
    });

    for (const task of tasks) {
      const payload = JSON.stringify({
        title: `⏰ Task Alert: ${task.title}`,
        body: 'Time to focus on this task!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-task.svg', // Uses task badge SVG
        data: { url: '/tasks' }
      });

      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Endpoint expired, delete from database
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
```

---

## 🎨 Step 6: Custom Badge Icons
To match specific categories, prepare clean monochrome (white only) SVG icons with fully transparent backgrounds.

* **Task Badge (`public/icons/badge-task.svg`):** A checkmark path.
* **Habit Badge (`public/icons/badge-habit.svg`):** A star or sparkle polygon.
* **Timer Badge (`public/icons/badge-timer.svg`):** A clock circle and line.

Web browsers render transparent background monochrome SVGs perfectly in notifications, placing the relevant badge on the bottom-right corner of the drawer notification and status bar on Android devices.
