package com.streamhub.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PlatformLaunch")
public class PlatformLaunchPlugin extends Plugin {

    @PluginMethod
    public void openPlatform(PluginCall call) {
        String url = call.getString("url");
        String primaryPackage = call.getString("packageName");
        String fallbackPackage = call.getString("fallbackPackage");

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        if (tryOpen(url, primaryPackage)) {
            call.resolve();
            return;
        }

        if (fallbackPackage != null && !fallbackPackage.equals(primaryPackage) && tryOpen(url, fallbackPackage)) {
            call.resolve();
            return;
        }

        if (tryOpen(url, null)) {
            call.resolve();
            return;
        }

        call.reject("Could not open platform app");
    }

    private boolean tryOpen(String url, String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            if (packageName != null && !packageName.isEmpty()) {
                intent.setPackage(packageName);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }
}
