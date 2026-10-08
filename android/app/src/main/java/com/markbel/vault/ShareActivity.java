package com.markbel.vault;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Headless, truly invisible Android Share Sheet Target.
 * Intercepts text/plain share intents, extracts URLs and titles,
 * posts directly to the Cloudflare Worker API, and immediately finishes
 * with zero window transition or UI disruption.
 */
public class ShareActivity extends Activity {

    private static final String PREFS_NAME = "MarkbelPrefs";
    private static final String PREF_TOKEN = "auth_token";
    private static final String WORKER_ENDPOINT = "https://mark.obel.workers.dev/api/sync/mutations";
    private static final Pattern URL_PATTERN = Pattern.compile("https?://[\\w\\d:#@%/;$()~_?\\+-=\\\\.&]+", Pattern.CASE_INSENSITIVE);

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        if (intent == null) {
            finish();
            return;
        }

        String action = intent.getAction();
        String type = intent.getType();

        if (!Intent.ACTION_SEND.equals(action) || type == null || (!type.equals("text/plain") && !type.startsWith("text/"))) {
            finish();
            return;
        }

        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        if ((sharedText == null || sharedText.trim().isEmpty()) && intent.getClipData() != null) {
            ClipData clipData = intent.getClipData();
            if (clipData.getItemCount() > 0 && clipData.getItemAt(0).getText() != null) {
                sharedText = clipData.getItemAt(0).getText().toString();
            }
        }

        if (sharedText == null || sharedText.trim().isEmpty()) {
            Toast.makeText(getApplicationContext(), "No content found to save", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        String rawContent = sharedText.trim();
        String targetUrl = null;

        Matcher matcher = URL_PATTERN.matcher(rawContent);
        if (matcher.find()) {
            targetUrl = matcher.group(0).replaceAll("[),.;]+$", "");
        } else if (rawContent.startsWith("http://") || rawContent.startsWith("https://")) {
            targetUrl = rawContent;
        }

        if (targetUrl == null) {
            Toast.makeText(getApplicationContext(), "No valid link found to save", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        String title = (sharedSubject != null && !sharedSubject.trim().isEmpty()) ? sharedSubject.trim() : targetUrl;
        String description = rawContent.equals(targetUrl) ? "" : rawContent;

        String token = getStoredAuthToken();
        if (token == null || token.isEmpty()) {
            Toast.makeText(getApplicationContext(), "Please open Markbel and log in first", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        // Show immediate visual confirmation
        Toast.makeText(getApplicationContext(), "Saving to Markbel...", Toast.LENGTH_SHORT).show();

        // Finish activity instantly to ensure zero UI delay or window distraction
        finish();

        // Perform asynchronous network request in background daemon thread
        final String finalTargetUrl = targetUrl;
        final String finalTitle = title;
        final String finalDescription = description;
        final String finalToken = token;
        final Context appContext = getApplicationContext();

        executor.execute(() -> saveBookmarkToWorker(appContext, finalTargetUrl, finalTitle, finalDescription, finalToken));
    }

    private String getStoredAuthToken() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(PREF_TOKEN, null);
        if (token != null && !token.trim().isEmpty()) {
            return token.trim();
        }
        return null;
    }

    private void saveBookmarkToWorker(Context context, String url, String title, String description, String token) {
        try {
            URL endpoint = new URL(WORKER_ENDPOINT);
            HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(12000);
            conn.setDoOutput(true);

            JSONObject root = new JSONObject();
            root.put("protocolVersion", 1);
            root.put("deviceId", "android-share-headless");
            root.put("requestId", UUID.randomUUID().toString());

            JSONArray changes = new JSONArray();
            JSONObject change = new JSONObject();
            change.put("changeId", UUID.randomUUID().toString());
            change.put("entityType", "bookmark");
            change.put("entityId", UUID.randomUUID().toString());
            change.put("operation", "create");
            change.put("baseVersion", 0);

            JSONObject payload = new JSONObject();
            payload.put("url", url);
            payload.put("title", title);
            payload.put("description", description);
            payload.put("group", resolveSmartGroup(url));
            change.put("payload", payload);

            changes.put(change);
            root.put("changes", changes);

            byte[] bytes = root.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
                os.flush();
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                mainHandler.post(() -> Toast.makeText(context, "Saved to Markbel!", Toast.LENGTH_SHORT).show());
            } else if (code == 401) {
                mainHandler.post(() -> Toast.makeText(context, "Markbel session expired. Please log in.", Toast.LENGTH_LONG).show());
            } else {
                mainHandler.post(() -> Toast.makeText(context, "Could not save to Markbel (Server error: " + code + ")", Toast.LENGTH_SHORT).show());
            }
            conn.disconnect();
        } catch (Exception e) {
            mainHandler.post(() -> Toast.makeText(context, "Unable to save to Markbel. Check connection.", Toast.LENGTH_SHORT).show());
        }
    }

    private static String resolveSmartGroup(String url) {
        if (url == null) return "Unsorted";
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("youtube.com") || lower.contains("youtu.be")) {
            return "YT";
        }
        if (lower.contains("instagram.com") || lower.contains("instagr.am") || lower.contains("ig.me")) {
            return "Insta";
        }
        if (lower.contains("twitter.com") || lower.contains("x.com") || lower.contains("t.co")) {
            return "X";
        }
        return "Unsorted";
    }
}
