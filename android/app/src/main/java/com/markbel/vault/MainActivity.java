package com.markbel.vault;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private String pendingShareText = null;
    private String pendingShareTitle = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && ("text/plain".equals(type) || type.startsWith("text/"))) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT);

            if (sharedText != null && !sharedText.trim().isEmpty()) {
                pendingShareText = sharedText.trim();
                pendingShareTitle = sharedTitle != null ? sharedTitle.trim() : "";
                dispatchShareEvent();
            }
        }
    }

    private void dispatchShareEvent() {
        if (pendingShareText == null || bridge == null || bridge.getWebView() == null) {
            return;
        }

        try {
            JSONObject detail = new JSONObject();
            detail.put("text", pendingShareText);
            detail.put("title", pendingShareTitle != null ? pendingShareTitle : "");

            String jsonString = detail.toString();
            // Set window global for cold boots and trigger custom event for live instances
            String jsCode = String.format(
                "(function() { " +
                "  window.__INITIAL_SHARE_PAYLOAD__ = %s; " +
                "  window.dispatchEvent(new CustomEvent('markbel:shareIntent', { detail: %s })); " +
                "})();",
                jsonString, jsonString
            );

            bridge.getWebView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().evaluateJavascript(jsCode, null);
                    }
                }
            }, 600);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

