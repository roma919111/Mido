package com.streamhub.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import com.getcapacitor.JSObject;
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

    @PluginMethod
    public void isInstalled(PluginCall call) {
        String primaryPackage = call.getString("packageName");
        String fallbackPackage = call.getString("fallbackPackage");

        boolean installed =
            isPackageInstalled(primaryPackage)
                || (fallbackPackage != null
                    && !fallbackPackage.isEmpty()
                    && !fallbackPackage.equals(primaryPackage)
                    && isPackageInstalled(fallbackPackage));

        JSObject result = new JSObject();
        result.put("installed", installed);
        call.resolve(result);
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }

        if (tryOpenPlayStore("market://details?id=" + packageName)) {
            call.resolve();
            return;
        }

        if (tryOpenPlayStore("https://play.google.com/store/apps/details?id=" + packageName)) {
            call.resolve();
            return;
        }

        call.reject("Could not open Play Store");
    }

    private boolean tryOpenPlayStore(String uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isPackageInstalled(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
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
