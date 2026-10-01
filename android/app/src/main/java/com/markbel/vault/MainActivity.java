package com.markbel.vault;

import android.content.Context;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import com.getcapacitor.BridgeActivity;

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

    private void setupTokenBridge() {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new WebAppInterface(this), "MarkbelNative");

            // Sync token on startup from localStorage
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
                                }
                            }
                        );
                    }
                }
            }, 1000);
        }
    }
}
