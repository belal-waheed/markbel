package com.markbel.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    public class WebAppInterface {
        private final Context context;

        public WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void setAuthToken(String token) {
            if (token != null && !token.isEmpty() && !token.equals("null")) {
                context.getSharedPreferences("MarkbelPrefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("auth_token", token.trim())
                    .apply();
            } else {
                context.getSharedPreferences("MarkbelPrefs", Context.MODE_PRIVATE)
                    .edit()
                    .remove("auth_token")
                    .apply();
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupTokenBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        drainPendingShares();
    }

    private void setupTokenBridge() {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new WebAppInterface(this), "MarkbelNative");

            // Sync token on startup from localStorage and drain pending offline shares
            bridge.getWebView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().evaluateJavascript(
                            "(function() { return localStorage.getItem('markbel_token') || ''; })();",
                            new ValueCallback<String>() {
                                @Override
                                public void onReceiveValue(String value) {
                                    if (value != null && !value.equals("null") && !value.isEmpty()) {
                                        String cleanToken = value.replace("\"", "").trim();
                                        if (!cleanToken.isEmpty() && !cleanToken.equals("null")) {
                                            getSharedPreferences("MarkbelPrefs", Context.MODE_PRIVATE)
                                                .edit()
                                                .putString("auth_token", cleanToken)
                                                .apply();
                                        }
                                    }
                                    drainPendingShares();
                                }
                            }
                        );
                    }
                }
            }, 1000);
        }
    }

    private void drainPendingShares() {
        if (bridge == null || bridge.getWebView() == null) return;
        try {
            SharedPreferences prefs = getSharedPreferences("MarkbelPrefs", Context.MODE_PRIVATE);
            String pendingJson = prefs.getString("pending_shares", null);
            if (pendingJson == null || pendingJson.trim().isEmpty() || pendingJson.equals("[]")) {
                return;
            }

            JSONArray array = new JSONArray(pendingJson);
            if (array.length() == 0) return;

            // Clear pending_shares immediately to prevent double processing
            prefs.edit().remove("pending_shares").apply();

            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                String itemUrl = item.optString("url", "");
                String itemTitle = item.optString("title", itemUrl);
                String itemDesc = item.optString("description", "");

                if (itemUrl.isEmpty()) continue;

                JSONObject payloadObj = new JSONObject();
                payloadObj.put("url", itemUrl);
                payloadObj.put("title", itemTitle);
                payloadObj.put("description", itemDesc);

                String js = String.format(
                    "(function() {" +
                    "  var item = %s;" +
                    "  var now = new Date().toISOString();" +
                    "  var userStr = localStorage.getItem('markbel_user');" +
                    "  var userId = 'local-user';" +
                    "  if (userStr) { try { userId = JSON.parse(userStr).id || 'local-user'; } catch(e){} }" +
                    "  var bookmarkId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('bm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));" +
                    "  var outboxId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('ob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));" +
                    "  var bookmark = {" +
                    "    id: bookmarkId," +
                    "    userId: userId," +
                    "    url: item.url," +
                    "    title: item.title || item.url," +
                    "    description: item.description || ''," +
                    "    group: 'Unsorted'," +
                    "    version: 0," +
                    "    createdAt: now," +
                    "    updatedAt: now," +
                    "    deletedAt: null" +
                    "  };" +
                    "  var outboxItem = {" +
                    "    id: outboxId," +
                    "    entityType: 'bookmark'," +
                    "    entityId: bookmarkId," +
                    "    operation: 'create'," +
                    "    baseVersion: 0," +
                    "    payload: bookmark," +
                    "    status: 'pending'," +
                    "    attempts: 0," +
                    "    createdAt: now" +
                    "  };" +
                    "  if (window.db && window.db.bookmarks && window.db.syncOutbox) {" +
                    "    window.db.transaction('rw', [window.db.bookmarks, window.db.syncOutbox], function() {" +
                    "      return Promise.all([" +
                    "        window.db.bookmarks.add(bookmark)," +
                    "        window.db.syncOutbox.add(outboxItem)" +
                    "      ]);" +
                    "    }).catch(function(err){ console.error('[MarkbelNative] Dexie outbox drain error:', err); });" +
                    "  } else {" +
                    "    var req = indexedDB.open('MarkbelDatabase');" +
                    "    req.onsuccess = function(e) {" +
                    "      var idb = e.target.result;" +
                    "      var tx = idb.transaction(['bookmarks', 'syncOutbox'], 'readwrite');" +
                    "      tx.objectStore('bookmarks').add(bookmark);" +
                    "      tx.objectStore('syncOutbox').add(outboxItem);" +
                    "    };" +
                    "  }" +
                    "})();",
                    payloadObj.toString()
                );

                bridge.getWebView().evaluateJavascript(js, null);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
